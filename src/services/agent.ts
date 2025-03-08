import { ISymphony } from '../symphony/interfaces/types';
import { BaseManager } from '../managers/base';
import { IAgentService } from './interfaces';

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
        this.addDependency(symphony.components);
        this.addDependency(symphony.tools);

        // Subscribe to directory operation messages
        Object.values(DIRECTORY_MESSAGE_TYPES).forEach(messageType => {
            this.subscribe(messageType);
        });
    }

    async create(config: {
        name: string;
        description: string;
        task: string;
        tools: any[];
        llm: {
            provider: string;
            model: string;
            temperature?: number;
            maxTokens?: number;
        };
        maxCalls?: number;
        requireApproval?: boolean;
        timeout?: number;
    }): Promise<any> {
        return this.createAgent(config);
    }

    async createAgent(config: any): Promise<any> {
        this.assertInitialized();
        return this.withErrorHandling('createAgent', async () => {
            const validation = await this.symphony.validation.validate(config, 'AgentConfig');
            if (!validation.isValid) {
                throw new Error(`Invalid agent configuration: ${validation.errors.join(', ')}`);
            }

            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            const agent = {
                ...config,
                run: async (task: string, options: any = {}) => {
                    const metricId = `agent_${config.name}_run_${Date.now()}`;
                    this.symphony.startMetric(metricId, { agentName: config.name, task, options });

                    try {
                        // Here we would normally have the LLM integration
                        // For now, just use the first tool
                        const tool = config.tools[0];
                        const result = await tool.run({ task });

                        this.symphony.endMetric(metricId, {
                            success: true,
                            result: result.result
                        });

                        return {
                            success: true,
                            result: result.result
                        };
                    } catch (error) {
                        this.symphony.endMetric(metricId, {
                            success: false,
                            error: error instanceof Error ? error.message : String(error)
                        });
                        throw error;
                    }
                }
            };

            registry.registerAgent(config.name, agent);
            this.logInfo(`Created agent: ${config.name}`);
            return agent;
        }, { agentName: config.name });
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