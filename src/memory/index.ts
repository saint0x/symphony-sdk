import { Logger } from '../utils/logger';
import { IDatabaseService } from '../db/types';

// Export new memory service
export { MemoryService } from './service';

// Export types
export type {
    MemoryConfig,
    MemoryEntry,
    MemoryQuery,
    MemoryStats,
    AggregationResult
} from './service';

// Legacy memory interface for backward compatibility
export interface Memory {
    store(key: string, value: any): Promise<void>;
    retrieve(key: string): Promise<any>;
    clear(): Promise<void>;
}

// Legacy memory implementation - now delegates to MemoryService
export class LegacyMemory implements Memory {
    private memoryService: import('./service').MemoryService;
    private logger: Logger;
    private sessionId: string;
    private namespace: string;

    constructor(
        memoryService: import('./service').MemoryService, 
        options?: {
            sessionId?: string;
            namespace?: string;
        }
    ) {
        this.memoryService = memoryService;
        this.logger = Logger.getInstance('LegacyMemory');
        this.sessionId = options?.sessionId || 'default';
        this.namespace = options?.namespace || 'legacy';
    }

    async store(key: string, value: any): Promise<void> {
        try {
            await this.memoryService.store(key, value, 'short_term', {
                sessionId: this.sessionId,
                namespace: this.namespace,
                metadata: { legacyApi: true }
            });
        } catch (error) {
            this.logger.error('LegacyMemory', 'Failed to store value', { error, key });
            throw error;
        }
    }

    async retrieve(key: string): Promise<any> {
        try {
            return await this.memoryService.retrieve(key, 'short_term', {
                namespace: this.namespace
            });
        } catch (error) {
            this.logger.error('LegacyMemory', 'Failed to retrieve value', { error, key });
            return null;
        }
    }

    async clear(): Promise<void> {
        try {
            await this.memoryService.clear('short_term', this.namespace);
        } catch (error) {
            this.logger.error('LegacyMemory', 'Failed to clear memory', { error });
        }
    }
}

// Legacy memory config types (for backward compatibility)
export interface BaseMemoryConfig {
    type: 'short_term' | 'long_term' | 'episodic';
    capacity?: number;
    ttl?: number;
}

// Legacy memory factory function
export function createMemory(config: BaseMemoryConfig): Memory {
    // This is a simplified in-memory implementation for backward compatibility
    // when MemoryService is not available
    const storage = new Map<string, { value: any; timestamp: number; ttl?: number }>();
    const capacity = config.capacity || 1000;
    const defaultTTL = config.ttl || 300000; // 5 minutes

    return {
        async store(key: string, value: any): Promise<void> {
            // Simple capacity management
            if (storage.size >= capacity) {
                const firstKey = storage.keys().next().value;
                if (firstKey !== undefined) {
                    storage.delete(firstKey);
                }
            }
            
            storage.set(key, { 
                value, 
                timestamp: Date.now(),
                ttl: defaultTTL
            });
        },
        
        async retrieve(key: string): Promise<any> {
            const entry = storage.get(key);
            if (!entry) return null;
            
            // Check if expired
            if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
                storage.delete(key);
                return null;
            }
            
            return entry.value;
        },
        
        async clear(): Promise<void> {
            storage.clear();
        }
    };
}

// Global memory instance management (for backward compatibility)
let globalMemoryService: import('./service').MemoryService | null = null;

export function getMemoryService(database?: IDatabaseService): import('./service').MemoryService | null {
    if (database && !globalMemoryService) {
        const { MemoryService } = require('./service');
        globalMemoryService = MemoryService.getInstance(database);
    }
    return globalMemoryService;
}

export function createMemoryInstance(
    database: IDatabaseService, 
    sessionId?: string, 
    namespace?: string
): Memory {
    const memoryService = getMemoryService(database);
    if (memoryService) {
        return new LegacyMemory(memoryService, { sessionId, namespace });
    } else {
        // Fallback to simple in-memory implementation
        return createMemory({ type: 'short_term' });
    }
}

// Export default object for backward compatibility
export default {
    createMemory,
    getMemoryService,
    createMemoryInstance
}; 