import { ToolConfig, ToolResult } from '../../types/sdk';
import { Logger } from '../../utils/logger';
import { standardTools } from './index';
import { ContextIntelligenceAPI } from '../../cache/intelligence-api';
import { IDatabaseService } from '../../db/types';
import { LLMFunctionDefinition } from '../../llm/types';

export class ToolRegistry {
    private static instance: ToolRegistry;
    private tools: Map<string, ToolConfig> = new Map();
    private logger: Logger;
    private contextAPI?: ContextIntelligenceAPI;

    constructor() {
        this.logger = Logger.getInstance('ToolRegistry');
        this.initializeStandardTools();
    }

    static getInstance(): ToolRegistry {
        if (!ToolRegistry.instance) {
            ToolRegistry.instance = new ToolRegistry();
        }
        return ToolRegistry.instance;
    }

    /**
     * Initialize Context Intelligence Integration
     */
    initializeContextIntegration(database: IDatabaseService): void {
        this.contextAPI = new ContextIntelligenceAPI(database);
        this.registerContextTools();
        this.logger.info('ToolRegistry', 'ToolRegistry initialized');
    }

    /**
     * Register Context Management Tools - Available to all agents
     */
    private registerContextTools(): void {
        if (!this.contextAPI) return;

        const contextTools: ToolConfig[] = [
            {
                name: 'validateCommandMapUpdate',
                description: 'Validates command map updates for consistency and conflicts',
                type: 'context_management',
                nlp: 'validate command map update for patterns and conflicts',
                config: {
                    handler: async (params: any) => {
                        return await this.contextAPI!.validateCommandMapUpdate(params);
                    }
                }
            },
            {
                name: 'updateLearningContext',
                description: 'Updates learning context based on execution results and feedback',
                type: 'context_management', 
                nlp: 'update learning context with execution results and user feedback',
                config: {
                    handler: async (params: any) => {
                        return await this.contextAPI!.updateLearningContext(params);
                    }
                }
            },
            {
                name: 'executeContextPruning',
                description: 'Prunes old or low-confidence context entries for performance',
                type: 'context_management',
                nlp: 'execute context pruning to remove old or low confidence entries',
                config: {
                    handler: async (params: any) => {
                        return await this.contextAPI!.executeContextPruning(params);
                    }
                }
            },
            {
                name: 'updatePatternStats',
                description: 'Updates pattern usage statistics and performance metrics',
                type: 'context_management',
                nlp: 'update pattern statistics and performance metrics',
                config: {
                    handler: async (params: any) => {
                        return await this.contextAPI!.updatePatternStats(params);
                    }
                }
            },
            {
                name: 'validateContextTreeUpdate',
                description: 'Validates context tree consistency and structure',
                type: 'context_management',
                nlp: 'validate context tree update for consistency and structure',
                config: {
                    handler: async (params: any) => {
                        return await this.contextAPI!.validateContextTreeUpdate(params);
                    }
                }
            }
        ];

        // Register each context tool
        for (const tool of contextTools) {
            this.tools.set(tool.name, tool);
            this.logger.info('ToolRegistry', `Registered context tool: ${tool.name}`, {
                type: tool.type,
                hasNLP: !!tool.nlp
            });
        }

        this.logger.info('ToolRegistry', 'Context management tools registered', {
            toolCount: contextTools.length
        });
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
            'parseDocument': standardTools.find(t => t.name === 'parseDocumentTool')!,
            
            // Code Tools
            'writeCode': standardTools.find(t => t.name === 'writeCodeTool')!,
            
            // Planning Tools
            'createPlan': standardTools.find(t => t.name === 'createPlanTool')!,
            
            // Cognitive Tools
            'ponder': standardTools.find(t => t.name === 'ponderTool')!,

            // Also register by internal names for compatibility
            'readFileTool': standardTools.find(t => t.name === 'readFileTool')!,
            'writeFileTool': standardTools.find(t => t.name === 'writeFileTool')!,
            'webSearchTool': standardTools.find(t => t.name === 'webSearchTool')!,
            'parseDocumentTool': standardTools.find(t => t.name === 'parseDocumentTool')!,
            'writeCodeTool': standardTools.find(t => t.name === 'writeCodeTool')!,
            'createPlanTool': standardTools.find(t => t.name === 'createPlanTool')!,
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

            // Ensure the tool has a handler
            if (!tool.handler) {
                this.logger.error('ToolRegistry', `Tool ${toolName} does not have a handler function defined directly on the tool object.`);
                return {
                    success: false,
                    error: `Tool ${toolName} is not executable (no direct handler).`
                };
            }

            this.logger.info('ToolRegistry', `Executing tool: ${toolName}`, {
                params: params,
                toolType: tool.type
            });

            const startTime = Date.now();
            const result = await tool.handler(params);
            const duration = Date.now() - startTime;

            this.logger.info('ToolRegistry', `Tool execution completed: ${toolName}`, {
                success: result.success,
                duration,
                hasResult: !!result.result,
                hasError: !!result.error
            });

            // Auto-update learning context for non-context-management tools
            if (this.contextAPI && !tool.type.includes('context_management')) {
                try {
                    await this.contextAPI.updateLearningContext({
                        toolName,
                        parameters: params,
                        result: result.result,
                        success: result.success,
                        contextData: {
                            executionTime: duration,
                            toolType: tool.type
                        }
                    });
                } catch (error) {
                    this.logger.warn('ToolRegistry', 'Failed to update learning context', { error, toolName });
                }
            }

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
        const tool = this.tools.get(toolName);
        if (!tool) return null;
        
        // Return the original tool config (no modifications)
        return tool;
    }

    /**
     * Get detailed tool information including parameter metadata
     * Use this for agent intelligence and reflection
     */
    getToolDetails(toolName: string): { 
        config: ToolConfig; 
        parameters: {
            inputs: Array<{ name: string; required?: boolean; type?: string }>;
            outputs: Array<{ name: string; type?: string }>;
        };
    } | null {
        const tool = this.tools.get(toolName);
        if (!tool) return null;
        
        return {
            config: tool,
            parameters: this.extractToolParameters(tool)
        };
    }

    /**
     * Extract tool parameters from config for agent intelligence
     */
    private extractToolParameters(tool: ToolConfig): {
        inputs: Array<{ name: string; required?: boolean; type?: string }>;
        outputs: Array<{ name: string; type?: string }>;
    } {
        const inputs = tool.config.inputs || tool.inputs || [];
        const outputs = tool.config.outputs || tool.outputs || [];
        
        // Convert string arrays to structured format
        return {
            inputs: inputs.map((input: string) => ({
                name: input,
                required: true, // Default to required unless specified otherwise
                type: 'string' // Default type, could be enhanced with schema
            })),
            outputs: outputs.map((output: string) => ({
                name: output,
                type: 'any'
            }))
        };
    }

    /**
     * Get tool metadata optimized for agent reflection
     * This provides instant access to all tool parameters without parsing
     */
    getToolMetadata(toolName?: string): Record<string, any> | any {
        if (toolName) {
            const tool = this.tools.get(toolName);
            if (!tool) return null;
            
            return {
                name: toolName,
                description: tool.description,
                type: tool.type,
                nlp: tool.nlp,
                parameters: this.extractToolParameters(tool),
                capabilities: tool.capabilities || [],
                timeout: tool.timeout,
                hasHandler: !!tool.handler
            };
        }
        
        // Return all tools metadata for agent reflection
        const metadata: Record<string, any> = {};
        for (const [name, tool] of this.tools.entries()) {
            metadata[name] = {
                description: tool.description,
                type: tool.type,
                nlp: tool.nlp,
                parameters: this.extractToolParameters(tool),
                capabilities: tool.capabilities || []
            };
        }
        
        return metadata;
    }

    /**
     * Converts a tool's input parameters into a JSON schema compatible with LLM function definitions.
     */
    private toolParamsToJSONSchema(tool: ToolConfig): { type: 'object'; properties: Record<string, any>; required?: string[] } {
        const details = this.extractToolParameters(tool);
        const properties: Record<string, any> = {};
        const required: string[] = [];

        details.inputs.forEach(input => {
            properties[input.name] = {
                type: input.type || 'string',
                description: `Parameter for ${input.name}`
            };
            if (input.required) {
                required.push(input.name);
            }
        });

        return {
            type: 'object',
            properties,
            ...(required.length > 0 && { required })
        };
    }

    /**
     * Get the LLMFunctionDefinition for a single tool.
     */
    getLLMFunctionDefinition(toolName: string): LLMFunctionDefinition | null {
        const tool = this.tools.get(toolName);
        if (!tool) {
            this.logger.warn('ToolRegistry', `Tool not found for LLMFunctionDefinition: ${toolName}`);
            return null;
        }

        return {
            name: toolName,
            description: tool.description || `Executes the ${toolName} tool.`,
            parameters: this.toolParamsToJSONSchema(tool)
        };
    }

    /**
     * Get LLMFunctionDefinitions for a list of tools.
     */
    getAllLLMFunctionDefinitions(toolNames: string[]): LLMFunctionDefinition[] {
        return toolNames
            .map(toolName => this.getLLMFunctionDefinition(toolName))
            .filter(def => def !== null) as LLMFunctionDefinition[];
    }

    /**
     * Enhanced Tool Registration with Auto-Cache Population
     */
    registerTool(name: string, tool: ToolConfig): void {
        this.tools.set(name, tool);
        
        this.logger.info('ToolRegistry', `Custom tool registered: ${name}`, {
            type: tool.type,
            description: tool.description,
            hasNLP: !!tool.nlp
        });

        // Auto-populate cache if tool has NLP field
        if (tool.nlp && this.contextAPI) {
            this.populateCacheWithNLP(name, tool).catch(error => {
                this.logger.error('ToolRegistry', 'Failed to populate cache with NLP mapping', {
                    error,
                    toolName: name,
                    nlp: tool.nlp
                });
            });
        }
    }

    /**
     * Populate Cache with NLP Mapping - Auto-registers tool patterns
     */
    private async populateCacheWithNLP(toolName: string, tool: ToolConfig): Promise<void> {
        if (!tool.nlp || !this.contextAPI) return;

        try {
            this.logger.info('ToolRegistry', 'Auto-populating cache with NLP mapping', {
                toolName,
                nlp: tool.nlp.substring(0, 50) + '...'
            });

            await this.contextAPI.registerToolNLPMapping(toolName, tool.nlp, {
                toolType: tool.type,
                description: tool.description,
                capabilities: tool.capabilities || [],
                autoRegistered: true,
                registeredAt: new Date().toISOString()
            });

            this.logger.info('ToolRegistry', 'Cache NLP mapping populated successfully', {
                toolName,
                nlpLength: tool.nlp.length
            });

        } catch (error) {
            this.logger.error('ToolRegistry', 'Failed to populate cache with NLP mapping', {
                error,
                toolName,
                nlp: tool.nlp
            });
        }
    }

    /**
     * Get Enhanced Tool List with Full Metadata
     */
    getEnhancedToolList(): Array<ToolConfig & { 
        name: string; 
        registeredAt?: string;
        parameters?: {
            inputs: Array<{ name: string; required?: boolean; type?: string }>;
            outputs: Array<{ name: string; type?: string }>;
        };
    }> {
        return Array.from(this.tools.entries()).map(([name, tool]) => ({
            ...tool,
            name,
            parameters: this.extractToolParameters(tool),
            registeredAt: new Date().toISOString() // Could track actual registration time
        }));
    }

    /**
     * Get Context Management Tools - For agent inspection
     */
    getContextTools(): string[] {
        return Array.from(this.tools.entries())
            .filter(([_, tool]) => tool.type === 'context_management')
            .map(([name, _]) => name);
    }

    /**
     * Initialize All Auto-Population - Called after context integration setup
     */
    async initializeAutoPopulation(): Promise<void> {
        if (!this.contextAPI) {
            this.logger.warn('ToolRegistry', 'Cannot initialize auto-population without context API');
            return;
        }

        this.logger.info('ToolRegistry', 'Initializing auto-population for existing tools');

        let populatedCount = 0;
        for (const [name, tool] of this.tools.entries()) {
            if (tool.nlp) {
                try {
                    await this.populateCacheWithNLP(name, tool);
                    populatedCount++;
                } catch (error) {
                    this.logger.warn('ToolRegistry', 'Failed to auto-populate tool', { error, name });
                }
            }
        }

        this.logger.info('ToolRegistry', 'Auto-population completed', {
            totalTools: this.tools.size,
            populatedTools: populatedCount
        });
    }
} 