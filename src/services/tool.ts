import { ISymphony } from './interfaces';
import { BaseManager } from '../managers/base';
import { IToolService } from './interfaces';

export class ToolService extends BaseManager implements IToolService {
    constructor(symphony: ISymphony) {
        super(symphony as any, 'ToolService');
    }

    async create(config: {
        name: string;
        description: string;
        inputs: string[];
        handler: (params: any) => Promise<any>;
    }): Promise<any> {
        return this.createTool(config);
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

    async createTool(config: any): Promise<any> {
        this.assertInitialized();
        return this.withErrorHandling('createTool', async () => {
            const validation = await this.symphony.validation.validate(config, 'ToolConfig');
            if (!validation.isValid) {
                throw new Error(`Invalid tool configuration: ${validation.errors.join(', ')}`);
            }

            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            const tool = {
                ...config,
                run: async (params: any) => {
                    const metricId = `tool_${config.name}_run_${Date.now()}`;
                    this.symphony.startMetric(metricId, { toolName: config.name, params });

                    try {
                        const result = await config.handler(params);
                        this.symphony.endMetric(metricId, {
                            success: true,
                            result: result.result
                        });
                        return result;
                    } catch (error) {
                        this.symphony.endMetric(metricId, {
                            success: false,
                            error: error instanceof Error ? error.message : String(error)
                        });
                        throw error;
                    }
                }
            };

            registry.registerTool(config.name, tool);
            this.logInfo(`Created tool: ${config.name}`);
            return tool;
        }, { toolName: config.name });
    }
} 