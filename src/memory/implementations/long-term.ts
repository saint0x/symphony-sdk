import { BaseMemoryConfig } from '../../types/sdk';
import { Memory, MemoryEntry } from '../types';

export class LongTermMemory implements Memory {
    private storage: Map<string, MemoryEntry> = new Map();
    private capacity: number;
    private indexes: Map<string, Set<string>> = new Map(); // Inverted index for search

    constructor(config: BaseMemoryConfig) {
        this.capacity = config.capacity || 1000;
    }

    private updateIndexes(key: string, value: any): void {
        // Create searchable tokens from the value
        const tokens = JSON.stringify(value)
            .toLowerCase()
            .split(/\W+/)
            .filter(token => token.length > 2);

        // Update inverted index
        for (const token of tokens) {
            if (!this.indexes.has(token)) {
                this.indexes.set(token, new Set());
            }
            this.indexes.get(token)!.add(key);
        }
    }

    private removeFromIndexes(key: string): void {
        for (const [token, keys] of this.indexes.entries()) {
            keys.delete(key);
            if (keys.size === 0) {
                this.indexes.delete(token);
            }
        }
    }

    async add(key: string, value: any): Promise<void> {
        if (this.storage.size >= this.capacity) {
            // Remove oldest entry
            const oldestKey = Array.from(this.storage.entries())
                .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
            this.removeFromIndexes(oldestKey);
            this.storage.delete(oldestKey);
        }

        const entry: MemoryEntry = {
            value,
            timestamp: Date.now(),
            type: 'long_term',
            metadata: { key }
        };

        this.storage.set(key, entry);
        this.updateIndexes(key, value);
    }

    async get(key: string): Promise<any> {
        return this.storage.get(key)?.value;
    }

    async search(query: string): Promise<any[]> {
        const searchTokens = query.toLowerCase().split(/\W+/).filter(token => token.length > 2);
        const resultKeys = new Set<string>();

        // Find matching keys using inverted index
        for (const token of searchTokens) {
            const matchingKeys = this.indexes.get(token);
            if (matchingKeys) {
                matchingKeys.forEach(key => resultKeys.add(key));
            }
        }

        // Retrieve and return matching values
        return Array.from(resultKeys)
            .map(key => this.storage.get(key)?.value)
            .filter(value => value !== undefined);
    }

    async clear(): Promise<void> {
        this.storage.clear();
        this.indexes.clear();
    }
} 