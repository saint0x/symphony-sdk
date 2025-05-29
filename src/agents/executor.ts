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
            this.logger.info('AgentExecutor', `Executing task with enhanced workflow: ${task}`);

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

            // Step 2: Use LLM to analyze task and decide on execution strategy
            const analysisResult = await this.analyzeTaskWithLLM(task, systemPrompt);
            
            // Step 3: Determine if this needs a tool chain or single tool
            const executionStrategy = await this.determineExecutionStrategy(task, analysisResult);
            
            let executionResult;
            if (executionStrategy.type === 'tool_chain') {
                // Execute as tool chain
                const chain = this.buildToolChainFromStrategy(task, executionStrategy);
                executionResult = await this.executeToolChain(chain, { task });
            } else {
                // Execute as single tool (existing workflow)
                executionResult = await this.tryToolExecution(task, analysisResult);
            }
            
            // Step 4: Generate final response
            const finalResponse = await this.synthesizeEnhancedResponse(task, analysisResult, executionResult, executionStrategy);

            // Store comprehensive execution data in memory
            await this.memory.store(`task:${Date.now()}`, {
                task,
                analysisResponse: analysisResult.response,
                executionStrategy: executionStrategy.type,
                executionResult,
                finalResponse: finalResponse.response,
                timestamp: new Date().toISOString(),
                tokenUsage: analysisResult.tokenUsage,
                metrics: {
                    analysisTokens: analysisResult.tokenUsage,
                    executionTime: executionResult?.chainMetrics?.totalDuration || executionResult?.metrics?.duration || 0,
                    totalWorkflowSuccess: true
                }
            });

            return {
                success: true,
                result: finalResponse
            };

        } catch (error) {
            this.logger.error('AgentExecutor', 'Enhanced workflow execution failed', { error });
            
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

    private async determineExecutionStrategy(task: string, _analysisResult: any): Promise<{ type: 'single_tool' | 'tool_chain', confidence: number, reasoning: string }> {
        // Simple strategy determination for now
        // In the future, this could use LLM to analyze task complexity
        
        const taskLower = task.toLowerCase();
        
        // Look for keywords that suggest multi-step workflows
        const chainKeywords = [
            'and then', 'after that', 'followed by', 'then', 'next',
            'first', 'second', 'third', 'finally',
            'step by step', 'process', 'workflow', 'sequence',
            'analyze and', 'search and write', 'read and summarize'
        ];

        const hasChainKeywords = chainKeywords.some(keyword => taskLower.includes(keyword));
        
        if (hasChainKeywords) {
            return {
                type: 'tool_chain',
                confidence: 0.8,
                reasoning: `Task contains multi-step workflow indicators: ${chainKeywords.filter(k => taskLower.includes(k)).join(', ')}`
            };
        }

        return {
            type: 'single_tool',
            confidence: 0.9,
            reasoning: 'Task appears to be suitable for single tool execution'
        };
    }

    private buildToolChainFromStrategy(task: string, _strategy: any): ToolChain {
        // Build a simple tool chain based on task analysis
        // This is a basic implementation - could be enhanced with LLM-powered chain generation
        
        const chainId = `chain_${Date.now()}`;
        const taskLower = task.toLowerCase();
        
        // Example: "Search for AI developments and then write a summary to a file"
        if (taskLower.includes('search') && taskLower.includes('write')) {
            return {
                id: chainId,
                name: 'Search and Write Chain',
                description: 'Search for information and write results to a file',
                steps: [
                    {
                        id: 'search_step',
                        tool: 'webSearch',
                        chained: '1',
                        static_params: {
                            query: task.replace(/search for|and then.*$/gi, '').trim(),
                            type: 'search'
                        }
                    },
                    {
                        id: 'write_step', 
                        tool: 'writeFile',
                        chained: '2',
                        input_mapping: {
                            content: 'search_step.result'
                        },
                        static_params: {
                            path: 'search_results.txt'
                        },
                        depends_on: ['search_step']
                    }
                ],
                output_mapping: {
                    searchResults: 'search_step.result',
                    filePath: 'write_step.path'
                }
            };
        }

        // Example: "Think about AI and then search for more information"
        if (taskLower.includes('think') && taskLower.includes('search')) {
            return {
                id: chainId,
                name: 'Think and Research Chain',
                description: 'Deep thinking followed by research',
                steps: [
                    {
                        id: 'think_step',
                        tool: 'ponder',
                        chained: '1',
                        static_params: {
                            query: task,
                            depth: 2
                        }
                    },
                    {
                        id: 'research_step',
                        tool: 'webSearch', 
                        chained: '2',
                        input_mapping: {
                            query: 'think_step.conclusion'
                        },
                        static_params: {
                            type: 'search'
                        },
                        depends_on: ['think_step']
                    }
                ],
                output_mapping: {
                    thoughts: 'think_step.result',
                    research: 'research_step.result'
                }
            };
        }

        // Default: simple sequential chain
        return {
            id: chainId,
            name: 'Default Sequential Chain',
            description: 'Default multi-step workflow',
            steps: [
                {
                    id: 'analyze_step',
                    tool: 'ponder',
                    chained: '1',
                    static_params: {
                        query: task,
                        depth: 1
                    }
                },
                {
                    id: 'execute_step',
                    tool: 'webSearch',
                    chained: '2', 
                    static_params: {
                        query: task,
                        type: 'search'
                    }
                }
            ],
            output_mapping: {
                analysis: 'analyze_step.result',
                execution: 'execute_step.result'
            }
        };
    }

    private async synthesizeEnhancedResponse(_task: string, analysisResult: any, executionResult: any, strategy: any) {
        let response = analysisResult.response;
        
        if (strategy.type === 'tool_chain') {
            response += `\n\n[Tool Chain Execution]`;
            response += `\nStrategy: ${strategy.reasoning}`;
            response += `\nConfidence: ${strategy.confidence}`;
            
            if (executionResult && executionResult.result) {
                response += `\nChain Results: ${JSON.stringify(executionResult.result, null, 2)}`;
            }
        } else if (executionResult && executionResult.result?.success) {
            // Single tool execution (existing logic)
            response += `\n\n[Tool Execution Results]`;
            response += `\nTool Used: ${executionResult.toolName}`;
            response += `\nExecution Time: ${executionResult.metrics?.duration || 0}ms`;
            
            if (executionResult.result.result) {
                response += `\nTool Output: ${JSON.stringify(executionResult.result.result, null, 2)}`;
            }
        }

        return {
            response,
            reasoning: `Enhanced workflow: ${strategy.type} execution`,
            agent: this.config.name,
            timestamp: new Date().toISOString(),
            tokenUsage: analysisResult.tokenUsage,
            model: analysisResult.model,
            executionStrategy: strategy.type,
            strategyConfidence: strategy.confidence,
            workflowComplete: true
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