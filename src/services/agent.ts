import { ISymphony } from '../symphony/interfaces/types';
import { BaseManager } from '../managers/base';
import { IAgentService } from './interfaces';
import { Agent, AgentConfig, LLMConfig, AgentResult, AgentOptions } from '../types/sdk';

// Directory operation message types
const DIRECTORY_MESSAGE_TYPES = {
    LIST: 'agent.directory.list',
    READ: 'agent.directory.read',
    WRITE: 'agent.directory.write',
    DELETE: 'agent.directory.delete'
} as const;

export class AgentService extends BaseManager implements IAgentService {
    constructor(symphony: ISymphony) {
        super(symphony, 'AgentService');
        // Add dependencies
        this.addDependency(symphony.validation);
        this.addDependency(symphony.componentManager);
        this.addDependency(symphony.tool);

        // Subscribe to directory operation messages
        Object.values(DIRECTORY_MESSAGE_TYPES).forEach(messageType => {
            this.subscribe(messageType);
        });
    }

    async create(input: string | Partial<AgentConfig>): Promise<Agent> {
        if (typeof input === 'string') {
            // Create from name
            return this.createFromName(input);
        } else {
            // Create from config
            return this.createAgent(input);
        }
    }

    private async createFromName(name: string): Promise<Agent> {
        const config: Partial<AgentConfig> = {
            name,
            description: `Agent ${name}`,
            task: '',
            tools: [],
            llm: {
                provider: 'openai',
                model: 'gpt-4',
                apiKey: process.env.OPENAI_API_KEY || ''
            } as LLMConfig
        };
        return this.createAgent(config);
    }

    private async createAgent(config: Partial<AgentConfig>): Promise<Agent> {
        this.assertInitialized();
        return this.withErrorHandling('createAgent', async () => {
            const validation = await this.symphony.validation.validate(config, 'AgentConfig');
            if (!validation.isValid) {
                throw new Error(`Invalid agent configuration: ${validation.errors.join(', ')}`);
            }

            const agent: Agent = {
                id: `agent_${Date.now()}`,
                name: config.name || 'Unnamed Agent',
                description: config.description || 'No description provided',
                task: config.task || '',
                tools: config.tools || [],
                run: async (task: string, options?: AgentOptions): Promise<AgentResult> => {
                    const startTime = Date.now();
                    
                    // Report initial progress
                    options?.onProgress?.({ status: 'started', result: null });

                    try {
                        // TODO: Implement actual agent execution
                        const result = task;

                        const metrics = {
                            duration: Date.now() - startTime,
                            startTime,
                            endTime: Date.now(),
                            toolCalls: 0
                        };

                        // Report metrics if callback provided
                        options?.onMetrics?.(metrics);

                        // Report completion progress
                        options?.onProgress?.({ status: 'completed', result });

                        return {
                            success: true,
                            result,
                            metrics
                        };
                    } catch (error) {
                        const metrics = {
                            duration: Date.now() - startTime,
                            startTime,
                            endTime: Date.now(),
                            toolCalls: 0,
                            error: error instanceof Error ? error.message : String(error)
                        };

                        // Report error metrics
                        options?.onMetrics?.(metrics);

                        // Report error progress
                        options?.onProgress?.({ status: 'error', result: null });

                        return {
                            success: false,
                            error: error instanceof Error ? error : new Error(String(error)),
                            metrics
                        };
                    }
                }
            };

            return agent;
        });
    }

    protected async initializeInternal(): Promise<void> {
        // No additional initialization needed
    }

    protected async processMessage(message: any): Promise<void> {
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
            default:
                await super.processMessage(message);
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
                payload: { path, entries: await registry.listDirectory(path) }
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
                payload: { path, contents: await registry.readDirectory(path) }
            });
        });
    }

    private async handleWriteDirectory(payload: { path: string, contents: any }): Promise<void> {
        return this.withErrorHandling('writeDirectory', async () => {
            const { path, contents } = payload;
            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            await registry.writeDirectory(path, contents);
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

            await registry.deleteDirectory(path);
            await this.publish({
                type: 'agent.directory.delete.response',
                payload: { path, success: true }
            });
        });
    }
} 