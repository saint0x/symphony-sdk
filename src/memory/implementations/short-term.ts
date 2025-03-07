import { BaseMemoryConfig } from '../../types/sdk';
import { Memory, MemoryEntry } from '../types';
import { getCache } from '../../cache';

export class ShortTermMemory implements Memory {
    private cache = getCache();
    private prefix: string;
    private capacity: number;
    private ttl: number;
    private keys: Set<string> = new Set();

    constructor(config: BaseMemoryConfig) {
        this.prefix = 'stm:';
        this.capacity = config.capacity || 100;
        this.ttl = config.ttl || 3600; // 1 hour default
    }

    async add(key: string, value: any): Promise<void> {
        const prefixedKey = `${this.prefix}${key}`;
        
        // Check capacity and remove oldest if needed
        if (this.keys.size >= this.capacity) {
            const oldestKey = Array.from(this.keys)[0];
            await this.cache.delete(`${this.prefix}${oldestKey}`);
            this.keys.delete(oldestKey);
        }

        const entry: MemoryEntry = {
            value,
            timestamp: Date.now(),
            type: 'short_term',
            metadata: {
                key: prefixedKey,
                expiresAt: Date.now() + (this.ttl * 1000)
            }
        };

        await this.cache.set(prefixedKey, entry, this.ttl);
        this.keys.add(key);
    }

    async get(key: string): Promise<any> {
        const prefixedKey = `${this.prefix}${key}`;
        const entry = await this.cache.get<MemoryEntry>(prefixedKey);
        
        if (!entry) {
            this.keys.delete(key);
            return null;
        }

        // Check if expired
        if (entry.metadata?.expiresAt && Date.now() > entry.metadata.expiresAt) {
            await this.cache.delete(prefixedKey);
            this.keys.delete(key);
            return null;
        }

        return entry.value;
    }

    async search(query: string): Promise<any[]> {
        const results: any[] = [];
        const searchPromises = Array.from(this.keys).map(async key => {
            const value = await this.get(key);
            if (value && JSON.stringify(value).toLowerCase().includes(query.toLowerCase())) {
                results.push(value);
            }
        });

        await Promise.all(searchPromises);
        return results;
    }

    async clear(): Promise<void> {
        const deletePromises = Array.from(this.keys).map(key => 
            this.cache.delete(`${this.prefix}${key}`)
        );
        await Promise.all(deletePromises);
        this.keys.clear();
    }
} 