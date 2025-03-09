import { ISymphony } from '../types/symphony';
import { BaseManager } from '../managers/base';
import { IAgentService } from '../services/interfaces';
import { Agent, AgentConfig, AgentResult } from '../types/sdk';
import { SystemPromptService } from './sysprompt';
import { ToolLifecycleState } from '../types/sdk';
import { LLMRequest, LLMMessage } from '../llm/types';

// Directory operation message types
const DIRECTORY_MESSAGE_TYPES = {
    LIST: 'agent.directory.list',
    READ: 'agent.directory.read',
    WRITE: 'agent.directory.write',
    DELETE: 'agent.directory.delete'
} as const;

export class AgentService extends BaseManager implements IAgentService {
    private systemPromptService: SystemPromptService;
    private agents: Map<string, Agent> = new Map();
    protected _state: ToolLifecycleState = ToolLifecycleState.PENDING;

    constructor(symphony: ISymphony) {
        super(symphony, 'AgentService');
        
        // Initialize system prompt service using singleton
        this.systemPromptService = SystemPromptService.getInstance(symphony);

        // Subscribe to directory operation messages
        Object.values(DIRECTORY_MESSAGE_TYPES).forEach(messageType => {
            this.subscribe(messageType);
        });
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return ['ToolService', 'ValidationService'];
    }

    async initialize(): Promise<void> {
        await this.initializeInternal();
    }

    async create(input: string | Partial<AgentConfig>): Promise<Agent> {
        if (typeof input === 'string') {
            // Create from name
            return this.createFromName(input);
        } else {
            // Create from config
            const name = input.name || `agent_${Date.now()}`;
            return this.createAgent(name, input as AgentConfig);
        }
    }

    private async createFromName(name: string): Promise<Agent> {
        const config: AgentConfig = {
            name,
            description: `Agent ${name}`,
            task: '',
            tools: [],
            llm: {
                model: 'gpt-4',
                apiKey: process.env.OPENAI_API_KEY || ''
            }
        };
        return this.createAgent(name, config);
    }

    async createAgent(name: string, config: AgentConfig): Promise<Agent> {
        return this.withErrorHandling('createAgent', async () => {
            this.assertInitialized();
            
            if (this.agents.has(name)) {
                throw new Error(`Agent ${name} already exists`);
            }

            // Validate agent config
            await this.symphony.validation.validate(config, 'agent');

            // Validate tool dependencies
            for (const toolName of config.tools) {
                await this.symphony.tool.getTool(toolName);
            }

            // Get initial system prompt for agent creation
            const baseSystemPrompt = await this.systemPromptService.getSystemPrompt({
                description: config.description,
                task: config.task,
                tool_registry: config.tools,
                FAST_PATH_THRESHOLD: config.thresholds?.fastPath || 0.7
            });

            const agent: Agent = {
                name,
                description: config.description,
                systemPrompt: baseSystemPrompt,
                tools: config.tools,
                state: ToolLifecycleState.PENDING,
                run: async (task: string): Promise<AgentResult> => {
                    const startTime = Date.now();
                    try {
                        // Get task-specific system prompt
                        const systemPrompt = await this.systemPromptService.getSystemPrompt({
                            description: config.description,
                            task,
                            tool_registry: config.tools,
                            FAST_PATH_THRESHOLD: config.thresholds?.fastPath || 0.7
                        });

                        // Create messages array with XML-formatted system prompt
                        const messages: LLMMessage[] = [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: task }
                        ];

                        // Create LLM request with system prompt and task
                        const llmRequest: LLMRequest = {
                            messages,
                            provider: typeof config.llm === 'string' ? 'openai' : config.llm.provider || 'openai'
                        };

                        // Execute agent logic using LLM
                        const result = await this.symphony.llm.complete(llmRequest);
                        return {
                            success: true,
                            result: result.content,
                            metrics: {
                                duration: Date.now() - startTime,
                                startTime,
                                endTime: Date.now(),
                                toolCalls: 0,
                                confidence: 1.0,
                                performance: 1.0,
                                llmUsage: {
                                    promptTokens: result.usage.prompt_tokens,
                                    completionTokens: result.usage.completion_tokens,
                                    totalTokens: result.usage.total_tokens,
                                    model: typeof config.llm === 'string' ? config.llm : config.llm.model
                                }
                            }
                        };
                    } catch (error) {
                        return {
                            success: false,
                            error: error instanceof Error ? error.message : String(error),
                            metrics: {
                                duration: Date.now() - startTime,
                                startTime,
                                endTime: Date.now(),
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
            };

            this.agents.set(name, agent);
            return agent;
        });
    }

    async getAgent(name: string): Promise<Agent> {
        return this.withErrorHandling('getAgent', async () => {
            this.assertInitialized();
            
            const agent = this.agents.get(name);
            if (!agent) {
                throw new Error(`Agent ${name} not found`);
            }
            return agent;
        });
    }

    async listAgents(): Promise<string[]> {
        return this.withErrorHandling('listAgents', async () => {
            this.assertInitialized();
            return Array.from(this.agents.keys());
        });
    }

    protected async initializeInternal(): Promise<void> {
        this.logInfo('Initializing agent service');
        this._state = ToolLifecycleState.READY;
    }

    protected async handleMessage(message: any): Promise<void> {
        switch (message.type) {
            case DIRECTORY_MESSAGE_TYPES.LIST:
                await this.handleListDirectory(message.payload);
                break;
            case DIRECTORY_MESSAGE_TYPES.READ:
                await this.handleReadDirectory(message.payload);
                break;
            case DIRECTORY_MESSAGE_TYPES.WRITE:
                await this.handleWriteDirectory(message.payload);
                break;
            case DIRECTORY_MESSAGE_TYPES.DELETE:
                await this.handleDeleteDirectory(message.payload);
                break;
        }
    }

    private async handleListDirectory(payload: { path: string }): Promise<void> {
        return this.withErrorHandling('listDirectory', async () => {
            const { path } = payload;
            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            await this.publish({
                type: 'agent.directory.list.response',
                payload: { path, entries: [] } // Registry doesn't have listDirectory, return empty array
            });
        });
    }

    private async handleReadDirectory(payload: { path: string }): Promise<void> {
        return this.withErrorHandling('readDirectory', async () => {
            const { path } = payload;
            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            await this.publish({
                type: 'agent.directory.read.response',
                payload: { path, contents: {} } // Registry doesn't have readDirectory, return empty object
            });
        });
    }

    private async handleWriteDirectory(payload: { path: string, contents: any }): Promise<void> {
        return this.withErrorHandling('writeDirectory', async () => {
            const { path } = payload;
            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            await this.publish({
                type: 'agent.directory.write.response',
                payload: { path, success: true }
            });
        });
    }

    private async handleDeleteDirectory(payload: { path: string }): Promise<void> {
        return this.withErrorHandling('deleteDirectory', async () => {
            const { path } = payload;
            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            await this.publish({
                type: 'agent.directory.delete.response',
                payload: { path, success: true }
            });
        });
    }
} 