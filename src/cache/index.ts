import { Logger } from '../utils/logger';
import { IDatabaseService, SetOptions } from '../db/types';

// Legacy cache interface for backward compatibility
export interface CacheEntry {
    key: string;
    value: any;
    timestamp: number;
    ttl?: number;
    namespace?: string;
}

export interface CacheOptions {
    defaultTTL?: number;
    maxSize?: number;
    cleanupInterval?: number;
}

// Legacy cache implementation - now delegates to database service
export class Cache {
    private logger: Logger;
    private database?: IDatabaseService;
    private options: CacheOptions;

    constructor(options: CacheOptions = {}) {
        this.logger = Logger.getInstance('Cache');
        this.options = {
            defaultTTL: options.defaultTTL || 300000, // 5 minutes
            maxSize: options.maxSize || 1000,
            cleanupInterval: options.cleanupInterval || 60000, // 1 minute
            ...options
        };
    }

    setDatabase(database: IDatabaseService): void {
        this.database = database;
    }

    async get(key: string, namespace?: string): Promise<any> {
        if (!this.database) {
            this.logger.warn('Cache', 'Database service not available, cache get failed', { key });
            return null;
        }

        try {
            return await this.database.get(key, namespace);
        } catch (error) {
            this.logger.error('Cache', 'Failed to get cache entry', { error, key, namespace });
            return null;
        }
    }

    async set(key: string, value: any, ttl?: number, namespace?: string): Promise<void> {
        if (!this.database) {
            this.logger.warn('Cache', 'Database service not available, cache set failed', { key });
            return;
        }

        try {
            const options: SetOptions = {
                ttl: ttl ? Math.floor(ttl / 1000) : Math.floor((this.options.defaultTTL || 300000) / 1000), // Convert ms to seconds
                namespace
            };
            await this.database.set(key, value, options);
        } catch (error) {
            this.logger.error('Cache', 'Failed to set cache entry', { error, key, namespace });
        }
    }

    async delete(key: string, namespace?: string): Promise<void> {
        if (!this.database) {
            this.logger.warn('Cache', 'Database service not available, cache delete failed', { key });
            return;
        }

        try {
            await this.database.delete(key, namespace);
        } catch (error) {
            this.logger.error('Cache', 'Failed to delete cache entry', { error, key, namespace });
        }
    }

    async has(key: string, namespace?: string): Promise<boolean> {
        if (!this.database) {
            return false;
        }

        try {
            const value = await this.database.get(key, namespace);
            return value !== null;
        } catch (error) {
            this.logger.error('Cache', 'Failed to check cache entry', { error, key, namespace });
            return false;
        }
    }

    async clear(namespace?: string): Promise<void> {
        if (!this.database) {
            this.logger.warn('Cache', 'Database service not available, cache clear failed');
            return;
        }

        try {
            // Since IDatabaseService doesn't have a clear method, we'll use find + delete
            const pattern = namespace ? `${namespace}:*` : '*';
            const entries = await this.database.find(pattern, {}, namespace);
            
            for (const entry of entries) {
                if (entry.key) {
                    await this.database.delete(entry.key, namespace);
                }
            }
        } catch (error) {
            this.logger.error('Cache', 'Failed to clear cache', { error, namespace });
        }
    }

    async size(namespace?: string): Promise<number> {
        if (!this.database) {
            return 0;
        }

        try {
            // Since IDatabaseService doesn't have a size method, we'll use find to count
            const pattern = namespace ? `${namespace}:*` : '*';
            const entries = await this.database.find(pattern, {}, namespace);
            return entries.length;
        } catch (error) {
            this.logger.error('Cache', 'Failed to get cache size', { error, namespace });
            return 0;
        }
    }

    async keys(namespace?: string): Promise<string[]> {
        if (!this.database) {
            return [];
        }

        try {
            // Since IDatabaseService doesn't have a keys method, we'll use find to get keys
            const pattern = namespace ? `${namespace}:*` : '*';
            const entries = await this.database.find(pattern, {}, namespace);
            return entries.map(entry => entry.key).filter(Boolean);
        } catch (error) {
            this.logger.error('Cache', 'Failed to get cache keys', { error, namespace });
            return [];
        }
    }

    getStats() {
        return {
            options: this.options,
            databaseConnected: !!this.database
        };
    }
}

// Export new cache intelligence services
export { CommandMapProcessor } from './map-processor';
export { ContextTreeBuilder } from './tree-builder';
export { CacheIntelligenceService } from './service';

// Export types
export type {
    Variable,
    Pattern,
    PatternMatch,
    CacheResult
} from './map-processor';

export type {
    ContextNode,
    ContextTree,
    ContextQuery
} from './tree-builder';

export type {
    IntelligenceOptions,
    IntelligenceResult,
    SessionIntelligence
} from './service';

// Backward compatibility function
let globalCache: Cache | null = null;

export function getCache(options?: CacheOptions): Cache {
    if (!globalCache) {
        globalCache = new Cache(options);
    }
    return globalCache;
}

export function clearCache(): void {
    if (globalCache) {
        globalCache.clear();
    }
}

// Export default object for backward compatibility
export default {
    getCache,
    clearCache,
    Cache
}; 