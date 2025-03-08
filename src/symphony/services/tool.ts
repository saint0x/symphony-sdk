import { ISymphony } from '../interfaces/types';
import { BaseManager } from '../../managers/base';
import { Tool } from '../../types/components';
import { assertString } from '../../utils/validation';

export class ToolService extends BaseManager {
    constructor(symphony: ISymphony) {
        super(symphony as any, 'ToolService');
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

    async createTool(config: any): Promise<Tool> {
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

    async loadTool(path: string): Promise<Tool> {
        this.assertInitialized();
        assertString(path, 'path');

        return this.withErrorHandling('loadTool', async () => {
            const config = await import(path);
            return this.createTool(config);
        }, { path });
    }

    async loadToolFromString(configStr: string): Promise<Tool> {
        this.assertInitialized();
        assertString(configStr, 'configStr');

        return this.withErrorHandling('loadToolFromString', async () => {
            const config = JSON.parse(configStr);
            return this.createTool(config);
        }, { configStr });
    }
} 