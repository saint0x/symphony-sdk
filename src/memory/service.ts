import { Logger } from '../utils/logger';
import { IDatabaseService } from '../db/types';

export interface MemoryConfig {
    shortTerm?: {
        ttl?: number;        // seconds (default: 1 hour)
        maxEntries?: number; // max entries before cleanup (default: 1000)
    };
    longTerm?: {
        ttl?: number;        // seconds (default: 30 days) 
        maxEntries?: number; // max entries before cleanup (default: 10000)
    };
    enableAggregation?: boolean;
    enableGlobalAccess?: boolean;
}

export interface MemoryEntry {
    key: string;
    value: any;
    type: 'short_term' | 'long_term';
    sessionId?: string;
    namespace?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    expiresAt?: Date;
    tags?: string[];
}

export interface MemoryQuery {
    type?: 'short_term' | 'long_term' | 'both';
    sessionId?: string;
    namespace?: string;
    tags?: string[];
    searchText?: string;
    limit?: number;
    includeExpired?: boolean;
}

export interface MemoryStats {
    shortTerm: {
        count: number;
        sizeBytes: number;
        oldestEntry?: Date;
        newestEntry?: Date;
    };
    longTerm: {
        count: number;
        sizeBytes: number;
        oldestEntry?: Date;
        newestEntry?: Date;
    };
    totalEntries: number;
    totalSizeBytes: number;
    sessions: number;
    namespaces: string[];
}

export interface AggregationResult {
    summary: string;
    patterns: Array<{
        pattern: string;
        frequency: number;
        examples: any[];
    }>;
    insights: string[];
    recommendations: string[];
    timeRange: {
        start: Date;
        end: Date;
    };
    totalEntriesAnalyzed: number;
}

export class MemoryService {
    private static instance: MemoryService;
    private logger: Logger;
    private database: IDatabaseService;
    private config: MemoryConfig;
    private initialized: boolean = false;

    // Performance tracking
    private stats = {
        storeOperations: 0,
        retrieveOperations: 0,
        searchOperations: 0,
        aggregationOperations: 0,
        cacheHits: 0,
        cacheMisses: 0
    };

    private constructor(database: IDatabaseService) {
        this.logger = Logger.getInstance('MemoryService');
        this.database = database;
        this.config = {
            shortTerm: { ttl: 3600, maxEntries: 1000 },      // 1 hour, 1K entries
            longTerm: { ttl: 2592000, maxEntries: 10000 },   // 30 days, 10K entries
            enableAggregation: true,
            enableGlobalAccess: true
        };
    }

    static getInstance(database: IDatabaseService): MemoryService {
        if (!MemoryService.instance) {
            MemoryService.instance = new MemoryService(database);
        }
        return MemoryService.instance;
    }

    async initialize(config?: MemoryConfig): Promise<void> {
        if (this.initialized) return;

        this.logger.info('MemoryService', 'Initializing memory service');

        try {
            // Update configuration
            if (config) {
                this.config = { ...this.config, ...config };
            }

            // Verify database connection
            await this.database.healthCheck();

            // Create memory table if it doesn't exist
            await this.ensureMemoryTable();

            // Start cleanup scheduler
            this.startCleanupScheduler();

            this.initialized = true;
            this.logger.info('MemoryService', 'Memory service initialized successfully', {
                shortTermTTL: this.config.shortTerm?.ttl,
                longTermTTL: this.config.longTerm?.ttl,
                aggregationEnabled: this.config.enableAggregation
            });
        } catch (error) {
            this.logger.error('MemoryService', 'Failed to initialize', { error });
            throw error;
        }
    }

    // === CORE MEMORY OPERATIONS ===

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
            throw new Error('MemoryService not initialized');
        }

        const startTime = Date.now();
        this.stats.storeOperations++;

        try {
            const ttl = options?.customTTL || (type === 'short_term' ? 
                this.config.shortTerm?.ttl : this.config.longTerm?.ttl) || 3600;

            const entry: MemoryEntry = {
                key,
                value,
                type,
                sessionId: options?.sessionId,
                namespace: options?.namespace,
                metadata: options?.metadata,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + (ttl * 1000)),
                tags: options?.tags
            };

            // Store in database
            await this.database.set(
                this.buildMemoryKey(key, type, options?.namespace), 
                entry, 
                { 
                    ttl,
                    namespace: 'memory'
                }
            );

            // Cleanup if over limits
            await this.enforceMemoryLimits(type);

            this.logger.debug('MemoryService', 'Stored memory entry', {
                key,
                type,
                sessionId: options?.sessionId,
                namespace: options?.namespace,
                valueSize: JSON.stringify(value).length,
                executionTime: Date.now() - startTime
            });

        } catch (error) {
            this.logger.error('MemoryService', 'Failed to store memory entry', { 
                error, key, type 
            });
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
            throw new Error('MemoryService not initialized');
        }

        const startTime = Date.now();
        this.stats.retrieveOperations++;

        try {
            const memoryKey = this.buildMemoryKey(key, type, options?.namespace);
            const entry = await this.database.get(memoryKey, 'memory');

            if (!entry) {
                this.stats.cacheMisses++;
                return null;
            }

            this.stats.cacheHits++;

            // Check if entry is expired
            const memoryEntry = entry as MemoryEntry;
            if (memoryEntry.expiresAt && new Date() > memoryEntry.expiresAt) {
                // Entry expired, clean it up
                await this.database.delete(memoryKey, 'memory');
                this.stats.cacheMisses++;
                return null;
            }

            this.logger.debug('MemoryService', 'Retrieved memory entry', {
                key,
                type,
                namespace: options?.namespace,
                hasValue: !!memoryEntry.value,
                executionTime: Date.now() - startTime
            });

            // Return just the value or full entry with metadata
            return options?.includeMetadata ? memoryEntry : memoryEntry.value;

        } catch (error) {
            this.logger.error('MemoryService', 'Failed to retrieve memory entry', { 
                error, key, type 
            });
            this.stats.cacheMisses++;
            return null;
        }
    }

    async search(query: MemoryQuery): Promise<MemoryEntry[]> {
        if (!this.initialized) {
            throw new Error('MemoryService not initialized');
        }

        const startTime = Date.now();
        this.stats.searchOperations++;

        try {
            // Build search pattern
            const pattern = this.buildSearchPattern(query);
            
            // Search in database
            const entries = await this.database.find(pattern, {}, 'memory');

            // Apply limit after getting results (since we can't pass limit to the adapter's find method)
            const limitedEntries = query.limit ? entries.slice(0, query.limit) : entries;

            // Filter and process results
            const mappedEntries = limitedEntries
                .map(entry => {
                    const memoryEntry = entry.value as MemoryEntry;
                    // Ensure createdAt is a Date object, not a string
                    if (memoryEntry && memoryEntry.createdAt && typeof memoryEntry.createdAt === 'string') {
                        memoryEntry.createdAt = new Date(memoryEntry.createdAt);
                    }
                    // Ensure expiresAt is a Date object, not a string
                    if (memoryEntry && memoryEntry.expiresAt && typeof memoryEntry.expiresAt === 'string') {
                        memoryEntry.expiresAt = new Date(memoryEntry.expiresAt);
                    }
                    return memoryEntry;
                })
                .filter(entry => entry && typeof entry === 'object'); // Ensure valid entries

            const filteredEntries = mappedEntries
                .filter(entry => this.matchesQuery(entry, query))
                .filter(entry => query.includeExpired || !this.isExpired(entry));

            const results = filteredEntries
                .sort((a, b) => {
                    const timeA = a.createdAt ? a.createdAt.getTime() : 0;
                    const timeB = b.createdAt ? b.createdAt.getTime() : 0;
                    return timeB - timeA;
                });

            this.logger.debug('MemoryService', 'Memory search completed', {
                query,
                pattern,
                resultsFound: results.length,
                executionTime: Date.now() - startTime
            });

            return results;

        } catch (error) {
            this.logger.error('MemoryService', 'Failed to search memory', { error, query });
            return [];
        }
    }

    async delete(
        key: string,
        type: 'short_term' | 'long_term' = 'short_term',
        namespace?: string
    ): Promise<boolean> {
        if (!this.initialized) {
            throw new Error('MemoryService not initialized');
        }

        try {
            const memoryKey = this.buildMemoryKey(key, type, namespace);
            await this.database.delete(memoryKey, 'memory');

            this.logger.debug('MemoryService', 'Deleted memory entry', {
                key, type, namespace
            });

            return true;
        } catch (error) {
            this.logger.error('MemoryService', 'Failed to delete memory entry', { 
                error, key, type 
            });
            return false;
        }
    }

    async clear(type?: 'short_term' | 'long_term', namespace?: string): Promise<number> {
        if (!this.initialized) {
            throw new Error('MemoryService not initialized');
        }

        try {
            const pattern = this.buildClearPattern(type, namespace);
            const entries = await this.database.find(pattern, {}, 'memory');

            let deletedCount = 0;
            for (const entry of entries) {
                if (entry.key) {
                    await this.database.delete(entry.key, 'memory');
                    deletedCount++;
                }
            }

            this.logger.info('MemoryService', 'Cleared memory entries', {
                type, namespace, deletedCount
            });

            return deletedCount;
        } catch (error) {
            this.logger.error('MemoryService', 'Failed to clear memory', { error, type, namespace });
            return 0;
        }
    }

    // === AGGREGATION & ANALYTICS ===

    async aggregate(query: MemoryQuery): Promise<AggregationResult> {
        if (!this.initialized || !this.config.enableAggregation) {
            throw new Error('Memory aggregation not available');
        }

        const startTime = Date.now();
        this.stats.aggregationOperations++;

        try {
            // Get entries for aggregation
            const entries = await this.search({ ...query, limit: 1000 });

            if (entries.length === 0) {
                return this.createEmptyAggregation();
            }

            // Analyze patterns and insights
            const patterns = this.analyzePatterns(entries);
            const insights = this.generateInsights(entries);
            const recommendations = this.generateRecommendations(entries, patterns);

            const result: AggregationResult = {
                summary: this.generateSummary(entries, patterns),
                patterns,
                insights,
                recommendations,
                timeRange: {
                    start: new Date(Math.min(...entries.map(e => e.createdAt.getTime()))),
                    end: new Date(Math.max(...entries.map(e => e.createdAt.getTime())))
                },
                totalEntriesAnalyzed: entries.length
            };

            this.logger.info('MemoryService', 'Memory aggregation completed', {
                entriesAnalyzed: entries.length,
                patternsFound: patterns.length,
                insightsGenerated: insights.length,
                executionTime: Date.now() - startTime
            });

            return result;

        } catch (error) {
            this.logger.error('MemoryService', 'Failed to aggregate memory', { error, query });
            return this.createEmptyAggregation();
        }
    }

    // === MEMORY STATISTICS ===

    async getStats(): Promise<MemoryStats> {
        if (!this.initialized) {
            throw new Error('MemoryService not initialized');
        }

        try {
            // Get all memory entries
            const shortTermEntries = await this.search({ type: 'short_term', limit: 10000 });
            const longTermEntries = await this.search({ type: 'long_term', limit: 10000 });

            // Calculate sizes
            const shortTermSize = this.calculateSize(shortTermEntries);
            const longTermSize = this.calculateSize(longTermEntries);

            // Get unique sessions and namespaces
            const allEntries = [...shortTermEntries, ...longTermEntries];
            const sessions = new Set(allEntries.map(e => e.sessionId).filter(Boolean)).size;
            const namespaces = Array.from(new Set(allEntries.map(e => e.namespace).filter(Boolean)));

            return {
                shortTerm: {
                    count: shortTermEntries.length,
                    sizeBytes: shortTermSize,
                    oldestEntry: shortTermEntries.length > 0 ? 
                        new Date(Math.min(...shortTermEntries.map(e => e.createdAt.getTime()))) : undefined,
                    newestEntry: shortTermEntries.length > 0 ?
                        new Date(Math.max(...shortTermEntries.map(e => e.createdAt.getTime()))) : undefined
                },
                longTerm: {
                    count: longTermEntries.length,
                    sizeBytes: longTermSize,
                    oldestEntry: longTermEntries.length > 0 ?
                        new Date(Math.min(...longTermEntries.map(e => e.createdAt.getTime()))) : undefined,
                    newestEntry: longTermEntries.length > 0 ?
                        new Date(Math.max(...longTermEntries.map(e => e.createdAt.getTime()))) : undefined
                },
                totalEntries: allEntries.length,
                totalSizeBytes: shortTermSize + longTermSize,
                sessions,
                namespaces
            };

        } catch (error) {
            this.logger.error('MemoryService', 'Failed to get memory stats', { error });
            throw error;
        }
    }

    getOperationalStats() {
        return {
            ...this.stats,
            initialized: this.initialized,
            config: this.config,
            hitRate: this.stats.retrieveOperations > 0 ? 
                this.stats.cacheHits / this.stats.retrieveOperations : 0
        };
    }

    // === PRIVATE HELPER METHODS ===

    private buildMemoryKey(key: string, type: string, namespace?: string): string {
        const parts = ['memory', type];
        if (namespace) parts.push(namespace);
        parts.push(key);
        return parts.join(':');
    }

    private buildSearchPattern(query: MemoryQuery): string {
        const parts = ['memory'];
        
        if (query.type && query.type !== 'both') {
            parts.push(query.type);
        } else {
            parts.push('*'); // Match both short_term and long_term
        }
        
        if (query.namespace) {
            parts.push(query.namespace);
        } else {
            parts.push('*'); // Always include namespace wildcard to match entries with any namespace
        }
        
        parts.push('*'); // Match any key
        return parts.join(':');
    }

    private buildClearPattern(type?: string, namespace?: string): string {
        const parts = ['memory'];
        
        if (type) {
            parts.push(type);
        } else {
            parts.push('*');
        }
        
        if (namespace) {
            parts.push(namespace);
        } else {
            parts.push('*'); // Always include namespace wildcard for consistency
        }
        
        parts.push('*');
        return parts.join(':');
    }

    private matchesQuery(entry: MemoryEntry, query: MemoryQuery): boolean {
        // Type filter
        if (query.type && query.type !== 'both' && entry.type !== query.type) {
            return false;
        }

        // Session filter
        if (query.sessionId && entry.sessionId !== query.sessionId) {
            return false;
        }

        // Namespace filter
        if (query.namespace && entry.namespace !== query.namespace) {
            return false;
        }

        // Tags filter
        if (query.tags && query.tags.length > 0) {
            if (!entry.tags || !query.tags.some(tag => entry.tags!.includes(tag))) {
                return false;
            }
        }

        // Text search
        if (query.searchText) {
            const searchLower = query.searchText.toLowerCase();
            const searchableText = [
                entry.key,
                JSON.stringify(entry.value),
                entry.namespace,
                ...(entry.tags || [])
            ].join(' ').toLowerCase();

            if (!searchableText.includes(searchLower)) {
                return false;
            }
        }

        return true;
    }

    private isExpired(entry: MemoryEntry): boolean {
        return entry.expiresAt ? new Date() > entry.expiresAt : false;
    }

    private calculateSize(entries: MemoryEntry[]): number {
        return entries.reduce((total, entry) => {
            return total + JSON.stringify(entry).length;
        }, 0);
    }

    private analyzePatterns(entries: MemoryEntry[]): Array<{ pattern: string; frequency: number; examples: any[] }> {
        const patterns = new Map<string, { count: number; examples: any[] }>();

        entries.forEach(entry => {
            // Analyze key patterns
            const keyPattern = this.extractKeyPattern(entry.key);
            if (!patterns.has(keyPattern)) {
                patterns.set(keyPattern, { count: 0, examples: [] });
            }
            const patternData = patterns.get(keyPattern)!;
            patternData.count++;
            if (patternData.examples.length < 3) {
                patternData.examples.push(entry.key);
            }

            // Analyze value patterns if applicable
            if (entry.metadata?.valueType) {
                const valuePattern = `value_type:${entry.metadata.valueType}`;
                if (!patterns.has(valuePattern)) {
                    patterns.set(valuePattern, { count: 0, examples: [] });
                }
                patterns.get(valuePattern)!.count++;
            }
        });

        return Array.from(patterns.entries())
            .map(([pattern, data]) => ({
                pattern,
                frequency: data.count,
                examples: data.examples
            }))
            .sort((a, b) => b.frequency - a.frequency);
    }

    private extractKeyPattern(key: string): string {
        // Extract patterns from keys (e.g., "task:123" -> "task:*")
        return key.replace(/\d+/g, '*').replace(/[a-f0-9]{8,}/g, '*');
    }

    private generateInsights(entries: MemoryEntry[]): string[] {
        const insights: string[] = [];

        // Temporal patterns
        const now = Date.now();
        const recent = entries.filter(e => now - e.createdAt.getTime() < 3600000); // 1 hour
        if (recent.length > entries.length * 0.7) {
            insights.push('High recent activity detected - most memory entries are from the last hour');
        }

        // Session patterns
        const sessionCounts = new Map<string, number>();
        entries.forEach(e => {
            if (e.sessionId) {
                sessionCounts.set(e.sessionId, (sessionCounts.get(e.sessionId) || 0) + 1);
            }
        });

        if (sessionCounts.size === 1) {
            insights.push('All memory entries belong to a single session - focused activity');
        } else if (sessionCounts.size > 10) {
            insights.push('High session diversity - memory spans multiple user interactions');
        }

        // Memory type distribution
        const shortTerm = entries.filter(e => e.type === 'short_term').length;
        const longTerm = entries.filter(e => e.type === 'long_term').length;
        
        if (shortTerm > longTerm * 3) {
            insights.push('Short-term memory dominant - suggests active but transient workflows');
        } else if (longTerm > shortTerm * 2) {
            insights.push('Long-term memory dominant - suggests knowledge accumulation focus');
        }

        return insights;
    }

    private generateRecommendations(entries: MemoryEntry[], patterns: any[]): string[] {
        const recommendations: string[] = [];

        // Check for cleanup opportunities
        const expired = entries.filter(e => this.isExpired(e)).length;
        if (expired > entries.length * 0.2) {
            recommendations.push('Consider running memory cleanup - high number of expired entries detected');
        }

        // Check for optimization opportunities
        const highFrequencyPatterns = patterns.filter(p => p.frequency > 10);
        if (highFrequencyPatterns.length > 0) {
            recommendations.push('Consider caching frequently accessed patterns for better performance');
        }

        // Storage optimization
        const totalSize = this.calculateSize(entries);
        if (totalSize > 1024 * 1024) { // 1MB
            recommendations.push('Memory usage is high - consider archiving old entries or reducing retention');
        }

        return recommendations;
    }

    private generateSummary(entries: MemoryEntry[], patterns: any[]): string {
        const total = entries.length;
        const shortTerm = entries.filter(e => e.type === 'short_term').length;
        const longTerm = entries.filter(e => e.type === 'long_term').length;
        const sessions = new Set(entries.map(e => e.sessionId).filter(Boolean)).size;

        return `Memory contains ${total} entries (${shortTerm} short-term, ${longTerm} long-term) across ${sessions} sessions with ${patterns.length} distinct patterns identified.`;
    }

    private createEmptyAggregation(): AggregationResult {
        return {
            summary: 'No memory entries found for aggregation',
            patterns: [],
            insights: [],
            recommendations: [],
            timeRange: { start: new Date(), end: new Date() },
            totalEntriesAnalyzed: 0
        };
    }

    private async ensureMemoryTable(): Promise<void> {
        // Memory table creation is handled by database migration system
        // This is a placeholder for any memory-specific table setup
    }

    private async enforceMemoryLimits(type: 'short_term' | 'long_term'): Promise<void> {
        const config = type === 'short_term' ? this.config.shortTerm : this.config.longTerm;
        const maxEntries = config?.maxEntries || 1000;

        try {
            const entries = await this.search({ type, limit: maxEntries + 100 });
            
            if (entries.length > maxEntries) {
                // Remove oldest entries
                const entriesToRemove = entries
                    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
                    .slice(0, entries.length - maxEntries);

                for (const entry of entriesToRemove) {
                    await this.delete(entry.key, entry.type, entry.namespace);
                }

                this.logger.info('MemoryService', 'Enforced memory limits', {
                    type,
                    removedEntries: entriesToRemove.length,
                    remainingEntries: maxEntries
                });
            }
        } catch (error) {
            this.logger.error('MemoryService', 'Failed to enforce memory limits', { error, type });
        }
    }

    private startCleanupScheduler(): void {
        // Run cleanup every hour
        setInterval(async () => {
            try {
                await this.cleanupExpiredEntries();
            } catch (error) {
                this.logger.error('MemoryService', 'Scheduled cleanup failed', { error });
            }
        }, 3600000); // 1 hour
    }

    private async cleanupExpiredEntries(): Promise<number> {
        try {
            const allEntries = await this.search({ type: 'both', includeExpired: true, limit: 10000 });
            const expiredEntries = allEntries.filter(entry => this.isExpired(entry));

            let cleanedCount = 0;
            for (const entry of expiredEntries) {
                const deleted = await this.delete(entry.key, entry.type, entry.namespace);
                if (deleted) cleanedCount++;
            }

            if (cleanedCount > 0) {
                this.logger.info('MemoryService', 'Cleaned up expired entries', { 
                    cleanedCount,
                    totalEntries: allEntries.length
                });
            }

            return cleanedCount;
        } catch (error) {
            this.logger.error('MemoryService', 'Failed to cleanup expired entries', { error });
            return 0;
        }
    }

    async healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        services: Record<string, boolean>;
        performance: Record<string, number>;
        memory: {
            totalEntries: number;
            hitRate: number;
            lastCleanup?: Date;
        };
    }> {
        try {
            const stats = await this.getStats();
            const opStats = this.getOperationalStats();

            return {
                status: this.initialized && stats.totalEntries >= 0 ? 'healthy' : 'unhealthy',
                services: {
                    initialized: this.initialized,
                    database: true, // Assuming database is healthy if we got stats
                    aggregation: this.config.enableAggregation || false
                },
                performance: {
                    storeOps: opStats.storeOperations,
                    retrieveOps: opStats.retrieveOperations,
                    searchOps: opStats.searchOperations,
                    hitRate: opStats.hitRate
                },
                memory: {
                    totalEntries: stats.totalEntries,
                    hitRate: opStats.hitRate,
                    lastCleanup: new Date() // Would track actual cleanup time
                }
            };
        } catch (error) {
            this.logger.error('MemoryService', 'Health check failed', { error });
            return {
                status: 'unhealthy',
                services: { initialized: false },
                performance: {},
                memory: { totalEntries: 0, hitRate: 0 }
            };
        }
    }
} 