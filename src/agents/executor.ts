import { BaseAgent } from './base';
import { AgentConfig, ToolResult, ToolChain } from '../types/sdk';
import { SystemPromptService } from './sysprompt';
import { ToolRegistry } from '../tools/standard/registry';
import { ChainExecutor } from '../tools/executor';
import { LLMRequest, LLMMessage, LLMConfig as RichLLMAgentConfig } from '../llm/types'; // Commented out LLMFunctionDefinition

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

            // Determine if the agent has tools, as this now dictates JSON mode and prompt structure.
            const agentHasTools = this.config.tools && this.config.tools.length > 0;

            // The second argument to generateSystemPrompt now indicates if tools are present,
            // guiding it to prepare a prompt suitable for tool use (implying JSON output).
            let systemPrompt = this.systemPromptService.generateSystemPrompt(this.config, agentHasTools);
            
            // Append custom directives if provided and not using custom systemPrompt (from agent config)
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
            
            // Determine overall success based on tool executions within analysisResult
            let overallTaskSuccess = true; // Assume success unless a tool failed or analysisResult indicates issues
            let primaryError: string | undefined;
            let finalResponse = analysisResult.response;

            if (analysisResult.toolsExecuted && analysisResult.toolsExecuted.length > 0) {
                const firstFailedTool = analysisResult.toolsExecuted.find(t => !t.success);
                if (firstFailedTool) {
                    overallTaskSuccess = false;
                    primaryError = `Tool '${firstFailedTool.name}' failed: ${firstFailedTool.error || 'Unknown tool error'}`;
                    // Optionally, adjust finalResponse if a tool failed critically
                    // finalResponse = `Agent task failed due to tool error: ${primaryError}`;
                }
            } else {
                // No tools were executed.
                const agentHasTools = this.config.tools && this.config.tools.length > 0;

                if (agentHasTools) {
                    // Agent has tools configured, but none were selected or executed by the LLM.
                    // Check if the LLM explicitly said "no tool" in its JSON response.
                    let llmIndicatedNoToolViaJson = false;
                    if (analysisResult.response) { 
                        try {
                            // analysisResult.response should be the direct content from LLM if no tool was called
                            const parsedResponse = JSON.parse(analysisResult.response);
                            if (parsedResponse.tool_name === 'none' || parsedResponse.toolName === 'none') {
                                llmIndicatedNoToolViaJson = true;
                            }
                        } catch (e) {
                            // Not a valid JSON response, or not a tool_name:none structure.
                            this.logger.debug('AgentExecutor', 'executeTask: Could not parse analysisResult.response as JSON or no explicit "none" tool found when checking no-tool case.', { response: analysisResult.response, error: e instanceof Error ? e.message : String(e) });
                        }
                    }

                    if (!llmIndicatedNoToolViaJson) {
                        overallTaskSuccess = false;
                        primaryError = `Agent ${this.config.name} has tools configured but did not select or execute any tool. The LLM response also did not explicitly indicate 'no tool' in the expected JSON format. Task may be incomplete.`;
                        // finalResponse remains analysisResult.response (which could be non-JSON or malformed JSON in this failure case)
                        this.logger.warn('AgentExecutor', primaryError, { agentName: this.config.name, configuredTools: this.config.tools.length, llmResponse: analysisResult.response });
                    } else {
                         this.logger.info('AgentExecutor', `Agent ${this.config.name} explicitly indicated no tool was needed via JSON response. Task considered successful based on LLM decision.`, { agentName: this.config.name });
                         // overallTaskSuccess remains true
                    }
                }
                // If agent has no tools configured, then overallTaskSuccess remains true by default.
            }
            
            // If analyzeAndExecuteTask itself threw or indicated a problem, that would be caught by the outer try/catch.
            // The `analysisResult` might also have its own error field if LLM itself failed to produce a response.
            // For now, we primarily focus on the success of executed tools.

            await this.memory.store(`task:${Date.now()}`, {
                task,
                result: analysisResult, // Log the detailed result from analyzeAndExecuteTask
                success: overallTaskSuccess, // Log the determined overall success
                error: primaryError,
                timestamp: new Date().toISOString(),
                agent: this.config.name
            });

            return {
                success: overallTaskSuccess,
                result: { // Ensure result has a nested structure if other parts of system expect it
                    response: finalResponse,
                    reasoning: analysisResult.reasoning,
                    agent: analysisResult.agent,
                    timestamp: analysisResult.timestamp,
                    model: analysisResult.model,
                    tokenUsage: analysisResult.tokenUsage,
                    toolsExecuted: analysisResult.toolsExecuted
                },
                error: primaryError
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
        const agentHasTools = this.config.tools && this.config.tools.length > 0;

        let finalSystemPrompt = systemPrompt;

        if (agentHasTools) {
            let jsonInstruction = "";
            const baseInstruction = "\n\n--- BEGIN SDK JSON REQUIREMENTS ---";
            const endInstruction = "\n--- END SDK JSON REQUIREMENTS ---";
            let toolGuidance = "";

            // Tool guidance is always included if agentHasTools, as a tool_name is always expected.
            toolGuidance = `
YOU HAVE TOOLS. TO USE A TOOL: your JSON object MUST contain a "tool_name" (string) key AND a "parameters" (object) key. The value for "tool_name" MUST be the EXACT name of the tool. The "parameters" object MUST contain the arguments for the tool.
IF NO TOOL IS NEEDED: your JSON object MUST contain a "tool_name" (string) key set EXPLICITLY to "none", AND a "response" (string) key with your direct textual answer.`;
            
            jsonInstruction = `${baseInstruction}
YOUR ENTIRE RESPONSE MUST BE A SINGLE VALID JSON OBJECT. DO NOT ADD ANY TEXT BEFORE OR AFTER THIS JSON OBJECT.
${toolGuidance}
FAILURE TO ADHERE TO THIS JSON STRUCTURE WILL RESULT IN AN ERROR.${endInstruction}`;
            
            finalSystemPrompt += jsonInstruction;
            this.logger.info('AgentExecutor', 'Appended VERY EXPLICIT JSON structural instruction to system prompt as agent has tools.');
        }

        const initialMessages: LLMMessage[] = [
            { role: 'system', content: finalSystemPrompt }, 
            { role: 'user', content: task }
        ];

        // agentLLMConfig is derived from this.config.llm, which could be a string (model name)
        // or an LLMBaseConfig object. LLMBaseConfig no longer has useFunctionCalling.
        const baseLlmSettings = {
            model: agentLLMConfig?.model || (typeof this.config.llm === 'string' ? this.config.llm : 'default-model'),
            temperature: agentLLMConfig?.temperature ?? 0.7,
            maxTokens: agentLLMConfig?.maxTokens ?? 2048,
        };

        const llmRequest: LLMRequest = {
            messages: initialMessages,
            llmConfig: baseLlmSettings // Assign the cleaned settings
        };

        if (agentHasTools) {
            llmRequest.expectsJsonResponse = true;
            this.logger.info('AgentExecutor', 'Agent has tools, setting expectsJsonResponse = true in LLMRequest.');
            // No longer setting response_format here; OpenAIProvider will handle it if expectsJsonResponse is true.
        } else {
            // Fallback for agents without tools: ensure no legacy TOOL_CALL instructions interfere if system prompt is reused.
            // This part might be simplified or removed if agents without tools have different prompt generation.
            if (initialMessages[0].content?.includes('TOOL_CALL:')) {
                 this.logger.warn('AgentExecutor', 'Agent has no tools, but system prompt contains TOOL_CALL. This might be from a shared/old system prompt.');
            }
            this.logger.info('AgentExecutor', 'Agent has no tools; expecting standard text response.');
        }

        this.logger.info('AgentExecutor', 'Analyzing task with LLM', { agentHasTools });
        const llmResponse = await this.llm.complete(llmRequest);

        if (!llmResponse) {
            this.logger.error('AgentExecutor', 'LLM completion returned null/undefined.');
            throw new Error('LLM completion failed.');
        }

        let toolResults: any[] = [];
        let actualResponseContent = llmResponse.content;

        // Parsing logic now primarily depends on agentHasTools to expect JSON
        if (agentHasTools) { 
            if (llmResponse.content) {
                try {
                    const parsedJson = JSON.parse(llmResponse.content);
                    const toolName = parsedJson.tool_name || parsedJson.toolName;
                    const parameters = parsedJson.parameters;

                    if (toolName && toolName !== 'none' && parameters) {
                        this.logger.info('AgentExecutor', `LLM designated tool (JSON mode): ${toolName}`, { parameters });
                        const toolResultData = await this.registry.executeTool(toolName, parameters);
                        toolResults.push({ name: toolName, success: toolResultData.success, result: toolResultData.result, error: toolResultData.error });
                        actualResponseContent = `Tool ${toolName} executed. Success: ${toolResultData.success}. Result: ${JSON.stringify(toolResultData.result || toolResultData.error)}`;
                        this.logger.info('AgentExecutor', `JSON mode tool execution summary: ${actualResponseContent}`)
                    } else if (toolName === 'none') {
                        this.logger.info('AgentExecutor', 'LLM indicated no tool (JSON mode).');
                        actualResponseContent = parsedJson.response || "No further action taken as per LLM JSON response.";
                    } else {
                        this.logger.warn('AgentExecutor', 'LLM JSON response did not conform to expected {tool_name, parameters} or tool_name was missing.', { parsedJson });
                        actualResponseContent = llmResponse.content; // Fallback to raw content
                    }
                } catch (e) {
                    this.logger.error('AgentExecutor', 'Failed to parse LLM content as JSON, though JSON was expected as agent has tools.', { content: llmResponse.content, error: e });
                    actualResponseContent = llmResponse.content || "Error: LLM response was not valid JSON despite tools being present."; 
                }
            } else {
                this.logger.warn('AgentExecutor', 'LLM content was null, though JSON was expected as agent has tools.');
                actualResponseContent = "LLM response content was null.";
            }
        } else {
            // If agent has no tools, actualResponseContent is already llmResponse.content. No specific JSON parsing expected here.
            this.logger.info('AgentExecutor', 'Agent has no tools, LLM response treated as direct text.');
        }

        return {
            response: actualResponseContent ?? '',
            reasoning: toolResults.length > 0 
                ? `Processed ${toolResults.length} tool actions. First tool: ${toolResults[0].name}, Success: ${toolResults[0].success}` 
                : (agentHasTools ? 'No tool actions taken as per LLM JSON, or direct LLM response in JSON indicated no tool.' : 'Direct LLM response as agent has no tools.'),
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