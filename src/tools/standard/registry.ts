import { ToolResult } from '../../types/sdk';
import { ToolConfig as CoreToolConfig, INlpService } from '../../types/tool.types';
import { Logger } from '../../utils/logger';
import { standardTools } from './index';
import { ContextAPI } from '../../cache/context-api';
import { IDatabaseService } from '../../db/types';
import { LLMFunctionDefinition } from '../../llm/types';
import { ToolUsageVerifier } from '../../utils/verification';

export class ToolRegistry {
    private static instance: ToolRegistry;
    private tools: Map<string, CoreToolConfig> = new Map();
    private logger: Logger;
    private contextAPI?: ContextAPI;

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
        this.contextAPI = new ContextAPI(database);
        this.registerContextTools();
        this.logger.info('ToolRegistry', 'ToolRegistry initialized');
    }

    /**
     * Register Context Management Tools - Available to all agents
     */
    private registerContextTools(): void {
        if (!this.contextAPI) return;

        const contextTools: CoreToolConfig[] = [
            {
                name: 'validateCommandMapUpdate',
                description: 'Validates command map updates for consistency and conflicts',
                type: 'context_management',
                nlp: 'validate command map update for patterns and conflicts',
                handler: async (params: any) => {
                    return await this.contextAPI!.validateCommandMapUpdate(params);
                },
                config: {}
            },
            {
                name: 'updateLearningContext',
                description: 'Updates learning context based on execution results and feedback',
                type: 'context_management', 
                nlp: 'update learning context with execution results and user feedback',
                handler: async (params: any) => {
                    return await this.contextAPI!.updateLearningContext(params);
                },
                config: {}
            },
            {
                name: 'executeContextPruning',
                description: 'Prunes old or low-confidence context entries for performance',
                type: 'context_management',
                nlp: 'execute context pruning to remove old or low confidence entries',
                handler: async (params: any) => {
                    return await this.contextAPI!.executeContextPruning(params);
                },
                config: {}
            },
            {
                name: 'updatePatternStats',
                description: 'Updates pattern usage statistics and performance metrics',
                type: 'context_management',
                nlp: 'update pattern statistics and performance metrics',
                handler: async (params: any) => {
                    return await this.contextAPI!.updatePatternStats(params);
                },
                config: {}
            },
            {
                name: 'validateContextTreeUpdate',
                description: 'Validates context tree consistency and structure',
                type: 'context_management',
                nlp: 'validate context tree update for consistency and structure',
                handler: async (params: any) => {
                    return await this.contextAPI!.validateContextTreeUpdate(params);
                },
                config: {}
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
        const toolMappings: Record<string, CoreToolConfig> = {
            // File System Tools
            'readFile': standardTools.find(t => t.name === 'readFileTool')! as CoreToolConfig,
            'writeFile': standardTools.find(t => t.name === 'writeFileTool')! as CoreToolConfig,
            
            // Search Tools  
            'webSearch': standardTools.find(t => t.name === 'webSearchTool')! as CoreToolConfig,
            
            // Document Tools
            'parseDocument': standardTools.find(t => t.name === 'parseDocumentTool')! as CoreToolConfig,
            
            // Code Tools
            'writeCode': standardTools.find(t => t.name === 'writeCodeTool')! as CoreToolConfig,
            
            // Planning Tools
            'createPlan': standardTools.find(t => t.name === 'createPlanTool')! as CoreToolConfig,
            
            // Cognitive Tools
            'ponder': standardTools.find(t => t.name === 'ponderTool')! as CoreToolConfig,

            // Also register by internal names for compatibility
            'readFileTool': standardTools.find(t => t.name === 'readFileTool')! as CoreToolConfig,
            'writeFileTool': standardTools.find(t => t.name === 'writeFileTool')! as CoreToolConfig,
            'webSearchTool': standardTools.find(t => t.name === 'webSearchTool')! as CoreToolConfig,
            'parseDocumentTool': standardTools.find(t => t.name === 'parseDocumentTool')! as CoreToolConfig,
            'writeCodeTool': standardTools.find(t => t.name === 'writeCodeTool')! as CoreToolConfig,
            'createPlanTool': standardTools.find(t => t.name === 'createPlanTool')! as CoreToolConfig,
            'ponderTool': standardTools.find(t => t.name === 'ponderTool')! as CoreToolConfig
        };

        // Register tools and filter out undefined ones
        Object.entries(toolMappings).forEach(([name, tool]) => {
            if (tool) {
                // Ensure the tool structure conforms to CoreToolConfig, especially the handler.
                // Standard tools might have handler inside a config sub-object.
                const handler = tool.handler || (tool.config as any)?.handler;
                const toolToStore: CoreToolConfig = {
                    ...tool, // Spread existing sdk.ToolConfig properties
                    handler: handler, // Ensure handler is top-level
                    config: tool.config || {} // Ensure config sub-object exists
                };
                if (!toolToStore.handler) {
                    this.logger.warn('ToolRegistry', `Standard tool '${name}' (internal: ${tool.name}) is missing a handler or handler not top-level after mapping. It may not be executable.`);
                }
                this.tools.set(name, toolToStore);
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

            // <<< INTEGRATION START: Input Validation >>>
            if (tool.inputSchema) {
                const validationResult = ToolUsageVerifier.verifyData(params, tool.inputSchema, `${toolName}.inputParams`);
                if (!validationResult.isValid) {
                    this.logger.warn('ToolRegistry', `Input validation failed for tool: ${toolName}`, {
                        errors: validationResult.errors,
                        paramsReceived: params
                    });
                    return {
                        success: false,
                        error: `Input validation failed for ${toolName}: ${validationResult.errors.map(e => `${e.path}: ${e.message}`).join('; ')}`,
                        details: validationResult.errors // Provide detailed errors
                    };
                }
                this.logger.info('ToolRegistry', `Input validated successfully for tool: ${toolName}`);
            }
            // <<< INTEGRATION END: Input Validation >>>

            // Ensure the tool has a handler
            if (!tool.handler) {
                this.logger.error('ToolRegistry', `Tool ${toolName} does not have a handler function.`);
                return {
                    success: false,
                    error: `Tool ${toolName} is not executable (no handler).`
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
            if (this.contextAPI && tool.type !== 'context_management') {
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

    getToolInfo(toolName: string): CoreToolConfig | null {
        const tool = this.tools.get(toolName);
        return tool || null;
    }

    /**
     * Get detailed tool information including parameter metadata
     * Use this for agent intelligence and reflection
     */
    getToolDetails(toolName: string): { 
        config: CoreToolConfig; 
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
    private extractToolParameters(tool: CoreToolConfig): {
        inputs: Array<{ name: string; required?: boolean; type?: string }>;
        outputs: Array<{ name: string; type?: string }>;
    } {
        const inputs = tool.config?.inputs || tool.inputs || [];
        const outputs = tool.config?.outputs || tool.outputs || [];
        
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
    private toolParamsToJSONSchema(tool: CoreToolConfig): { type: 'object'; properties: Record<string, any>; required?: string[] } {
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
    registerTool(name: string, tool: CoreToolConfig): void {
        // Ensure handler is top-level, and config sub-object is present.
        const handler = tool.handler || (tool.config as any)?.handler;
        const toolToStore: CoreToolConfig = {
            ...tool,
            handler: handler,
            config: tool.config || {}
        };
        if (!toolToStore.handler) {
             this.logger.warn('ToolRegistry', `Tool '${name}' being registered is missing a handler or handler not top-level. It may not be executable.`);
        }

        this.tools.set(name, toolToStore);
        this.logger.info('ToolRegistry', `Custom tool registered: ${name}`, {
            type: toolToStore.type,
            description: toolToStore.description,
            hasNLP: !!toolToStore.nlp
        });
    }

    /**
     * Get Enhanced Tool List with Full Metadata
     */
    getEnhancedToolList(): Array<CoreToolConfig & { 
        name: string; 
        registeredAt?: string;
        parameters?: {
            inputs: Array<{ name: string; required?: boolean; type?: string }>;
            outputs: Array<{ name: string; type?: string }>;
        };
    }> {
        return Array.from(this.tools.entries()).map(([name, tool]) => ({
            ...(tool as CoreToolConfig), // Cast to CoreToolConfig
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
     * REVISED: This method now leverages NlpService to load all persisted, active NLP patterns 
     * into the runtime memory (e.g., ContextIntelligenceAPI command map).
     * It should be called during Symphony SDK initialization.
     * @param nlpService An instance of INlpService.
     */
    async initializeAutoPopulation(nlpService: INlpService): Promise<void> {
        this.logger.info('ToolRegistry', 'Initializing runtime loading of all persisted NLP patterns via NlpService.');
        if (!this.contextAPI) {
            this.logger.warn('ToolRegistry', 'Cannot initialize runtime NLP patterns as ContextIntelligenceAPI (via this.contextAPI) is not available. This is unexpected if context integration was initialized.');
            return;
        }
        if (!nlpService) {
            this.logger.error('ToolRegistry', 'NlpService instance was not provided to initializeAutoPopulation. Cannot load persisted NLP patterns.');
            return;
        }

        try {
            const result = await nlpService.loadAllPersistedPatternsToRuntime();
            this.logger.info('ToolRegistry', 'NlpService finished loading persisted patterns to runtime.', {
                loaded: result.loaded,
                failed: result.failed,
                errors: result.errors.length > 0 ? result.errors : undefined
            });
        } catch (error) {
            this.logger.error('ToolRegistry', 'Error during NlpService.loadAllPersistedPatternsToRuntime call from initializeAutoPopulation.', { error });
        }
    }
} 