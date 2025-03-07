import { BaseMemoryConfig } from '../../types/sdk';
import { Memory, MemoryEntry } from '../types';

export class EpisodicMemory implements Memory {
    private episodes: Map<string, MemoryEntry[]> = new Map();
    private currentEpisode: string | null = null;
    private capacity: number;
    private episodeIndex: Map<string, Map<string, number[]>> = new Map(); // Episode -> token -> positions

    constructor(config: BaseMemoryConfig) {
        this.capacity = config.capacity || 50;
    }

    startEpisode(id: string) {
        this.currentEpisode = id;
        if (!this.episodes.has(id)) {
            this.episodes.set(id, []);
            this.episodeIndex.set(id, new Map());
        }
    }

    endEpisode() {
        this.currentEpisode = null;
    }

    private updateIndex(episodeId: string, position: number, value: any): void {
        const tokens = JSON.stringify(value)
            .toLowerCase()
            .split(/\W+/)
            .filter(token => token.length > 2);

        const episodeTokens = this.episodeIndex.get(episodeId)!;
        for (const token of tokens) {
            if (!episodeTokens.has(token)) {
                episodeTokens.set(token, []);
            }
            episodeTokens.get(token)!.push(position);
        }
    }

    async add(key: string, value: any): Promise<void> {
        if (!this.currentEpisode) {
            throw new Error('No active episode');
        }

        const episode = this.episodes.get(this.currentEpisode)!;
        const position = episode.length;

        const entry: MemoryEntry = {
            value,
            timestamp: Date.now(),
            type: 'episodic',
            metadata: { key, episodeId: this.currentEpisode, position }
        };

        episode.push(entry);
        this.updateIndex(this.currentEpisode, position, value);

        // Maintain capacity
        if (this.episodes.size > this.capacity) {
            const oldestEpisode = Array.from(this.episodes.keys())[0];
            this.episodes.delete(oldestEpisode);
            this.episodeIndex.delete(oldestEpisode);
        }
    }

    async get(key: string): Promise<any> {
        if (!this.currentEpisode) return null;
        
        const episode = this.episodes.get(this.currentEpisode);
        if (!episode) return null;

        // Find the most recent entry with the given key
        for (let i = episode.length - 1; i >= 0; i--) {
            if (episode[i].metadata?.key === key) {
                return episode[i].value;
            }
        }
        return null;
    }

    async search(query: string): Promise<any[]> {
        const searchTokens = query.toLowerCase().split(/\W+/).filter(token => token.length > 2);
        const results = new Map<string, MemoryEntry>(); // Use map to deduplicate

        for (const [episodeId, episode] of this.episodes.entries()) {
            const episodeTokens = this.episodeIndex.get(episodeId);
            if (!episodeTokens) continue;

            // Find positions where tokens match
            const matchingPositions = new Set<number>();
            for (const token of searchTokens) {
                const positions = episodeTokens.get(token) || [];
                positions.forEach(pos => matchingPositions.add(pos));
            }

            // Add matching entries to results
            for (const position of matchingPositions) {
                const entry = episode[position];
                if (entry) {
                    const key = `${episodeId}:${position}`;
                    results.set(key, entry);
                }
            }
        }

        return Array.from(results.values()).map(entry => entry.value);
    }

    async clear(): Promise<void> {
        this.episodes.clear();
        this.episodeIndex.clear();
        this.currentEpisode = null;
    }

    getEpisodeHistory(episodeId?: string): MemoryEntry[] {
        if (!episodeId && !this.currentEpisode) {
            return [];
        }
        const targetEpisode = episodeId || this.currentEpisode!;
        return this.episodes.get(targetEpisode) || [];
    }
} 