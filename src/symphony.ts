import { ISymphony, SymphonyConfig, IMetricsAPI } from './types/symphony';
import { ToolLifecycleState, AgentConfig, TeamConfig, PipelineConfig, Pipeline } from './types/sdk';
import { IToolService, IAgentService, ITeamService, IPipelineService, IValidationManager } from './types/interfaces';
import { Logger } from './utils/logger';
import { LLMHandler } from './llm/handler';
// @ts-ignore
import { LLMConfig as RichLLMConfig, LLMFunctionDefinition } from './llm/types';
import { IDatabaseService } from './db/types';
import { DatabaseService } from './db/service';
import { Cache } from './cache';
import { IntelligenceOptions, IntelligenceResult, CacheIntelligenceService } from './cache/service';
import { MemoryService, MemoryQuery, MemoryEntry, AggregationResult, MemoryStats, MemoryConfig as InternalMemoryConfig } from './memory/service';
import { Memory, LegacyMemory } from './memory';
import { StreamingService, StreamingConfig, ProgressUpdate, StreamOptions, StreamingStats } from './streaming/service';
import { ToolRegistry } from './tools/standard/registry';
import { PipelineExecutor, PipelineDefinition, PipelineStepDefinition } from './pipelines/executor';
import { TeamCoordinator } from './teams/coordinator';
import { AgentExecutor } from './agents/executor';
// import { envConfig } from './utils/env';

// Service wrapper interfaces for internal services that don't need to extend IService
export interface IDatabaseServiceWrapper {
    create(config: any): Promise<any>;
    initialize(): Promise<void>;
}

export interface ICacheService {
    get(key: string, namespace?: string): Promise<any>;
    set(key: string, value: any, ttl?: number, namespace?: string): Promise<void>;
    delete(key: string, namespace?: string): Promise<void>;
    has(key: string, namespace?: string): Promise<boolean>;
    clear(namespace?: string): Promise<void>;
    getIntelligence(userInput: string, options?: IntelligenceOptions): Promise<IntelligenceResult>;
    recordToolExecution(
        sessionId: string,
        toolName: string,
        parameters: Record<string, any>,
        result: any,
        success: boolean,
        executionTime: number,
        patternId?: string
    ): Promise<void>;
    getPatternAnalytics(): Promise<any>;
    getContextAnalytics(): Promise<any>;
    getGlobalStats(): any;
    getSessionIntelligence(sessionId: string): any;
    clearCaches(): void;
    healthCheck(): Promise<any>;
    initialize(options?: IntelligenceOptions): Promise<void>;
}

export interface IMemoryService {
    store(key: string, value: any, type?: 'short_term' | 'long_term', options?: any): Promise<void>;
    retrieve(key: string, type?: 'short_term' | 'long_term', options?: any): Promise<any>;
    search(query: MemoryQuery): Promise<MemoryEntry[]>;
    delete(key: string, type?: 'short_term' | 'long_term', namespace?: string): Promise<boolean>;
    clear(type?: 'short_term' | 'long_term', namespace?: string): Promise<number>;
    aggregate(query: MemoryQuery): Promise<AggregationResult>;
    getStats(): Promise<MemoryStats>;
    getOperationalStats(): any;
    healthCheck(): Promise<any>;
    initialize(config?: InternalMemoryConfig): Promise<void>;
    createMemoryInstance(sessionId?: string, namespace?: string): Memory;
}

export interface IStreamingService {
    createStream(options: StreamOptions): string;
    updateProgress(streamId: string, progress: Partial<ProgressUpdate>): void;
    completeStream(streamId: string, finalData?: any): void;
    errorStream(streamId: string, error: Error): void;
    subscribe(streamId: string, callback: (update: ProgressUpdate) => void): () => void;
    getActiveStreams(): string[];
    getStreamStatus(streamId: string): any;
    getStats(): StreamingStats;
    healthCheck(): Promise<any>;
    initialize(config?: StreamingConfig): Promise<void>;
}

// Service implementations
class ToolService implements IToolService {
    private toolRegistry: ToolRegistry;
    private logger: Logger;
    private _state: ToolLifecycleState = ToolLifecycleState.READY;

    constructor(toolRegistry: ToolRegistry) {
        this.toolRegistry = toolRegistry;
        this.logger = Logger.getInstance('ToolService');
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return ['ToolRegistry'];
    }

    async create(config: any): Promise<any> {
        this.logger.info('ToolService', `Creating tool: ${config.name}`);
        
        const toolHandler = config.handler || (() => Promise.resolve({ success: true, result: null }));

        // Construct the object to be registered, adhering to ToolConfig structure
        const toolToRegister = {
            name: config.name,
            description: config.description || '',
            type: config.type || 'custom',
            
            // Critical: handler at the top level
            handler: toolHandler,

            // Pass through other standard top-level ToolConfig properties from user input
            nlp: config.nlp,
            apiKey: config.apiKey,
            timeout: config.timeout,
            retryCount: config.retryCount,
            maxSize: config.maxSize,
            inputs: config.inputs,
            outputs: config.outputs,
            capabilities: config.capabilities,

            // The nested 'config' property should be what the user provided in *their* 'config.config' (if any)
            // This is for additional/custom settings, not for handler, inputs, outputs etc. if they have top-level spots.
            config: config.config || {}
        };

        this.toolRegistry.registerTool(config.name, toolToRegister);

        // Return tool object with consistent API
        const toolObject = {
            name: config.name,
            run: async (params: any) => {
                this.logger.info('ToolService', `Tool ${config.name} executing with params`, {
                    hasParams: !!params,
                    paramKeys: params ? Object.keys(params) : []
                });
                return await this.toolRegistry.executeTool(config.name, params);
            },
            getInfo: () => this.toolRegistry.getToolInfo(config.name),
            // Expose the original user-provided config structure for transparency, 
            // even though the registry uses the transformed 'toolToRegister' structure.
            config: config 
        };

        this.logger.info('ToolService', `Tool created and registered: ${config.name}`);
        return toolObject;
    }

    async execute(toolName: string, params: any): Promise<any> {
        this.logger.info('ToolService', `Executing tool: ${toolName}`, { params });
        return await this.toolRegistry.executeTool(toolName, params);
    }

    getAvailable(): string[] {
        return this.toolRegistry.getAvailableTools();
    }

    getInfo(toolName: string): any {
        return this.toolRegistry.getToolInfo(toolName);
    }

    register(name: string, tool: any): void {
        this.logger.info('ToolService', `Registering tool: ${name}`);
        this.toolRegistry.registerTool(name, tool);
    }
    
    async initialize(): Promise<void> {
        this.logger.info('ToolService', 'Tool service initialized');
    }

    get registry(): ToolRegistry {
        return this.toolRegistry;
    }
}

class AgentService implements IAgentService {
    private toolRegistry: ToolRegistry;
    private agents: Map<string, AgentExecutor> = new Map();
    private _state: ToolLifecycleState = ToolLifecycleState.READY;

    constructor(toolRegistry: ToolRegistry) {
        this.toolRegistry = toolRegistry;
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return ['ToolRegistry'];
    }

    async create(config: AgentConfig): Promise<AgentExecutor> {
        // Auto-add context management tools to all agents
        const contextTools = this.toolRegistry.getContextTools();
        const enhancedConfig = {
            ...config,
            tools: [...(config.tools || []), ...contextTools]
        };

        // Create an actual AgentExecutor instance with LLM capabilities and the correct ToolRegistry
        const agentExecutor = new AgentExecutor(enhancedConfig, this.toolRegistry);
        
        this.agents.set(agentExecutor.name, agentExecutor);
        
        return agentExecutor;
    }
    
    async initialize(): Promise<void> {
        // Simple initialization
    }

    async get(name: string): Promise<AgentExecutor | undefined> {
        return this.agents.get(name);
    }
}

class TeamService implements ITeamService {
    private teams: Map<string, TeamCoordinator> = new Map();
    private logger: Logger;
    private toolRegistry: ToolRegistry;
    private _state: ToolLifecycleState = ToolLifecycleState.READY;

    constructor(toolRegistry: ToolRegistry) {
        this.logger = Logger.getInstance('TeamService');
        this.toolRegistry = toolRegistry;
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return ['ToolRegistry'];
    }

    async create(config: TeamConfig): Promise<TeamCoordinator> {
        this.logger.info('TeamService', `Creating team: ${config.name}`, {
            agentCount: config.agents?.length || 0,
            strategy: config.strategy?.name || 'default'
        });

        // Create TeamCoordinator instance with shared ToolRegistry
        const teamCoordinator = new TeamCoordinator(config, this.toolRegistry);
        
        // Initialize the team
        await teamCoordinator.initialize();
        
        // Store for management
        this.teams.set(config.name, teamCoordinator);

        return teamCoordinator;
    }
    
    async initialize(): Promise<void> {
        this.logger.info('TeamService', 'Team service initialized');
    }

    async get(name: string): Promise<TeamCoordinator | undefined> {
        return this.teams.get(name);
    }

    async shutdown(): Promise<void> {
        this.logger.info('TeamService', `Shutting down ${this.teams.size} teams`);
        
        const shutdownPromises = Array.from(this.teams.values()).map(team => team.shutdown());
        await Promise.all(shutdownPromises);
        
        this.teams.clear();
        this.logger.info('TeamService', 'All teams shut down successfully');
    }

    getTeams(): string[] {
        return Array.from(this.teams.keys());
    }
}

class PipelineService implements IPipelineService {
    private pipelines: Map<string, PipelineExecutor> = new Map();
    private logger: Logger;
    private agentService: IAgentService;
    private teamService: ITeamService;
    private _state: ToolLifecycleState = ToolLifecycleState.READY;

    constructor(agentService: IAgentService, teamService: ITeamService) {
        this.logger = Logger.getInstance('PipelineService');
        this.agentService = agentService;
        this.teamService = teamService;
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return ['AgentService', 'TeamService'];
    }

    async create(config: PipelineConfig): Promise<Pipeline> {
        this.logger.info('PipelineService', `Creating pipeline: ${config.name}`, {
            stepCount: config.steps?.length || 0,
            version: (config as any).version || '1.0.0'
        });

        // DIAGNOSTIC LOG: Log the source agent steps from PipelineConfig
        config.steps.forEach((sourceStep, index) => {
            if (sourceStep.type === 'agent') {
                this.logger.debug('PipelineService', `Source PipelineConfig step [${index}] (${sourceStep.name}):`, {
                    name: sourceStep.name,
                    type: sourceStep.type,
                    agent: sourceStep.agent,
                    tool: sourceStep.tool,
                    inputMapIsFunction: typeof sourceStep.inputMap === 'function',
                    rawAgentPropType: typeof sourceStep.agent
                });
            }
        });

        const definition: PipelineDefinition = {
            id: (config as any).id || `pipeline_${Date.now()}`,
            name: config.name,
            description: config.description || `Pipeline: ${config.name}`,
            version: (config as any).version || '1.0.0',
            steps: config.steps.map((step, index) => {
                const mappedStep = {
                    ...step,
                    id: step.name
                };
                this.logger.debug('PipelineService', `Intermediate mapped step [${index}] (${mappedStep.id}) for PipelineDefinition (after spread):`, {
                    id: mappedStep.id,
                    name: mappedStep.name,
                    type: mappedStep.type,
                    agent: mappedStep.agent,
                    tool: mappedStep.tool,
                    inputMapIsFunction: typeof mappedStep.inputMap === 'function',
                    originalStepAgent: step.agent,
                    mappedStepAgentPropType: typeof mappedStep.agent
                });
                return mappedStep;
            }) as PipelineStepDefinition[],
            variables: (config as any).variables,
            errorHandling: (config as any).errorHandling,
            concurrency: (config as any).concurrency
        };

        this.logger.debug('PipelineService', 'Final PipelineDefinition steps for PipelineExecutor:', {
            pipelineId: definition.id,
            pipelineName: definition.name,
            steps: definition.steps.map(s => ({ id: s.id, type: s.type, agent: s.agent, tool: s.tool, name: s.name, inputMapIsFunction: typeof s.inputMap === 'function' }))
        });

        const pipelineExecutor = new PipelineExecutor(definition, this.agentService, this.teamService);
        
        this.pipelines.set(config.name, pipelineExecutor);

        return {
            name: config.name,
            description: config.description || '',
            state: ToolLifecycleState.READY,
            steps: config.steps,
            run: async (input?: any) => {
                this.logger.info('PipelineService', `Pipeline ${config.name} executing with input`, {
                    hasInput: !!input,
                    inputKeys: input ? Object.keys(input) : []
                });
                return await pipelineExecutor.execute(input);
            },
            getStatus: () => pipelineExecutor.getPipelineStatus(),
            executor: pipelineExecutor
        } as Pipeline;
    }
    
    async initialize(): Promise<void> {
        this.logger.info('PipelineService', 'Pipeline service initialized');
    }

    async shutdown(): Promise<void> {
        this.logger.info('PipelineService', `Shutting down ${this.pipelines.size} pipelines`);
        this.pipelines.clear();
        this.logger.info('PipelineService', 'All pipelines shut down successfully');
    }

    getPipelines(): string[] {
        return Array.from(this.pipelines.keys());
    }

    getPipeline(name: string): PipelineExecutor | undefined {
        return this.pipelines.get(name);
    }
}

class ValidationService implements IValidationManager {
    private _state: ToolLifecycleState = ToolLifecycleState.READY;

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return [];
    }

    async validate(config: any, _type: string): Promise<{ isValid: boolean; errors: string[] }> {
        // Simple validation - just check if config has a name
        if (!config || !config.name) {
            return { isValid: false, errors: ['Config must have a name'] };
        }
        return { isValid: true, errors: [] };
    }
    
    async initialize(): Promise<void> {
        // Simple initialization
    }
}

class MetricsService implements IMetricsAPI {
    readonly startTime = Date.now();
    private metrics = new Map<string, any>();
    
    start(id: string, metadata?: Record<string, any>): void {
        this.metrics.set(id, { startTime: Date.now(), metadata });
    }
    
    end(id: string, metadata?: Record<string, any>): void {
        const existing = this.metrics.get(id) || {};
        this.metrics.set(id, { ...existing, endTime: Date.now(), metadata });
    }
    
    get(id: string): any {
        return this.metrics.get(id);
    }
    
    update(id: string, metadata: Record<string, any>): void {
        const existing = this.metrics.get(id) || {};
        this.metrics.set(id, { ...existing, metadata: { ...existing.metadata, ...metadata } });
    }
    
    getAll(): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [key, value] of this.metrics.entries()) {
            result[key] = value;
        }
        return result;
    }
}

class DatabaseServiceWrapper implements IDatabaseServiceWrapper {
    private databaseService: DatabaseService;
    private logger: Logger;

    constructor(config?: any) {
        this.databaseService = new DatabaseService(config?.db);
        this.logger = Logger.getInstance('DatabaseServiceWrapper');
    }

    async create(config: any): Promise<any> {
        this.logger.info('DatabaseServiceWrapper', 'Database create operation called', {
            operation: config.operation || 'unknown',
            table: config.table
        });

        // For compatibility with existing API pattern, return the database service itself
        // Users can access full functionality via symphony.db
        return {
            name: config.name || 'database',
            service: this.databaseService
        };
    }

    async initialize(): Promise<void> {
        this.logger.info('DatabaseServiceWrapper', 'Initializing database service');
        // Database initialization happens in the main Symphony class
    }

    // Expose the full database service
    getService(): IDatabaseService {
        return this.databaseService;
    }
}

class CacheServiceWrapper implements ICacheService {
    private cacheIntelligence: CacheIntelligenceService;
    private legacyCache: Cache;
    private logger: Logger;
    private initialized: boolean = false;

    constructor(database: IDatabaseService) {
        this.logger = Logger.getInstance('CacheServiceWrapper');
        this.cacheIntelligence = CacheIntelligenceService.getInstance(database);
        this.legacyCache = new Cache();
        this.legacyCache.setDatabase(database);
    }

    // Legacy cache methods for backward compatibility
    async get(key: string, namespace?: string): Promise<any> {
        return await this.legacyCache.get(key, namespace);
    }

    async set(key: string, value: any, ttl?: number, namespace?: string): Promise<void> {
        return await this.legacyCache.set(key, value, ttl, namespace);
    }

    async delete(key: string, namespace?: string): Promise<void> {
        return await this.legacyCache.delete(key, namespace);
    }

    async has(key: string, namespace?: string): Promise<boolean> {
        return await this.legacyCache.has(key, namespace);
    }

    async clear(namespace?: string): Promise<void> {
        return await this.legacyCache.clear(namespace);
    }

    // Cache intelligence methods
    async getIntelligence(userInput: string, options?: IntelligenceOptions): Promise<IntelligenceResult> {
        if (!this.initialized) {
            this.logger.warn('CacheServiceWrapper', 'Cache intelligence not initialized, using fallback');
            return this.createFallbackIntelligence(userInput);
        }

        try {
            return await this.cacheIntelligence.getIntelligence(userInput, options);
        } catch (error) {
            this.logger.error('CacheServiceWrapper', 'Failed to get intelligence', { error, userInput });
            return this.createFallbackIntelligence(userInput);
        }
    }

    async recordToolExecution(
        sessionId: string,
        toolName: string,
        parameters: Record<string, any>,
        result: any,
        success: boolean,
        executionTime: number,
        patternId?: string
    ): Promise<void> {
        if (!this.initialized) {
            this.logger.warn('CacheServiceWrapper', 'Cache intelligence not initialized, skipping tool execution recording');
            return;
        }

        try {
            await this.cacheIntelligence.recordToolExecution(
                sessionId, toolName, parameters, result, success, executionTime, patternId
            );
        } catch (error) {
            this.logger.error('CacheServiceWrapper', 'Failed to record tool execution', { error, toolName });
        }
    }

    async getPatternAnalytics(): Promise<any> {
        if (!this.initialized) return { totalPatterns: 0, averageConfidence: 0, topPatterns: [] };
        return await this.cacheIntelligence.getPatternAnalytics();
    }

    getPatterns(): any[] {
        if (!this.initialized) return [];
        return this.cacheIntelligence.getCommandMapProcessor().getPatterns();
    }

    async getContextAnalytics(): Promise<any> {
        if (!this.initialized) return { cacheStats: { size: 0, maxSize: 0 } };
        return await this.cacheIntelligence.getContextAnalytics();
    }

    getGlobalStats(): any {
        if (!this.initialized) return { totalQueries: 0, fastPathQueries: 0, sessions: 0 };
        return this.cacheIntelligence.getGlobalStats();
    }

    getSessionIntelligence(sessionId: string): any {
        if (!this.initialized) return undefined;
        return this.cacheIntelligence.getSessionIntelligence(sessionId);
    }

    clearCaches(): void {
        if (this.initialized) {
            this.cacheIntelligence.clearCaches();
        }
        this.logger.info('CacheServiceWrapper', 'Cleared all caches');
    }

    async healthCheck(): Promise<any> {
        if (!this.initialized) {
            return {
                status: 'unhealthy',
                services: { initialized: false },
                performance: {}
            };
        }
        return await this.cacheIntelligence.healthCheck();
    }

    async initialize(options?: IntelligenceOptions): Promise<void> {
        if (this.initialized) return;

        this.logger.info('CacheServiceWrapper', 'Initializing cache intelligence service');

        try {
            // Default options with paths to XML and JSON files
            const defaultOptions: IntelligenceOptions = {
                enablePatternMatching: true,
                enableContextTrees: true,
                fastPathThreshold: 0.85,
                contextMaxNodes: 50,
                xmlPatternPath: options?.xmlPatternPath || 'src/cache/command-map.xml',
                contextTemplatePath: options?.contextTemplatePath || 'src/cache/context-tree.json',
                ...options
            };

            await this.cacheIntelligence.initialize(defaultOptions);
            this.initialized = true;

            this.logger.info('CacheServiceWrapper', 'Cache intelligence service initialized successfully');
        } catch (error) {
            this.logger.error('CacheServiceWrapper', 'Failed to initialize cache intelligence', { error });
            // Don't throw - allow Symphony to continue with basic cache functionality
        }
    }

    private createFallbackIntelligence(_userInput: string): IntelligenceResult {
        return {
            recommendation: {
                action: 'standard_path',
                confidence: 0.1,
                reasoning: 'Cache intelligence not available, using standard path',
                contextPriority: 'low'
            },
            performance: {
                totalTime: 0,
                patternMatchTime: 0,
                contextBuildTime: 0,
                cacheHits: 0,
                cacheMisses: 1
            },
            metadata: {
                timestamp: new Date(),
                serviceVersion: '1.0.0',
                featuresUsed: ['fallback']
            }
        };
    }

    getStats() {
        return {
            legacyCache: this.legacyCache.getStats(),
            intelligence: {
                initialized: this.initialized,
                globalStats: this.getGlobalStats()
            }
        };
    }
}

class MemoryServiceWrapper implements IMemoryService {
    private memoryService: MemoryService;
    private logger: Logger;
    private initialized: boolean = false;

    constructor(database: IDatabaseService) {
        this.logger = Logger.getInstance('MemoryServiceWrapper');
        this.memoryService = MemoryService.getInstance(database);
    }

    // Core memory operations
    async store(
        key: string, 
        value: any, 
        type: 'short_term' | 'long_term' = 'short_term',
        options?: {
            sessionId?: string;
            namespace?: string;
            metadata?: Record<string, any>;
            tags?: string[];
            customTTL?: number;
        }
    ): Promise<void> {
        if (!this.initialized) {
            this.logger.warn('MemoryServiceWrapper', 'Memory service not initialized, using fallback storage');
            return;
        }

        try {
            await this.memoryService.store(key, value, type, options);
        } catch (error) {
            this.logger.error('MemoryServiceWrapper', 'Failed to store memory entry', { error, key, type });
            throw error;
        }
    }

    async retrieve(
        key: string, 
        type: 'short_term' | 'long_term' = 'short_term',
        options?: {
            namespace?: string;
            includeMetadata?: boolean;
        }
    ): Promise<any> {
        if (!this.initialized) {
            this.logger.warn('MemoryServiceWrapper', 'Memory service not initialized');
            return null;
        }

        try {
            return await this.memoryService.retrieve(key, type, options);
        } catch (error) {
            this.logger.error('MemoryServiceWrapper', 'Failed to retrieve memory entry', { error, key, type });
            return null;
        }
    }

    async search(query: MemoryQuery): Promise<MemoryEntry[]> {
        if (!this.initialized) {
            this.logger.warn('MemoryServiceWrapper', 'Memory service not initialized');
            return [];
        }

        try {
            return await this.memoryService.search(query);
        } catch (error) {
            this.logger.error('MemoryServiceWrapper', 'Failed to search memory', { error, query });
            return [];
        }
    }

    async delete(
        key: string, 
        type: 'short_term' | 'long_term' = 'short_term', 
        namespace?: string
    ): Promise<boolean> {
        if (!this.initialized) {
            this.logger.warn('MemoryServiceWrapper', 'Memory service not initialized');
            return false;
        }

        try {
            return await this.memoryService.delete(key, type, namespace);
        } catch (error) {
            this.logger.error('MemoryServiceWrapper', 'Failed to delete memory entry', { error, key, type });
            return false;
        }
    }

    async clear(type?: 'short_term' | 'long_term', namespace?: string): Promise<number> {
        if (!this.initialized) {
            this.logger.warn('MemoryServiceWrapper', 'Memory service not initialized');
            return 0;
        }

        try {
            return await this.memoryService.clear(type, namespace);
        } catch (error) {
            this.logger.error('MemoryServiceWrapper', 'Failed to clear memory', { error, type, namespace });
            return 0;
        }
    }

    // Aggregation and analytics
    async aggregate(query: MemoryQuery): Promise<AggregationResult> {
        if (!this.initialized) {
            this.logger.warn('MemoryServiceWrapper', 'Memory service not initialized');
            return this.createEmptyAggregation();
        }

        try {
            return await this.memoryService.aggregate(query);
        } catch (error) {
            this.logger.error('MemoryServiceWrapper', 'Failed to aggregate memory', { error, query });
            return this.createEmptyAggregation();
        }
    }

    async getStats(): Promise<MemoryStats> {
        if (!this.initialized) {
            return this.createEmptyStats();
        }

        try {
            return await this.memoryService.getStats();
        } catch (error) {
            this.logger.error('MemoryServiceWrapper', 'Failed to get memory stats', { error });
            return this.createEmptyStats();
        }
    }

    getOperationalStats(): any {
        if (!this.initialized) {
            return { initialized: false, storeOperations: 0, retrieveOperations: 0 };
        }

        return this.memoryService.getOperationalStats();
    }

    async healthCheck(): Promise<any> {
        if (!this.initialized) {
            return {
                status: 'unhealthy',
                services: { initialized: false },
                performance: {},
                memory: { totalEntries: 0, hitRate: 0 }
            };
        }

        try {
            return await this.memoryService.healthCheck();
        } catch (error) {
            this.logger.error('MemoryServiceWrapper', 'Memory health check failed', { error });
            return {
                status: 'unhealthy',
                services: { initialized: false },
                performance: {},
                memory: { totalEntries: 0, hitRate: 0 }
            };
        }
    }

    async initialize(config?: InternalMemoryConfig): Promise<void> {
        if (this.initialized) return;

        this.logger.info('MemoryServiceWrapper', 'Initializing memory service');

        try {
            const defaultConfig: InternalMemoryConfig = {
                shortTerm: { ttl: 3600, maxEntries: 1000 },
                longTerm: { ttl: 2592000, maxEntries: 10000 },
                enableAggregation: true,
                enableGlobalAccess: true,
                ...config
            };

            await this.memoryService.initialize(defaultConfig);
            this.initialized = true;

            this.logger.info('MemoryServiceWrapper', 'Memory service initialized successfully', {
                shortTermTTL: defaultConfig.shortTerm?.ttl,
                longTermTTL: defaultConfig.longTerm?.ttl,
                aggregationEnabled: defaultConfig.enableAggregation
            });
        } catch (error) {
            this.logger.error('MemoryServiceWrapper', 'Failed to initialize memory service', { error });
        }
    }

    createMemoryInstance(sessionId?: string, namespace?: string): Memory {
        if (!this.initialized) {
            const { createMemory } = require('./memory/index');
            return createMemory({ type: 'short_term' });
        }
        return new LegacyMemory(this.memoryService, { sessionId, namespace });
    }

    // Helper methods
    private createEmptyAggregation(): AggregationResult {
        return {
            summary: 'Memory service not available',
            patterns: [],
            insights: [],
            recommendations: [],
            timeRange: { start: new Date(), end: new Date() },
            totalEntriesAnalyzed: 0
        };
    }

    private createEmptyStats(): MemoryStats {
        return {
            shortTerm: { count: 0, sizeBytes: 0 },
            longTerm: { count: 0, sizeBytes: 0 },
            totalEntries: 0,
            totalSizeBytes: 0,
            sessions: 0,
            namespaces: []
        };
    }

    getMemoryService(): MemoryService {
        return this.memoryService;
    }
}

class StreamingServiceWrapper implements IStreamingService {
    private streamingService: StreamingService;
    private logger: Logger;
    private initialized: boolean = false;

    constructor() {
        this.logger = Logger.getInstance('StreamingServiceWrapper');
        this.streamingService = StreamingService.getInstance();
    }

    // === STREAM LIFECYCLE MANAGEMENT ===

    createStream(options: StreamOptions): string {
        if (!this.initialized) {
            this.logger.warn('StreamingServiceWrapper', 'Streaming service not initialized, creating stream with defaults');
            // Initialize with defaults if not already done
            this.streamingService.initialize().catch(error => {
                this.logger.error('StreamingServiceWrapper', 'Failed to auto-initialize', { error });
            });
        }

        try {
            return this.streamingService.createStream(options);
        } catch (error) {
            this.logger.error('StreamingServiceWrapper', 'Failed to create stream', { error, options });
            throw error;
        }
    }

    updateProgress(streamId: string, progress: Partial<ProgressUpdate>): void {
        if (!this.initialized) {
            this.logger.warn('StreamingServiceWrapper', 'Streaming service not initialized, skipping progress update');
            return;
        }

        try {
            this.streamingService.updateProgress(streamId, progress);
        } catch (error) {
            this.logger.error('StreamingServiceWrapper', 'Failed to update progress', { error, streamId });
        }
    }

    completeStream(streamId: string, finalData?: any): void {
        if (!this.initialized) {
            this.logger.warn('StreamingServiceWrapper', 'Streaming service not initialized, skipping stream completion');
            return;
        }

        try {
            this.streamingService.completeStream(streamId, finalData);
        } catch (error) {
            this.logger.error('StreamingServiceWrapper', 'Failed to complete stream', { error, streamId });
        }
    }

    errorStream(streamId: string, error: Error): void {
        if (!this.initialized) {
            this.logger.warn('StreamingServiceWrapper', 'Streaming service not initialized, skipping stream error');
            return;
        }

        try {
            this.streamingService.errorStream(streamId, error);
        } catch (err) {
            this.logger.error('StreamingServiceWrapper', 'Failed to error stream', { err, streamId, originalError: error.message });
        }
    }

    // === SUBSCRIPTION MANAGEMENT ===

    subscribe(streamId: string, callback: (update: ProgressUpdate) => void): () => void {
        if (!this.initialized) {
            this.logger.warn('StreamingServiceWrapper', 'Streaming service not initialized, returning no-op unsubscribe');
            return () => {}; // Return no-op unsubscribe function
        }

        try {
            return this.streamingService.subscribe(streamId, callback);
        } catch (error) {
            this.logger.error('StreamingServiceWrapper', 'Failed to subscribe to stream', { error, streamId });
            return () => {}; // Return no-op unsubscribe function
        }
    }

    // === UTILITY METHODS ===

    getActiveStreams(): string[] {
        if (!this.initialized) {
            this.logger.warn('StreamingServiceWrapper', 'Streaming service not initialized, returning empty array');
            return [];
        }

        try {
            return this.streamingService.getActiveStreams();
        } catch (error) {
            this.logger.error('StreamingServiceWrapper', 'Failed to get active streams', { error });
            return [];
        }
    }

    getStreamStatus(streamId: string): any {
        if (!this.initialized) {
            this.logger.warn('StreamingServiceWrapper', 'Streaming service not initialized, returning null');
            return null;
        }

        try {
            return this.streamingService.getStreamStatus(streamId);
        } catch (error) {
            this.logger.error('StreamingServiceWrapper', 'Failed to get stream status', { error, streamId });
            return null;
        }
    }

    getStats(): StreamingStats {
        if (!this.initialized) {
            return {
                activeStreams: 0,
                totalStreamsCreated: 0,
                messagesSent: 0,
                averageStreamDuration: 0,
                peakConcurrentStreams: 0
            };
        }

        try {
            return this.streamingService.getStats();
        } catch (error) {
            this.logger.error('StreamingServiceWrapper', 'Failed to get streaming stats', { error });
            return {
                activeStreams: 0,
                totalStreamsCreated: 0,
                messagesSent: 0,
                averageStreamDuration: 0,
                peakConcurrentStreams: 0
            };
        }
    }

    async healthCheck(): Promise<any> {
        if (!this.initialized) {
            return {
                status: 'unhealthy',
                services: { initialized: false },
                activeStreams: 0,
                stats: this.getStats()
            };
        }

        try {
            return await this.streamingService.healthCheck();
        } catch (error) {
            this.logger.error('StreamingServiceWrapper', 'Health check failed', { error });
            return {
                status: 'unhealthy',
                services: { initialized: false },
                activeStreams: 0,
                stats: this.getStats(),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    async initialize(config?: StreamingConfig): Promise<void> {
        if (this.initialized) return;

        this.logger.info('StreamingServiceWrapper', 'Initializing streaming service');

        try {
            await this.streamingService.initialize(config);
            this.initialized = true;
            this.logger.info('StreamingServiceWrapper', 'Streaming service initialized successfully', {
                enableRealTimeUpdates: config?.enableRealTimeUpdates,
                maxConcurrentStreams: config?.maxConcurrentStreams
            });
        } catch (error) {
            this.logger.error('StreamingServiceWrapper', 'Failed to initialize streaming service', { error });
            throw error;
        }
    }

    // Expose the underlying streaming service for advanced usage
    getStreamingService(): StreamingService {
        return this.streamingService;
    }
}

export class Symphony implements Partial<ISymphony> {
    private _state: ToolLifecycleState = ToolLifecycleState.PENDING;
    private _logger: Logger;
    private _llm: LLMHandler;
    private _config: SymphonyConfig;
    private _metrics: IMetricsAPI;
    private _databaseService: DatabaseServiceWrapper;
    private _cacheService: CacheServiceWrapper;
    private _memoryService: MemoryServiceWrapper;
    private _streamingService: StreamingServiceWrapper;
    
    readonly name = 'Symphony';
    readonly initialized = false;
    readonly isInitialized = false;
    
    readonly tool: IToolService;
    readonly agent: IAgentService;
    readonly team: ITeamService;
    readonly pipeline: IPipelineService;
    readonly validation: IValidationManager;
    // readonly validationManager: IValidationManager;
    
    readonly types = {
        CapabilityBuilder: {
            team: (capability: string) => `team:${capability}`,
            agent: (capability: string) => `agent:${capability}`,
            numeric: (capability: string) => `numeric:${capability}`,
            processing: (capability: string) => `processing:${capability}`
        },
        CommonCapabilities: {
            TOOL_USE: 'tool_use',
            COORDINATION: 'coordination',
            PARALLEL: 'parallel',
            ADD: 'add'
        }
    };

    constructor(config: SymphonyConfig) {
        this._config = config;
        this._logger = Logger.getInstance('Symphony');
        this._llm = LLMHandler.getInstance();
        this._metrics = new MetricsService();
        this._databaseService = new DatabaseServiceWrapper(config);
        this._cacheService = new CacheServiceWrapper(this._databaseService.getService());
        this._memoryService = new MemoryServiceWrapper(this._databaseService.getService());
        this._streamingService = new StreamingServiceWrapper();
        
        const sharedToolRegistry = ToolRegistry.getInstance();
        sharedToolRegistry.initializeContextIntegration(this._databaseService.getService());
        
        const toolServiceInstance = new ToolService(sharedToolRegistry);
        const agentServiceInstance = new AgentService(sharedToolRegistry);
        const teamServiceInstance = new TeamService(sharedToolRegistry);
        const pipelineServiceInstance = new PipelineService(agentServiceInstance, teamServiceInstance);
        const validationServiceInstance = new ValidationService();

        this.tool = toolServiceInstance;
        this.agent = agentServiceInstance;
        this.team = teamServiceInstance;
        this.pipeline = pipelineServiceInstance;
        this.validation = validationServiceInstance;
        // this.validationManager = validationServiceInstance;

        this._logger.info('Symphony', 'Context intelligence integration enabled', {
            contextTools: sharedToolRegistry.getContextTools(),
            totalTools: sharedToolRegistry.getAvailableTools().length
        });
    }
    
    get state(): ToolLifecycleState {
        return this._state;
    }
    
    get logger(): Logger {
        return this._logger;
    }
    
    get llm(): LLMHandler {
        return this._llm;
    }
    
    get metrics(): IMetricsAPI {
        return this._metrics;
    }
    
    get db(): IDatabaseService {
        return this._databaseService.getService();
    }
    
    get databaseService(): DatabaseServiceWrapper {
        return this._databaseService;
    }
    
    get cache(): CacheServiceWrapper {
        return this._cacheService;
    }
    
    get memory(): MemoryServiceWrapper {
        return this._memoryService;
    }
    
    get streaming(): StreamingServiceWrapper {
        return this._streamingService;
    }
    
    getState(): ToolLifecycleState {
        return this._state;
    }
    
    getDependencies(): string[] {
        return [];
    }
    
    getConfig(): SymphonyConfig {
        return this._config;
    }
    
    updateConfig(config: Partial<SymphonyConfig>): void {
        this._config = { ...this._config, ...config };
    }
    
    startMetric(id: string, metadata?: Record<string, any>): void {
        this._metrics.start(id, metadata);
    }
    
    endMetric(id: string, metadata?: Record<string, any>): void {
        this._metrics.end(id, metadata);
    }
    
    getMetric(id: string): any {
        return this._metrics.get(id);
    }
    
    async initialize(): Promise<void> {
        if (this._state === ToolLifecycleState.READY) {
            return;
        }
        
        this._state = ToolLifecycleState.INITIALIZING;
        this._logger.info('Symphony', 'Initializing...');
        
        try {
            // First, initialize the database service as other services depend on it
            await this.db.initialize(this._config.db);
            this._logger.info('Symphony', 'Database initialized');
            
            // Then initialize services that depend on the database in parallel
            await Promise.all([
                this.tool.initialize(),
                this.agent.initialize(),
                this.team.initialize(),
                this.pipeline.initialize(),
                this.validation.initialize(),
                this._cacheService.initialize(),
                this._memoryService.initialize(),
                this._streamingService.initialize()
            ]);
            
            // Initialize auto-population of cache with tool NLP mappings
            const toolRegistry = (this.tool as ToolService).registry;
            await toolRegistry.initializeAutoPopulation();
            
            // Set cache service on LLM Handler after cache is initialized
            const { LLMHandler } = await import('./llm/handler');
            const llmHandler = LLMHandler.getInstance();
            llmHandler.setCacheService(this._cacheService);
            
            this._state = ToolLifecycleState.READY;
            this._logger.info('Symphony', 'Initialization complete', {
                contextToolsAvailable: toolRegistry.getContextTools().length,
                totalToolsRegistered: toolRegistry.getAvailableTools().length
            });
        } catch (error) {
            this._state = ToolLifecycleState.ERROR;
            this._logger.error('Symphony', 'Initialization failed', { error });
            throw error;
        }
    }
    
    async getService(name: string): Promise<any> {
        const services: Record<string, any> = {
            tool: this.tool,
            agent: this.agent,
            team: this.team,
            pipeline: this.pipeline,
            validation: this.validation,
            metrics: this._metrics,
            database: this._databaseService,
            cache: this._cacheService,
            memory: this._memoryService,
            streaming: this._streamingService
        };
        return services[name];
    }
} 