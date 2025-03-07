import { BaseMemoryConfig } from '../types/sdk';
import { Memory } from './types';
import { ShortTermMemory } from './implementations/short-term';
import { LongTermMemory } from './implementations/long-term';
import { EpisodicMemory } from './implementations/episodic';

export * from './types';

export function createMemory(config: BaseMemoryConfig): Memory {
    switch (config.type) {
        case 'short_term':
            return new ShortTermMemory(config);
        case 'long_term':
            return new LongTermMemory(config);
        case 'episodic':
            return new EpisodicMemory(config);
        default:
            throw new Error(`Unsupported memory type: ${config.type}`);
    }
} 