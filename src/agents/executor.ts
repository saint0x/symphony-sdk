import { BaseAgent } from './base';
import { AgentConfig, ToolResult, ToolChain } from '../types/sdk';
import { SystemPromptService } from './sysprompt';
import { ToolRegistry } from '../tools/standard/registry';
import { ChainExecutor } from '../tools/executor';
import { LLMRequest } from '../llm/types';

export class AgentExecutor extends BaseAgent {
    private systemPromptService: SystemPromptService;
    private chainExecutor: ChainExecutor;
    private registry: ToolRegistry;

    constructor(config: AgentConfig, sharedRegistry?: ToolRegistry) {
        super(config);
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

            // Generate system prompt with context tools available
            let systemPrompt = this.systemPromptService.generateSystemPrompt(this.config);
            
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

        this.logger.info('AgentExecutor', 'Analyzing and executing task with LLM');
        const llmResponse = await this.llm.complete(llmRequest);
        
        return {
            response: llmResponse.content,
            reasoning: 'Task analyzed and executed with context intelligence',
            agent: this.config.name,
            timestamp: new Date().toISOString(),
            model: llmResponse.model,
            tokenUsage: llmResponse.usage
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
            const selectedTool = response.content.trim().toLowerCase();
            
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