import { BaseService } from './base';
import { ISymphony } from '../types/symphony';
import { ToolLifecycleState } from '../types/lifecycle';
import { IToolService } from '../types/interfaces';
import { Tool, ToolConfig, ToolLifecycleState as SDKToolLifecycleState } from '../types/sdk';

export class ToolService extends BaseService implements IToolService {
    private tools: Map<string, Tool> = new Map();

    constructor(symphony: ISymphony) {
        super(symphony, 'ToolService');
        this._dependencies = ['ValidationService'];
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return this._dependencies;
    }

    async createTool(name: string, config: ToolConfig): Promise<Tool> {
        return this.withErrorHandling('createTool', async () => {
            this.assertInitialized();
            
            if (this.tools.has(name)) {
                throw new Error(`Tool ${name} already exists`);
            }

            // Validate tool config
            await this.symphony.validation.validate(config, 'tool');

            const tool: Tool = {
                name,
                description: config.description || `Tool ${name}`,
                state: SDKToolLifecycleState.PENDING,
                run: async (input: any) => {
                    const startTime = Date.now();
                    try {
                        // Execute tool logic
                        const result = await this.executeTool(input);
                        return {
                            success: true,
                            result,
                            metrics: {
                                duration: Date.now() - startTime,
                                startTime,
                                endTime: Date.now()
                            }
                        };
                    } catch (error) {
                        return {
                            success: false,
                            error: error instanceof Error ? error.message : String(error),
                            metrics: {
                                duration: Date.now() - startTime,
                                startTime,
                                endTime: Date.now()
                            }
                        };
                    }
                }
            };

            this.tools.set(name, tool);
            return tool;
        });
    }

    async getTool(name: string): Promise<Tool> {
        return this.withErrorHandling('getTool', async () => {
            this.assertInitialized();
            
            const tool = this.tools.get(name);
            if (!tool) {
                throw new Error(`Tool ${name} not found`);
            }
            return tool;
        });
    }

    async listTools(): Promise<string[]> {
        return this.withErrorHandling('listTools', async () => {
            this.assertInitialized();
            return Array.from(this.tools.keys());
        });
    }

    protected async initializeInternal(): Promise<void> {
        this.logInfo('Initializing tool service');
        this._state = ToolLifecycleState.READY;
    }

    private async executeTool(input: any): Promise<any> {
        // Implement tool-specific logic here
        // This is where you would handle different tool types and their execution
        throw new Error(`Tool execution not implemented for input: ${JSON.stringify(input)}`);
    }
} 