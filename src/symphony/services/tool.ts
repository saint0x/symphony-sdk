import { BaseService } from './base';
import { ToolConfig, ToolResult } from '../../types/sdk';
import { Tool } from '../../types/components';
import { ISymphony } from '../interfaces/types';
import { assertString } from '../../utils/validation';

export class ToolService extends BaseService {
    constructor(symphony: ISymphony) {
        super(symphony, 'ToolService');
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

    async create(config: {
        name: string;
        description: string;
        inputs: string[];
        handler: (params: any) => Promise<ToolResult>;
    }): Promise<Tool> {
        this.assertInitialized();
        return this.withErrorHandling('createTool', async () => {
            const validation = await this.symphony.utils.validation.validateConfig(config, {
                name: { type: 'string', required: true },
                description: { type: 'string', required: true },
                inputs: { type: 'array', required: true },
                handler: { type: 'function', required: true }
            });
            if (!validation.isValid) {
                throw new Error(`Invalid tool configuration: ${validation.errors.join(', ')}`);
            }

            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            const tool: Tool = {
                ...config,
                run: async (params: any) => {
                    const metricId = `tool_${config.name}_run_${Date.now()}`;
                    this.symphony.utils.metrics.start(metricId, { toolName: config.name, params });

                    try {
                        const result = await config.handler(params);
                        this.symphony.utils.metrics.end(metricId, {
                            success: true,
                            result: result.result
                        });
                        return result;
                    } catch (error) {
                        this.symphony.utils.metrics.end(metricId, {
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
            return this.create(config);
        }, { path });
    }

    async loadToolFromString(configStr: string): Promise<Tool> {
        this.assertInitialized();
        assertString(configStr, 'configStr');

        return this.withErrorHandling('loadToolFromString', async () => {
            const config = JSON.parse(configStr);
            return this.create(config);
        }, { configStr });
    }
} 