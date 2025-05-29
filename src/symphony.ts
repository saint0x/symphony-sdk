import { ISymphony, SymphonyConfig, IMetricsAPI } from './types/symphony';
import { ToolLifecycleState } from './types/sdk';
import { Logger } from './utils/logger';
import { LLMHandler } from './llm/handler';
import { AgentExecutor } from './agents/executor';
import { TeamCoordinator } from './teams/coordinator';
import { PipelineExecutor, PipelineDefinition } from './pipelines/executor';
import { DatabaseService } from './db/service';
import { IDatabaseService } from './db/types';
import { 
    CacheIntelligenceService, 
    IntelligenceOptions, 
    IntelligenceResult,
    Cache
} from './cache';
import { MemoryService, MemoryConfig, MemoryEntry, MemoryQuery, MemoryStats, AggregationResult } from './memory/service';
import { LegacyMemory, Memory } from './memory/index';
import { StreamingService, StreamingConfig, ProgressUpdate, StreamOptions, StreamingStats } from './streaming/service';

// Simple service interfaces
interface IToolService {
    create(config: any): Promise<any>;
    initialize(): Promise<void>;
}

interface IAgentService {
    create(config: any): Promise<any>;
    initialize(): Promise<void>;
}

interface ITeamService {
    create(config: any): Promise<any>;
    initialize(): Promise<void>;
}

interface IPipelineService {
    create(config: any): Promise<any>;
    initialize(): Promise<void>;
}

interface IDatabaseServiceWrapper {
    create(config: any): Promise<any>;
    initialize(): Promise<void>;
}

interface ICacheService {
    // Legacy cache interface for backward compatibility
    get(key: string, namespace?: string): Promise<any>;
    set(key: string, value: any, ttl?: number, namespace?: string): Promise<void>;
    delete(key: string, namespace?: string): Promise<void>;
    has(key: string, namespace?: string): Promise<boolean>;
    clear(namespace?: string): Promise<void>;
    
    // Cache intelligence interface
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
    
    // Analytics and monitoring
    getPatternAnalytics(): Promise<any>;
    getContextAnalytics(): Promise<any>;
    getGlobalStats(): any;
    getSessionIntelligence(sessionId: string): any;
    
    // Utility methods
    clearCaches(): void;
    healthCheck(): Promise<any>;
    
    initialize(options?: IntelligenceOptions): Promise<void>;
}

interface IValidationManager {
    validate(config: any, type: string): Promise<{ isValid: boolean; errors: string[] }>;
    initialize(): Promise<void>;
}

interface IMemoryService {
    // Legacy memory interface for backward compatibility
    store(key: string, value: any, type?: 'short_term' | 'long_term', options?: any): Promise<void>;
    retrieve(key: string, type?: 'short_term' | 'long_term', options?: any): Promise<any>;
    search(query: MemoryQuery): Promise<MemoryEntry[]>;
    delete(key: string, type?: 'short_term' | 'long_term', namespace?: string): Promise<boolean>;
    clear(type?: 'short_term' | 'long_term', namespace?: string): Promise<number>;
    
    // Aggregation and analytics
    aggregate(query: MemoryQuery): Promise<AggregationResult>;
    getStats(): Promise<MemoryStats>;
    getOperationalStats(): any;
    
    // Utility methods
    healthCheck(): Promise<any>;
    initialize(config?: MemoryConfig): Promise<void>;
    
    // Legacy compatibility
    createMemoryInstance(sessionId?: string, namespace?: string): Memory;
}

interface IStreamingService {
    // Stream lifecycle management
    createStream(options: StreamOptions): string;
    updateProgress(streamId: string, progress: Partial<ProgressUpdate>): void;
    completeStream(streamId: string, finalData?: any): void;
    errorStream(streamId: string, error: Error): void;
    
    // Subscription management
    subscribe(streamId: string, callback: (update: ProgressUpdate) => void): () => void;
    
    // Utility methods
    getActiveStreams(): string[];
    getStreamStatus(streamId: string): any;
    getStats(): StreamingStats;
    healthCheck(): Promise<any>;
    initialize(config?: StreamingConfig): Promise<void>;
}

// Simple implementations
class SimpleToolService implements IToolService {
    async create(config: any): Promise<any> {
        return {
            name: config.name,
            run: config.handler || (() => Promise.resolve({ success: true, result: null }))
        };
    }
    
    async initialize(): Promise<void> {
        // Simple initialization
    }
}

class SimpleAgentService implements IAgentService {
    async create(config: any): Promise<any> {
        // Create an actual AgentExecutor instance with LLM capabilities
        const agentExecutor = new AgentExecutor(config);
        
        return {
            name: config.name,
            run: async (task: string) => {
                // Use the AgentExecutor's executeTask method which includes LLM integration
                return await agentExecutor.executeTask(task);
            },
            selectTool: async (task: string) => {
                // Use the AgentExecutor's intelligent tool selection
                return await agentExecutor.executeToolSelection(task);
            },
            executor: agentExecutor // Expose the executor for advanced usage
        };
    }
    
    async initialize(): Promise<void> {
        // Simple initialization
    }
}

class EnhancedTeamService implements ITeamService {
    private teams: Map<string, TeamCoordinator> = new Map();
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance('EnhancedTeamService');
    }

    async create(config: any): Promise<any> {
        this.logger.info('EnhancedTeamService', `Creating team: ${config.name}`, {
            agentCount: config.agents?.length || 0,
            strategy: config.strategy?.name || 'default'
        });

        // Create TeamCoordinator instance
        const teamCoordinator = new TeamCoordinator(config);
        
        // Initialize the team
        await teamCoordinator.initialize();
        
        // Store for management
        this.teams.set(config.name, teamCoordinator);

        // Return team interface compatible with existing API
        return {
            name: config.name,
            run: async (task: string, options?: any) => {
                this.logger.info('EnhancedTeamService', `Team ${config.name} executing task: ${task}`);
                return await teamCoordinator.executeTask(task, options);
            },
            getStatus: () => teamCoordinator.getTeamStatus(),
            getContext: () => teamCoordinator.getContext(),
            coordinator: teamCoordinator // Expose coordinator for advanced usage
        };
    }
    
    async initialize(): Promise<void> {
        this.logger.info('EnhancedTeamService', 'Enhanced team service initialized');
    }

    async shutdown(): Promise<void> {
        this.logger.info('EnhancedTeamService', `Shutting down ${this.teams.size} teams`);
        
        const shutdownPromises = Array.from(this.teams.values()).map(team => team.shutdown());
        await Promise.all(shutdownPromises);
        
        this.teams.clear();
        this.logger.info('EnhancedTeamService', 'All teams shut down successfully');
    }

    getTeams(): string[] {
        return Array.from(this.teams.keys());
    }

    getTeam(name: string): TeamCoordinator | undefined {
        return this.teams.get(name);
    }
}

class EnhancedPipelineService implements IPipelineService {
    private pipelines: Map<string, PipelineExecutor> = new Map();
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance('EnhancedPipelineService');
    }

    async create(config: any): Promise<any> {
        this.logger.info('EnhancedPipelineService', `Creating pipeline: ${config.name}`, {
            stepCount: config.steps?.length || 0,
            version: config.version || '1.0.0'
        });

        // Convert config to PipelineDefinition
        const definition: PipelineDefinition = {
            id: config.id || `pipeline_${Date.now()}`,
            name: config.name,
            description: config.description || `Pipeline: ${config.name}`,
            version: config.version || '1.0.0',
            steps: config.steps || [],
            variables: config.variables,
            errorHandling: config.errorHandling,
            concurrency: config.concurrency
        };

        // Create PipelineExecutor instance
        const pipelineExecutor = new PipelineExecutor(definition);
        
        // Store for management
        this.pipelines.set(config.name, pipelineExecutor);

        // Return pipeline interface compatible with existing API
        return {
            name: config.name,
            run: async (input?: any) => {
                this.logger.info('EnhancedPipelineService', `Pipeline ${config.name} executing with input`, {
                    hasInput: !!input,
                    inputKeys: input ? Object.keys(input) : []
                });
                return await pipelineExecutor.execute(input);
            },
            getStatus: () => pipelineExecutor.getPipelineStatus(),
            executor: pipelineExecutor // Expose executor for advanced usage
        };
    }
    
    async initialize(): Promise<void> {
        this.logger.info('EnhancedPipelineService', 'Enhanced pipeline service initialized');
    }

    async shutdown(): Promise<void> {
        this.logger.info('EnhancedPipelineService', `Shutting down ${this.pipelines.size} pipelines`);
        // Pipelines don't need special shutdown logic currently
        this.pipelines.clear();
        this.logger.info('EnhancedPipelineService', 'All pipelines shut down successfully');
    }

    getPipelines(): string[] {
        return Array.from(this.pipelines.keys());
    }

    getPipeline(name: string): PipelineExecutor | undefined {
        return this.pipelines.get(name);
    }
}

class SimpleValidationManager implements IValidationManager {
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

class SimpleMetricsAPI implements IMetricsAPI {
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

    async initialize(config?: MemoryConfig): Promise<void> {
        if (this.initialized) return;

        this.logger.info('MemoryServiceWrapper', 'Initializing memory service');

        try {
            // Default configuration
            const defaultConfig: MemoryConfig = {
                shortTerm: { ttl: 3600, maxEntries: 1000 },      // 1 hour, 1K entries
                longTerm: { ttl: 2592000, maxEntries: 10000 },   // 30 days, 10K entries
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
            // Don't throw - allow Symphony to continue with degraded memory functionality
        }
    }

    // Legacy compatibility method
    createMemoryInstance(sessionId?: string, namespace?: string): Memory {
        if (!this.initialized) {
            // Fallback to simple in-memory implementation
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
    
    // Services
    readonly tool: IToolService;
    readonly agent: IAgentService;
    readonly team: ITeamService;
    readonly pipeline: IPipelineService;
    readonly validation: IValidationManager;
    readonly validationManager: IValidationManager;
    
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
        this._metrics = new SimpleMetricsAPI();
        this._databaseService = new DatabaseServiceWrapper(config);
        this._cacheService = new CacheServiceWrapper(this._databaseService.getService());
        this._memoryService = new MemoryServiceWrapper(this._databaseService.getService());
        this._streamingService = new StreamingServiceWrapper();
        
        // Initialize services
        this.tool = new SimpleToolService();
        this.agent = new SimpleAgentService();
        this.team = new EnhancedTeamService();
        this.pipeline = new EnhancedPipelineService();
        this.validation = new SimpleValidationManager();
        this.validationManager = this.validation;
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
            await Promise.all([
                this.tool.initialize(),
                this.agent.initialize(),
                this.team.initialize(),
                this.pipeline.initialize(),
                this.validation.initialize(),
                this.db.initialize(this._config.db),
                this._cacheService.initialize(),
                this._memoryService.initialize(),
                this._streamingService.initialize()
            ]);
            
            this._state = ToolLifecycleState.READY;
            this._logger.info('Symphony', 'Initialization complete');
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