import { BaseAgent } from './base';
import { AgentConfig, ToolResult, ToolChain } from '../types/sdk';
import { SystemPromptService } from './sysprompt';
import { ToolRegistry } from '../tools/standard/registry';
import { ChainExecutor } from '../tools/executor';
import { LLMRequest } from '../llm/types';

export class AgentExecutor extends BaseAgent {
    private systemPromptService: SystemPromptService;
    private toolRegistry: ToolRegistry;
    private chainExecutor: ChainExecutor;

    constructor(config: AgentConfig, toolRegistry?: ToolRegistry) {
        super(config);
        this.systemPromptService = SystemPromptService.getInstance();
        this.toolRegistry = toolRegistry || ToolRegistry.getInstance();
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

    // Enhanced task execution that can decide between single tools and tool chains
    async executeTask(task: string): Promise<ToolResult> {
        try {
            this.logger.info('AgentExecutor', `Executing task: ${task}`);

            // Step 1: Generate system prompt from XML template
            let systemPrompt = this.systemPromptService.generateSystemPrompt(this.config);
            
            // Step 1.5: Append custom directives if provided
            if (this.config.directives) {
                systemPrompt += `\n\nAdditional Directives:\n${this.config.directives}`;
                this.logger.info('AgentExecutor', 'Added custom directives to system prompt', {
                    directivesLength: this.config.directives.length
                });
            }
            
            this.logger.info('AgentExecutor', 'Generated system prompt', {
                promptLength: systemPrompt.length,
                agentName: this.config.name,
                toolCount: this.config.tools.length,
                hasCustomDirectives: !!this.config.directives
            });

            // Step 2: Use LLM to analyze task
            const analysisResult = await this.analyzeTaskWithLLM(task, systemPrompt);
            
            // Step 3: Execute with single tool approach (removed automatic chain detection)
            const executionResult = await this.tryToolExecution(task, analysisResult);
            
            // Step 4: Generate final response
            const finalResponse = await this.synthesizeResponse(task, analysisResult, executionResult);

            // Store execution data in memory
            await this.memory.store(`task:${Date.now()}`, {
                task,
                analysisResponse: analysisResult.response,
                executionResult,
                finalResponse: finalResponse.response,
                timestamp: new Date().toISOString(),
                tokenUsage: analysisResult.tokenUsage
            });

            return {
                success: true,
                result: finalResponse
            };

        } catch (error) {
            this.logger.error('AgentExecutor', 'Task execution failed', { error });
            
            // Fallback to basic response if anything fails
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

    private async synthesizeResponse(_task: string, analysisResult: any, executionResult: any) {
        let response = analysisResult.response;
        
        if (executionResult && executionResult.result?.success) {
            response += `\n\n[Tool Execution Results]`;
            response += `\nTool Used: ${executionResult.toolName}`;
            response += `\nExecution Time: ${executionResult.metrics?.duration || 0}ms`;
            
            if (executionResult.result.result) {
                response += `\nTool Output: ${JSON.stringify(executionResult.result.result, null, 2)}`;
            }
        }

        return {
            response,
            reasoning: 'Task execution completed',
            agent: this.config.name,
            timestamp: new Date().toISOString(),
            tokenUsage: analysisResult.tokenUsage,
            model: analysisResult.model
        };
    }

    private async analyzeTaskWithLLM(task: string, systemPrompt: string) {
        const llmRequest: LLMRequest = {
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: task
                }
            ],
            llmConfig: {
                model: typeof this.config.llm === 'string' ? this.config.llm : this.config.llm.model,
                temperature: 0.7,
                maxTokens: 2048
            }
        };

        this.logger.info('AgentExecutor', 'Analyzing task with LLM');
        const llmResponse = await this.llm.complete(llmRequest);
        
        this.logger.info('AgentExecutor', 'Received LLM analysis', {
            responseLength: llmResponse.content.length,
            model: llmResponse.model,
            tokenUsage: llmResponse.usage
        });

        return {
            response: llmResponse.content,
            model: llmResponse.model,
            tokenUsage: llmResponse.usage
        };
    }

    private async tryToolExecution(task: string, _analysisResult: any): Promise<any> {
        try {
            // Use intelligent tool selection
            const selectedTool = await this.executeToolSelection(task);
            
            if (!selectedTool) {
                this.logger.info('AgentExecutor', 'No tool selected for task - using LLM response only');
                return null;
            }

            this.logger.info('AgentExecutor', `Executing selected tool: ${selectedTool}`);

            // Extract parameters from task (simple approach for now)
            const toolParams = this.extractToolParams(task, selectedTool);
            
            // Execute the tool using ToolRegistry
            const toolResult = await this.toolRegistry.executeTool(selectedTool, toolParams);
            
            this.logger.info('AgentExecutor', 'Tool execution completed', {
                toolName: selectedTool,
                success: toolResult.success,
                duration: toolResult.metrics?.duration || 0
            });

            return {
                toolName: selectedTool,
                params: toolParams,
                result: toolResult,
                metrics: toolResult.metrics
            };

        } catch (error) {
            this.logger.error('AgentExecutor', 'Tool execution failed', { error });
            return null;
        }
    }

    private extractToolParams(task: string, toolName: string): any {
        // Simple parameter extraction based on tool type
        // This is a basic implementation - could be enhanced with LLM-based extraction
        
        switch (toolName) {
            case 'webSearch':
            case 'webSearchTool':
                // Extract search query from task
                return {
                    query: task.replace(/search for|find|look up|web search/gi, '').trim(),
                    type: 'search'
                };
                
            case 'readFile':
            case 'readFileTool':
                // Try to extract file path
                const readMatch = task.match(/read\s+(?:file\s+)?["']?([^"']+)["']?/i);
                return {
                    path: readMatch ? readMatch[1] : task.replace(/read\s+file\s*/i, '').trim()
                };
                
            case 'writeFile':
            case 'writeFileTool':
                // Try to extract file path and content
                const writeMatch = task.match(/write\s+(?:to\s+)?["']?([^"']+)["']?\s*:?\s*(.+)/i);
                return {
                    path: writeMatch ? writeMatch[1] : 'output.txt',
                    content: writeMatch ? writeMatch[2] : task.replace(/write\s+(?:to\s+)?file\s*/i, '').trim()
                };
                
            case 'ponder':
            case 'ponderTool':
                return {
                    query: task,
                    depth: 2
                };
                
            default:
                // Generic parameter extraction
                return { query: task };
        }
    }

    async executeToolSelection(task: string): Promise<string | null> {
        try {
            // Get available tools from registry
            const availableTools = this.toolRegistry.getAvailableTools();
            const agentTools = this.config.tools.filter(tool => availableTools.includes(tool));
            
            if (agentTools.length === 0) {
                this.logger.info('AgentExecutor', 'No available tools for agent');
                return null;
            }

            // Use LLM to intelligently select tools
            const systemPrompt = `You are a tool selection expert. Given a task and available tools, select the most appropriate tool.

Available tools: ${agentTools.join(', ')}

Respond with only the tool name, or 'none' if no tool is suitable.`;

            const llmRequest: LLMRequest = {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Select the best tool for this task: ${task}` }
                ],
                llmConfig: {
                    model: typeof this.config.llm === 'string' ? this.config.llm : this.config.llm.model,
                    temperature: 0.3, // Lower temperature for more deterministic tool selection
                    maxTokens: 100
                }
            };

            const response = await this.llm.complete(llmRequest);
            const selectedTool = response.content.trim();
            
            // Validate that the selected tool is actually available
            if (agentTools.includes(selectedTool)) {
                this.logger.info('AgentExecutor', `LLM selected tool: ${selectedTool} for task: ${task}`);
                return selectedTool;
            } else if (selectedTool !== 'none') {
                this.logger.warn('AgentExecutor', `LLM selected invalid tool: ${selectedTool}, falling back to heuristic selection`);
                // Fallback to parent class heuristic selection
                return await this.selectTool(task);
            } else {
                this.logger.info('AgentExecutor', `LLM determined no tool needed for task: ${task}`);
                return null;
            }

        } catch (error) {
            this.logger.error('AgentExecutor', 'LLM tool selection failed, using fallback', { error });
            // Fallback to parent class heuristic selection
            return await this.selectTool(task);
        }
    }
} 