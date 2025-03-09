import { ISymphony } from '../../types/symphony';
import { BaseManager } from '../../managers/base';
import { Tool } from '../../types/sdk';
import { assertString } from '../../utils/validation';
import { ServiceConfig } from '../../proto/symphonic/core/types';
import { standardTools } from '../../tools/standard';
import { IToolService } from '../../services/interfaces';
import { ToolLifecycleState } from '../../types/sdk';

export class ToolService extends BaseManager implements IToolService {
    private standardToolsRegistered = false;
    private _state: ToolLifecycleState = ToolLifecycleState.PENDING;
    private tools = new Map<string, Tool>();

    constructor(symphony: ISymphony) {
        super(symphony as any, 'ToolService');
        
        // Register standard tools immediately
        this.registerStandardToolsSync();
        this._state = ToolLifecycleState.READY;
    }

    get state(): ToolLifecycleState {
        return this._state;
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

    private registerStandardToolsSync(): void {
        if (this.standardToolsRegistered) {
            return;
        }

        this.logInfo('Registering standard tools...');
        for (const toolConfig of standardTools) {
            try {
                const tool: Tool = {
                    name: toolConfig.name,
                    description: toolConfig.description || '',
                    state: ToolLifecycleState.READY,
                    run: async (params: any) => {
                        const metricId = `tool_${toolConfig.name}_run_${Date.now()}`;
                        this.symphony.startMetric(metricId, { toolName: toolConfig.name, params });

                        try {
                            const result = await toolConfig.config.handler(params);
                            if (!result.success) {
                                this.symphony.endMetric(metricId, {
                                    success: false,
                                    error: result.error
                                });
                                return result;
                            }

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
                            return {
                                success: false,
                                error: error instanceof Error ? error.message : String(error)
                            };
                        }
                    }
                };

                this.tools.set(toolConfig.name, tool);
                this.logInfo(`Registered standard tool: ${toolConfig.name}`);
            } catch (error) {
                this.logError(`Failed to register standard tool ${toolConfig.name}`, error);
            }
        }
        this.standardToolsRegistered = true;
        this.logInfo(`Registered ${standardTools.length} standard tools`);
    }

    async listStandardTools(): Promise<string[]> {
        return standardTools.map(tool => tool.name);
    }

    async listTools(): Promise<string[]> {
        return Array.from(this.tools.keys());
    }

    async getTool(name: string): Promise<Tool> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool ${name} not found`);
        }
        return tool;
    }

    async createTool(name: string, config: any): Promise<Tool> {
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

            const tool: Tool = {
                name,
                description: config.description || '',
                state: ToolLifecycleState.READY,
                run: async (params: any) => {
                    const metricId = `tool_${name}_run_${Date.now()}`;
                    this.symphony.startMetric(metricId, { toolName: name, params });

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

            // Register the tool as a service
            registry.registerService({
                metadata: {
                    id: name,
                    name,
                    version: '1.0.0',
                    type: 'TOOL',
                    status: 'ACTIVE',
                    description: config.description || '',
                    inputParams: config.inputs?.map((input: string) => ({
                        name: input,
                        required: true,
                        description: ''
                    })),
                    customMetadata: config
                },
                methods: {
                    run: config.handler
                }
            } as ServiceConfig);

            this.tools.set(name, tool);
            this.logInfo(`Created tool: ${name}`);
            return tool;
        }, { toolName: name });
    }

    async loadTool(path: string): Promise<Tool> {
        this.assertInitialized();
        assertString(path, 'path');

        return this.withErrorHandling('loadTool', async () => {
            const config = await import(path);
            return this.createTool(config.name, config);
        }, { path });
    }

    async loadToolFromString(configStr: string): Promise<Tool> {
        this.assertInitialized();
        assertString(configStr, 'configStr');

        return this.withErrorHandling('loadToolFromString', async () => {
            const config = JSON.parse(configStr);
            return this.createTool(config.name, config);
        }, { configStr });
    }

    getDependencies(): string[] {
        return [];
    }
} 