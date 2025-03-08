import { ISymphony } from './interfaces';
import { BaseManager } from '../managers/base';
import { IAgentService } from './interfaces';

export class AgentService extends BaseManager implements IAgentService {
    constructor(symphony: ISymphony) {
        super(symphony as any, 'AgentService');
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

    async initialize(): Promise<void> {
        if (this.initialized) {
            this.logInfo('Already initialized');
            return;
        }

        await this.initializeInternal();
        this.initialized = true;
        this.logInfo('Initialization complete');
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
} 