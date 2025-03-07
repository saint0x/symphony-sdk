import { AgentConfig } from '../types/sdk';
import { LLMHandler } from '../llm/handler';
import { logger, LogCategory } from '../utils/logger';
import { ServiceRegistry } from '../proto/symphonic/core/types';
import { ContextManager } from '../proto/symphonic/core/cache/context';
import { ValidationManager } from '../proto/symphonic/core/cache/validation';

export class AgentExecutor {
    private llmHandler: LLMHandler;
    private serviceRegistry: ServiceRegistry;
    private contextManager: ContextManager;
    private validationManager: ValidationManager;

    constructor(
        llmHandler: LLMHandler,
        serviceRegistry: ServiceRegistry,
        contextManager: ContextManager,
        validationManager: ValidationManager
    ) {
        this.llmHandler = llmHandler;
        this.serviceRegistry = serviceRegistry;
        this.contextManager = contextManager;
        this.validationManager = validationManager;
    }

    public async execute(config: AgentConfig, input: any): Promise<any> {
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            logger.debug(LogCategory.AI, 'Starting agent execution', {
                metadata: {
                    agent: config.name,
                    executionId,
                    input: Object.keys(input)
                }
            });

            // Record execution context
            await this.contextManager.recordExecutionContext(config.name, executionId, {
                type: 'AGENT_EXECUTION',
                agent: config.name,
                input: Object.keys(input),
                tools: config.tools,
                llm: config.llm
            });

            // Validate input
            const validationResult = this.validationManager.validateServiceInput(input, ['task']);
            if (!validationResult.isValid) {
                throw new Error(`Invalid input: ${validationResult.errors[0].message}`);
            }

            // Load available tools
            const tools = await this.loadTools(config.tools);

            // Generate system prompt
            const systemPrompt = this.generateSystemPrompt(config, tools);

            // Execute LLM call
            const llmResponse = await this.llmHandler.complete({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: input.task }
                ],
                functions: tools.map(tool => ({
                    name: tool.metadata.name,
                    description: tool.metadata.description || '',
                    parameters: {
                        type: 'object',
                        properties: Object.fromEntries(
                            (tool.metadata.inputParams || []).map(param => [
                                param.name,
                                {
                                    type: 'string',
                                    description: param.description || ''
                                }
                            ])
                        ),
                        required: (tool.metadata.inputParams || [])
                            .filter(param => param.required)
                            .map(param => param.name)
                    }
                }))
            });

            // Process LLM response
            if (llmResponse.functionCall) {
                // Execute tool
                const tool = tools.find(t => t.metadata.name === llmResponse.functionCall?.name);
                if (!tool) {
                    throw new Error(`Tool not found: ${llmResponse.functionCall.name}`);
                }

                const toolParams = JSON.parse(llmResponse.functionCall.arguments);
                const toolResult = await this.serviceRegistry.executeCall(
                    tool.metadata.id,
                    'execute',
                    toolParams
                );

                if (!toolResult.success) {
                    throw new Error(`Tool execution failed: ${toolResult.error?.message}`);
                }

                // Generate final response
                const finalResponse = await this.llmHandler.complete({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: input.task },
                        {
                            role: 'function',
                            name: tool.metadata.name,
                            content: JSON.stringify(toolResult.data)
                        }
                    ]
                });

                return {
                    success: true,
                    response: finalResponse.content,
                    toolUsed: tool.metadata.name,
                    toolResult: toolResult.data
                };
            }

            // Direct response without tool use
            return {
                success: true,
                response: llmResponse.content
            };

        } catch (error: any) {
            logger.error(LogCategory.AI, 'Agent execution failed', {
                metadata: {
                    agent: config.name,
                    executionId,
                    error: error.message,
                    stack: error.stack
                }
            });

            // Record error context
            await this.contextManager.recordErrorContext(config.name, error, {
                executionId,
                input: Object.keys(input)
            });

            throw error;
        }
    }

    private async loadTools(toolConfigs: Array<string | { name: string; [key: string]: any }>) {
        const tools = [];
        for (const config of toolConfigs) {
            const toolId = typeof config === 'string' ? config : config.name;
            const tool = this.serviceRegistry.getService(toolId);
            if (!tool) {
                throw new Error(`Tool not found: ${toolId}`);
            }
            tools.push(tool);
        }
        return tools;
    }

    private generateSystemPrompt(config: AgentConfig, tools: any[]): string {
        return `You are an AI agent that ${config.description}. Your task is to ${config.task}.

Available tools:
${tools.map(tool => `- ${tool.metadata.name}: ${tool.metadata.description}`).join('\n')}

When you need to use a tool, respond with a function call using the tool's name and required parameters.
Otherwise, respond directly to the user's request.

Remember to:
1. Use tools when specific actions or data are needed
2. Provide clear and concise responses
3. Handle errors gracefully
4. Stay focused on the task`;
    }
} 