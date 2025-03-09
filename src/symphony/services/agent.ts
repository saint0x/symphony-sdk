import { ISymphony } from '../../types/symphony';
import { BaseManager } from '../../managers/base';
import { AgentConfig } from '../../types/sdk';
import { ServiceConfig } from '../../proto/symphonic/core/types';

interface RunableTool {
    run(input: any): Promise<any>;
}

export class AgentService extends BaseManager {
    constructor(symphony: ISymphony) {
        super(symphony as any, 'AgentService');
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

    async createAgent(config: AgentConfig): Promise<any> {
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
                run: async (task: string) => {
                    const metricId = `agent_${config.name}_run_${Date.now()}`;
                    this.symphony.startMetric(metricId, { agentName: config.name, task });

                    try {
                        // Here we would normally have the LLM integration
                        // For now, just use the first tool
                        if (!config.tools.length) {
                            throw new Error('No tools available for agent');
                        }

                        const tool = config.tools[0] as unknown as RunableTool;
                        if (!tool || typeof tool !== 'object' || !('run' in tool)) {
                            throw new Error('Invalid tool: missing run method');
                        }

                        const result = await tool.run({ task });
                        const response = {
                            success: true,
                            result: result.result || result
                        };

                        this.symphony.endMetric(metricId, response);
                        return response;
                    } catch (error) {
                        const errorResponse = {
                            success: false,
                            error: error instanceof Error ? error.message : String(error)
                        };
                        this.symphony.endMetric(metricId, errorResponse);
                        throw error;
                    }
                }
            };

            // Register the agent as a service
            registry.registerService({
                metadata: {
                    id: config.name,
                    name: config.name,
                    version: '1.0.0',
                    type: 'AGENT',
                    status: 'ACTIVE',
                    description: config.description || '',
                    customMetadata: config
                },
                methods: {
                    run: config.handler
                }
            } as ServiceConfig);

            this.logInfo(`Created agent: ${config.name}`);
            return agent;
        }, { agentName: config.name });
    }
} 