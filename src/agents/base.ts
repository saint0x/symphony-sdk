import { AgentConfig, ToolResult } from '../types/sdk';
import { LLMHandler } from '../llm/handler';
import { Logger } from '../utils/logger';

export interface BaseMemoryConfig {
    type: 'short_term' | 'long_term' | 'episodic';
    capacity?: number;
    ttl?: number;
}

// Simple memory interface for now
export interface Memory {
    store(key: string, value: any): Promise<void>;
    retrieve(key: string): Promise<any>;
    clear(): Promise<void>;
}

// Simple memory implementation
export function createMemory(config: BaseMemoryConfig): Memory {
    const storage = new Map<string, any>();
    const capacity = config.capacity || 1000;
    
    return {
        async store(key: string, value: any): Promise<void> {
            // Simple capacity management
            if (storage.size >= capacity) {
                const firstKey = storage.keys().next().value;
                if (firstKey !== undefined) {
                    storage.delete(firstKey);
                }
            }
            storage.set(key, value);
        },
        
        async retrieve(key: string): Promise<any> {
            return storage.get(key);
        },
        
        async clear(): Promise<void> {
            storage.clear();
        }
    };
}

export abstract class BaseAgent {
    protected config: AgentConfig;
    protected llm: LLMHandler;
    protected logger: Logger;
    protected memory: Memory;

    constructor(config: AgentConfig) {
        this.config = config;
        this.llm = LLMHandler.getInstance();
        this.logger = Logger.getInstance(`Agent:${config.name}`);
        
        // Initialize simple memory
        this.memory = createMemory({ type: 'short_term' });
    }

    abstract executeTask(task: string): Promise<ToolResult>;

    async run(task: string): Promise<ToolResult> {
        const startTime = Date.now();
        
        try {
            this.logger.info('Agent', `Starting task: ${task}`);
            const result = await this.executeTask(task);
            
            const metrics = {
                duration: Date.now() - startTime,
                startTime,
                endTime: Date.now()
            };

            return {
                ...result,
                metrics
            };
        } catch (error) {
            const metrics = {
                duration: Date.now() - startTime,
                startTime,
                endTime: Date.now()
            };

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                metrics
            };
        }
    }

    protected async selectTool(task: string): Promise<string | null> {
        // Simple tool selection based on task keywords
        const taskLower = task.toLowerCase();
        
        if (this.config.tools && this.config.tools.length > 0) {
            // Simple heuristic: return first tool that might match
            for (const tool of this.config.tools) {
                if (taskLower.includes(tool.toLowerCase())) {
                    return tool;
                }
            }
            // Default to first tool if no specific match
            return this.config.tools[0];
        }
        return null;
    }
}