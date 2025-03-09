import { AgentConfig, LLMConfig, Tool, ToolLifecycleState } from '../types/sdk';
import { LLMHandler } from '../llm/handler';
import { logger, LogCategory } from '../utils/logger';
import { ServiceRegistry } from '../proto/symphonic/core/types';
import { ContextManager } from '../proto/symphonic/core/cache/context';
import { ValidationManager } from '../proto/symphonic/core/cache/validation';
import { SystemPromptService } from '../services/sysprompt';
import { symphony } from '../sdk';
import { Agent, AgentResult } from '../types/sdk';
import { ToolMetadata } from '../types/tool';
import { ComponentService } from '../proto/symphonic/core/types';

// Combined Tool interface that includes both SDK and Core tool properties
interface ExecutableTool extends Tool {
    metadata: ToolMetadata;
    state: ToolLifecycleState;
    run(params: any): Promise<any>;
}

// Type for tool parameter
interface ToolParam {
    name: string;
    description?: string;
    required: boolean;
    type: string;
}

export class ExecutorAgent implements Agent {
    private _state: ToolLifecycleState = ToolLifecycleState.PENDING;
    private _config: AgentConfig;
    private llmHandler: LLMHandler;
    private serviceRegistry: ServiceRegistry;
    private contextManager: ContextManager;
    private validationManager: ValidationManager;
    private systemPromptService: SystemPromptService;

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
        this.systemPromptService = SystemPromptService.getInstance(symphony);

        this._config = {
            name: 'executor',
            description: 'An agent that executes tasks using available tools',
            task: 'Execute tasks using available tools',
            tools: ['web_search', 'calculator', 'file_read', 'file_write'],
            capabilities: ['execute', 'coordinate'],
            llm: {
                model: 'gpt-4',
                provider: 'openai',
                apiKey: process.env.OPENAI_API_KEY
            } as LLMConfig,
            thresholds: {
                fastPath: 0.9,
                confidence: 0.7
            },
            maxCalls: 10,
            requireApproval: false
        };
    }

    get name(): string {
        return this._config.name;
    }

    get description(): string {
        return this._config.description;
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    get tools(): string[] {
        return this._config.tools;
    }

    get systemPrompt(): string | undefined {
        return this._config.systemPrompt;
    }

    async run(task: string): Promise<AgentResult> {
        return this.execute(this._config, { task });
    }

    public async execute(config: AgentConfig, input: any): Promise<AgentResult> {
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();

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

            // Get system prompt from service
            const systemPrompt = await this.systemPromptService.getSystemPrompt({
                description: config.description,
                task: input.task,
                tool_registry: tools,
                FAST_PATH_THRESHOLD: config.thresholds?.fastPath || 0.7
            });

            // Execute LLM call
            const llmResponse = await this.llmHandler.complete({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: input.task }
                ],
                functions: tools.map((tool: ExecutableTool) => ({
                    name: tool.metadata.name,
                    description: tool.metadata.description || '',
                    parameters: {
                        type: 'object',
                        properties: Object.fromEntries(
                            (tool.metadata.inputParams || []).map((param: ToolParam) => [
                                param.name,
                                {
                                    type: 'string',
                                    description: param.description || ''
                                }
                            ])
                        ),
                        required: (tool.metadata.inputParams || [])
                            .filter((param: ToolParam) => param.required)
                            .map((param: ToolParam) => param.name)
                    }
                }))
            });

            return {
                success: true,
                result: llmResponse.content,
                metrics: {
                    duration: Date.now() - startTime,
                    startTime,
                    endTime: Date.now(),
                    toolCalls: 0,
                    confidence: 1.0,
                    performance: 1.0,
                    llmUsage: {
                        promptTokens: llmResponse.usage?.prompt_tokens || 0,
                        completionTokens: llmResponse.usage?.completion_tokens || 0,
                        totalTokens: llmResponse.usage?.total_tokens || 0,
                        model: typeof config.llm === 'string' ? config.llm : config.llm.model
                    }
                }
            };
        } catch (error) {
            const endTime = Date.now();
            logger.error(LogCategory.AI, 'Agent execution failed', {
                metadata: {
                    agent: config.name,
                    executionId,
                    error: error instanceof Error ? error.message : String(error)
                }
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                metrics: {
                    duration: endTime - startTime,
                    startTime,
                    endTime,
                    toolCalls: 0,
                    confidence: 0,
                    performance: 0,
                    llmUsage: {
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0,
                        model: typeof config.llm === 'string' ? config.llm : config.llm.model
                    }
                }
            };
        }
    }

    private convertToExecutableTool(service: ComponentService): ExecutableTool {
        const metadata: ToolMetadata = {
            name: service.metadata.name,
            description: service.metadata.description || '',
            id: service.metadata.id,
            inputParams: service.metadata.inputParams?.map(param => ({
                name: param.name,
                description: param.description || '',
                required: param.required,
                type: 'string' // Default to string type for all parameters
            }))
        };

        return {
            name: service.metadata.name,
            description: service.metadata.description || '',
            metadata,
            state: service.metadata.status === 'ACTIVE' ? ToolLifecycleState.READY : ToolLifecycleState.ERROR,
            run: async (params: any) => {
                const result = await this.serviceRegistry.executeCall(service.metadata.id, 'run', params);
                return result.data;
            }
        };
    }

    private async loadTools(toolNames: string[]): Promise<ExecutableTool[]> {
        const tools: ExecutableTool[] = [];
        for (const name of toolNames) {
            const service = await this.serviceRegistry.getService(name);
            if (service && service.metadata.type === 'TOOL') {
                tools.push(this.convertToExecutableTool(service));
            }
        }
        return tools;
    }
} 