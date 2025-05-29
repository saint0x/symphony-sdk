import { ToolConfig, ToolResult } from '../../types/sdk';
import { Logger } from '../../utils/logger';
import { standardTools } from './index';

export class ToolRegistry {
    private static instance: ToolRegistry;
    private tools: Map<string, ToolConfig> = new Map();
    private logger: Logger;

    private constructor() {
        this.logger = Logger.getInstance('ToolRegistry');
        this.initializeStandardTools();
    }

    static getInstance(): ToolRegistry {
        if (!ToolRegistry.instance) {
            ToolRegistry.instance = new ToolRegistry();
        }
        return ToolRegistry.instance;
    }

    private initializeStandardTools(): void {
        // Register all standard tools with user-friendly names
        const toolMappings: Record<string, ToolConfig> = {
            // File System Tools
            'readFile': standardTools.find(t => t.name === 'readFileTool')!,
            'writeFile': standardTools.find(t => t.name === 'writeFileTool')!,
            
            // Search Tools  
            'webSearch': standardTools.find(t => t.name === 'webSearchTool')!,
            
            // Document Tools
            'parseDocument': standardTools.find(t => t.name === 'parseDocument')!,
            
            // Code Tools
            'writeCode': standardTools.find(t => t.name === 'writeCode')!,
            
            // Planning Tools
            'createPlan': standardTools.find(t => t.name === 'createPlan')!,
            
            // Cognitive Tools
            'ponder': standardTools.find(t => t.name === 'ponderTool')!,

            // Also register by internal names for compatibility
            'readFileTool': standardTools.find(t => t.name === 'readFileTool')!,
            'writeFileTool': standardTools.find(t => t.name === 'writeFileTool')!,
            'webSearchTool': standardTools.find(t => t.name === 'webSearchTool')!,
            'parseDocumentTool': standardTools.find(t => t.name === 'parseDocument')!,
            'writeCodeTool': standardTools.find(t => t.name === 'writeCode')!,
            'createPlanTool': standardTools.find(t => t.name === 'createPlan')!,
            'ponderTool': standardTools.find(t => t.name === 'ponderTool')!
        };

        // Register tools and filter out undefined ones
        Object.entries(toolMappings).forEach(([name, tool]) => {
            if (tool) {
                this.tools.set(name, tool);
                this.logger.info('ToolRegistry', `Registered tool: ${name}`, {
                    internalName: tool.name,
                    type: tool.type,
                    description: tool.description
                });
            } else {
                this.logger.warn('ToolRegistry', `Tool not found for mapping: ${name}`);
            }
        });

        this.logger.info('ToolRegistry', 'Standard tools initialized', {
            totalTools: this.tools.size,
            registeredTools: Array.from(this.tools.keys())
        });
    }

    async executeTool(toolName: string, params: any): Promise<ToolResult> {
        try {
            const tool = this.tools.get(toolName);
            if (!tool) {
                return {
                    success: false,
                    error: `Tool '${toolName}' not found. Available tools: ${Array.from(this.tools.keys()).join(', ')}`
                };
            }

            this.logger.info('ToolRegistry', `Executing tool: ${toolName}`, {
                params: params,
                toolType: tool.type
            });

            const startTime = Date.now();
            const result = await tool.config.handler(params);
            const duration = Date.now() - startTime;

            this.logger.info('ToolRegistry', `Tool execution completed: ${toolName}`, {
                success: result.success,
                duration,
                hasResult: !!result.result,
                hasError: !!result.error
            });

            // Add execution metrics
            const enhancedResult = {
                ...result,
                metrics: {
                    duration,
                    startTime,
                    endTime: Date.now()
                }
            };

            return enhancedResult;

        } catch (error) {
            this.logger.error('ToolRegistry', `Tool execution failed: ${toolName}`, { error });
            return {
                success: false,
                error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
                metrics: {
                    duration: 0,
                    startTime: Date.now(),
                    endTime: Date.now()
                }
            };
        }
    }

    getAvailableTools(): string[] {
        return Array.from(this.tools.keys());
    }

    getToolInfo(toolName: string): ToolConfig | null {
        return this.tools.get(toolName) || null;
    }

    registerTool(name: string, tool: ToolConfig): void {
        this.tools.set(name, tool);
        this.logger.info('ToolRegistry', `Custom tool registered: ${name}`, {
            type: tool.type,
            description: tool.description
        });
    }
} 