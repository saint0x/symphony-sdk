import { BaseAgent } from './base';
import { AgentConfig, ToolResult, ToolChain } from '../types/sdk';
import { SystemPromptService } from './sysprompt';
import { ToolRegistry } from '../tools/standard/registry';
import { ChainExecutor } from '../tools/executor';
import { LLMRequest, LLMMessage, LLMFunctionDefinition, LLMConfig as RichLLMAgentConfig } from '../llm/types';

export class AgentExecutor extends BaseAgent {
    public readonly name: string;
    private systemPromptService: SystemPromptService;
    private chainExecutor: ChainExecutor;
    private registry: ToolRegistry;

    constructor(config: AgentConfig, sharedRegistry?: ToolRegistry) {
        super(config);
        this.name = config.name;

        // DIAGNOSTIC LOG
        this.logger.debug('AgentExecutor:constructor', `Agent created. Base config name: "${this.config.name}", Instance name: "${this.name}"`);

        this.registry = sharedRegistry || ToolRegistry.getInstance();
        this.systemPromptService = new SystemPromptService();
        this.chainExecutor = ChainExecutor.getInstance();
    }

    async executeToolChain(chain: ToolChain, input: Record<string, any> = {}): Promise<ToolResult> {
        try {
            this.logger.info('AgentExecutor', `Executing tool chain: ${chain.name}`, {
                chainId: chain.id,
                stepCount: chain.steps.length,
                agentName: this.config.name
            });

            // Execute the chain
            const chainResult = await this.chainExecutor.executeChain(chain, input);

            // Store in memory for future reference
            await this.memory.store(`chain:${Date.now()}`, {
                chainId: chain.id,
                chainName: chain.name,
                input,
                result: chainResult.result,
                success: chainResult.success,
                metrics: chainResult.metrics,
                timestamp: new Date().toISOString()
            });

            // Format the result for agent response
            const agentResult = {
                response: this.formatChainResponse(chain, chainResult),
                reasoning: 'Multi-step tool chain execution',
                agent: this.config.name,
                timestamp: new Date().toISOString(),
                chainMetrics: chainResult.metrics,
                workflowType: 'tool_chain',
                chainExecuted: chain.id,
                chainSuccess: chainResult.success,
                stepsCompleted: chainResult.metrics.completedSteps.length,
                totalSteps: chainResult.metrics.stepCount,
                workflowComplete: true
            };

            return {
                success: chainResult.success,
                result: agentResult,
                error: chainResult.error
            };

        } catch (error) {
            this.logger.error('AgentExecutor', 'Tool chain execution failed', { error });
            
            const fallbackResult = {
                response: `Agent ${this.config.name} encountered an error executing tool chain: ${chain.name}`,
                error: error instanceof Error ? error.message : String(error),
                fallback: true,
                timestamp: new Date().toISOString(),
                chainExecuted: chain.id,
                chainSuccess: false
            };
            
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                result: fallbackResult
            };
        }
    }

    private formatChainResponse(chain: ToolChain, chainResult: any): string {
        if (!chainResult.success) {
            return `Tool chain "${chain.name}" failed: ${chainResult.error}`;
        }

        const metrics = chainResult.metrics;
        let response = `Successfully executed tool chain "${chain.name}"\n\n`;
        
        // Add execution summary
        response += `**Execution Summary:**\n`;
        response += `- Total Duration: ${metrics.totalDuration}ms\n`;
        response += `- Steps Completed: ${metrics.completedSteps.length}/${metrics.stepCount}\n`;
        response += `- Parallel Groups: ${metrics.parallelGroups}\n`;

        if (metrics.failedSteps.length > 0) {
            response += `- Failed Steps: ${metrics.failedSteps.join(', ')}\n`;
        }

        // Add step timing details
        response += `\n**Step Performance:**\n`;
        for (const [stepId, duration] of Object.entries(metrics.stepTimings)) {
            response += `- ${stepId}: ${duration}ms\n`;
        }

        // Add final result
        response += `\n**Chain Results:**\n`;
        response += `${JSON.stringify(chainResult.result, null, 2)}`;

        return response;
    }

    // Simplified task execution - context intelligence handles complexity
    async executeTask(task: string): Promise<ToolResult> {
        try {
            this.logger.info('AgentExecutor', `Executing task: ${task}`);

            // Default to true for function calling
            const agentLLMDetails = typeof this.config.llm === 'object' ? this.config.llm : null;
            const effectiveUseFunctionCalling = agentLLMDetails?.useFunctionCalling !== false; // True unless explicitly false

            let systemPrompt = this.systemPromptService.generateSystemPrompt(this.config, effectiveUseFunctionCalling);
            
            // Append custom directives if provided and not using custom systemPrompt
            if (this.config.directives && !this.config.systemPrompt) {
                systemPrompt += `\n\nAdditional Directives:\n${this.config.directives}`;
            }
            
            this.logger.info('AgentExecutor', 'Generated system prompt', {
                promptLength: systemPrompt.length,
                agentName: this.config.name,
                toolCount: this.config.tools.length,
                hasCustomDirectives: !!this.config.directives
            });

            // Analyze task with LLM - simplified approach
            const analysisResult = await this.analyzeAndExecuteTask(task, systemPrompt);
            
            // Store execution data in memory for learning
            await this.memory.store(`task:${Date.now()}`, {
                task,
                result: analysisResult,
                timestamp: new Date().toISOString(),
                agent: this.config.name
            });

            return {
                success: true,
                result: analysisResult
            };

        } catch (error) {
            this.logger.error('AgentExecutor', 'Task execution failed', { error });
            
            const fallbackResult = {
                response: `Agent ${this.config.name} encountered an error processing: ${task}`,
                error: error instanceof Error ? error.message : String(error),
                fallback: true,
                timestamp: new Date().toISOString()
            };

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                result: fallbackResult
            };
        }
    }

    // Simplified analysis and execution - let LLM handle tool selection through registry
    private async analyzeAndExecuteTask(task: string, systemPrompt: string) {
        const agentLLMConfig = typeof this.config.llm === 'object' ? this.config.llm as RichLLMAgentConfig : null;
        // effectiveUseStructuredJSONOutput determines if we request JSON mode or use tool_calling API
        const shouldUseJSONMode = agentLLMConfig?.useFunctionCalling !== false; // Defaults to true, re-interpreting flag for JSON mode

        const initialMessages: LLMMessage[] = [
            { role: 'system', content: systemPrompt }, // System prompt should guide for JSON object output if shouldUseJSONMode
            { role: 'user', content: task }
        ];

        const llmRequest: LLMRequest = {
            messages: initialMessages,
            llmConfig: {
                model: agentLLMConfig?.model || (typeof this.config.llm === 'string' ? this.config.llm : 'default-model'),
                temperature: agentLLMConfig?.temperature ?? 0.7,
                maxTokens: agentLLMConfig?.maxTokens ?? 2048,
                useFunctionCalling: shouldUseJSONMode // This flag is still useful for provider logic
            }
        };

        if (shouldUseJSONMode) {
            llmRequest.response_format = { type: "json_object" };
            // We do NOT send llmRequest.functions or tool_choice when using response_format = json_object
            this.logger.info('AgentExecutor', 'Requesting JSON object response from LLM.');
        } else {
            // Fallback: Prepare for old text-based TOOL_CALL regex (or future actual tool_calling API if distinct)
            if (!initialMessages[0].content?.includes('TOOL_CALL:')) {
                 initialMessages[0].content += '\n\nWhen you need to use a tool, respond with exactly:\nTOOL_CALL: toolName\nPARAMETERS: {json parameters}';
            }
            this.logger.info('AgentExecutor', 'Using text-based TOOL_CALL fallback.');
        }

        this.logger.info('AgentExecutor', 'Analyzing task with LLM', { shouldUseJSONMode });
        const llmResponse = await this.llm.complete(llmRequest);

        if (!llmResponse) {
            this.logger.error('AgentExecutor', 'LLM completion returned null/undefined.');
            throw new Error('LLM completion failed.');
        }

        // Commented out problematic debug logs
        /* 
        this.logger.debug('[AgentExecutor] LLM Response Received Details', { 
            content: llmResponse.content, 
            tool_calls_raw: llmResponse.tool_calls, 
            usage: llmResponse.usage
        });
        */

        let toolResults: any[] = [];
        let actualResponseContent = llmResponse.content; // This is the primary output now

        if (shouldUseJSONMode) {
            if (llmResponse.content) {
                try {
                    const parsedJson = JSON.parse(llmResponse.content);
                    const toolName = parsedJson.tool_name || parsedJson.toolName; // Allow for snake_case or camelCase
                    const parameters = parsedJson.parameters;

                    if (toolName && toolName !== 'none' && parameters) {
                        this.logger.info('AgentExecutor', `LLM designated tool (JSON mode): ${toolName}`, { parameters });
                        const toolResultData = await this.registry.executeTool(toolName, parameters);
                        toolResults.push({ name: toolName, success: toolResultData.success, result: toolResultData.result, error: toolResultData.error });
                        
                        // In pure JSON mode, the conversation might end here, or the LLM might be expected
                        // to generate a final textual response based on this tool execution in a subsequent turn.
                        // For now, we assume the JSON was the main work.
                        // If a follow-up textual response is needed, the system prompt and task would need to guide it.
                        // We can set actualResponseContent to a summary or the tool result.
                        actualResponseContent = `Tool ${toolName} executed. Success: ${toolResultData.success}. Result: ${JSON.stringify(toolResultData.result || toolResultData.error)}`;
                        this.logger.info('AgentExecutor', `JSON mode tool execution summary: ${actualResponseContent}`)
                    } else if (toolName === 'none') {
                        this.logger.info('AgentExecutor', 'LLM indicated no tool (JSON mode).');
                        actualResponseContent = parsedJson.response || "No further action taken as per LLM JSON response.";
                    } else {
                        this.logger.warn('AgentExecutor', 'LLM JSON response in JSON mode did not conform to expected {tool_name, parameters} structure or tool_name was missing.', { parsedJson });
                        actualResponseContent = llmResponse.content; // Fallback to raw content if structure is wrong
                    }
                } catch (e) {
                    this.logger.error('AgentExecutor', 'Failed to parse LLM content as JSON in JSON_OBJECT mode', { content: llmResponse.content, error: e });
                    actualResponseContent = llmResponse.content || "Error: LLM response was not valid JSON despite json_object mode."; 
                }
            } else {
                this.logger.warn('AgentExecutor', 'LLM content was null in JSON_OBJECT mode.');
                actualResponseContent = "LLM response content was null.";
            }
        } else {
            // Fallback to legacy text-based TOOL_CALL parsing
            this.logger.info('AgentExecutor', 'Executing fallback text-based TOOL_CALL parsing.');
            const toolCallPattern = /TOOL_CALL:\s*(\w+)\s*\nPARAMETERS:\s*({[\s\S]*?}(?=\s*(?:TOOL_CALL|$)))/g;
            const matches = Array.from((actualResponseContent || '').matchAll(toolCallPattern));
            if (matches.length > 0) toolResults.length = 0; // Reset for this specific parsing

            for (const match of matches) {
                const toolName = match[1];
                const parametersStr = match[2];
                try {
                    let parameters = JSON.parse(parametersStr);
                    this.logger.info('AgentExecutor', `Executing (regex) tool: ${toolName}`, { params: parametersStr });
                    const toolResult = await this.registry.executeTool(toolName, parameters);
                    toolResults.push({ name: toolName, success: toolResult.success, result: toolResult.result, error: toolResult.error });
                    if (toolResult.success) {
                        actualResponseContent = (actualResponseContent || '').replace(match[0], `Tool Executed: ${toolName}\nResult: ${JSON.stringify(toolResult.result, null, 2)}`);
                    } else {
                        actualResponseContent = (actualResponseContent || '').replace(match[0], `Tool Execution Failed: ${toolName}\nError: ${toolResult.error}`);
                    }
                } catch (error) {
                    this.logger.error('AgentExecutor', 'Failed to parse/execute (regex) tool', { error, toolName, params: parametersStr });
                    actualResponseContent = (actualResponseContent || '').replace(match[0], `Tool Execution Error: ${error instanceof Error ? error.message : String(error)}`);
                    toolResults.push({ name: toolName, success: false, error: error instanceof Error ? error.message : String(error) });
                }
            }
        }

        return {
            response: actualResponseContent ?? '',
            reasoning: toolResults.length > 0 
                ? `Processed ${toolResults.length} tool actions. First tool: ${toolResults[0].name}, Success: ${toolResults[0].success}` 
                : 'No tool actions taken, or direct LLM response.',
            agent: this.config.name,
            timestamp: new Date().toISOString(),
            model: llmResponse.model,
            tokenUsage: llmResponse.usage,
            toolsExecuted: toolResults.length > 0 ? toolResults : undefined
        };
    }

    // Simplified tool selection for backward compatibility
    async executeToolSelection(task: string): Promise<string | null> {
        try {
            // Get available tools from registry
            const availableTools = this.registry.getAvailableTools();
            const agentTools = this.config.tools.filter(tool => availableTools.includes(tool));
            
            if (agentTools.length === 0) {
                this.logger.info('AgentExecutor', 'No available tools for agent');
                return null;
            }

            // Simple tool selection - context intelligence will handle sophisticated matching
            const toolDescriptions = agentTools.map(tool => {
                const toolInfo = this.registry.getToolInfo(tool);
                return `${tool}: ${toolInfo?.description || 'Available tool'}`;
            }).join('\n');

            const systemPrompt = `Select the most appropriate tool for this task. Available tools:\n${toolDescriptions}\n\nRespond with ONLY the tool name or "none".`;

            const llmRequest: LLMRequest = {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Task: ${task}` }
                ],
                llmConfig: {
                    model: typeof this.config.llm === 'string' ? this.config.llm : this.config.llm.model,
                    temperature: 0.1,
                    maxTokens: 50
                }
            };

            const response = await this.llm.complete(llmRequest);
            // Ensure content is not null before calling .trim()
            const selectedTool = response.content ? response.content.trim().toLowerCase() : 'none'; 
            
            if (selectedTool === 'none') return null;
            
            // Find tool with case-insensitive matching
            const matchedTool = agentTools.find(tool => tool.toLowerCase() === selectedTool);
            return matchedTool || null;

        } catch (error) {
            this.logger.error('AgentExecutor', 'Tool selection failed', { error });
            return null;
        }
    }
} 