import { AgentConfig, ToolConfig, MemoryConfig } from '../types/sdk';
import { createMetricsTracker } from '../utils/metrics';
import { validateAgentConfig } from '../utils/validation';
import { OpenAIProvider } from '../llm/providers/openai';
import { LLMConfig } from '../llm/types';
import { standardTools } from '../tools/standard';
import { Memory, createMemory } from '../memory';
import { envConfig } from '../utils/env';

export class BaseAgent {
    protected name: string;
    protected description: string;
    protected task: string;
    protected tools: Map<string, ToolConfig>;
    protected llm: OpenAIProvider;
    protected maxCalls: number;
    protected requireApproval: boolean;
    protected timeout: number;
    protected metrics = createMetricsTracker();
    protected shortTermMemory!: Memory;
    protected longTermMemory!: Memory;
    protected episodicMemory!: Memory;
    protected currentEpisodeId: string | null = null;

    constructor(config: AgentConfig) {
        validateAgentConfig(config);

        this.name = config.name;
        this.description = config.description;
        this.task = config.task;
        this.tools = new Map();
        this.maxCalls = config.maxCalls || 10;
        this.requireApproval = config.requireApproval || false;
        this.timeout = config.timeout || 30000;

        // Initialize memories
        this.initializeMemories(config.memory);

        // Initialize LLM
        const llmConfig: LLMConfig = typeof config.llm === 'string' ? {
            provider: 'openai' as const,
            apiKey: envConfig.openaiApiKey,
            model: config.llm
        } : {
            provider: (config.llm.provider || 'openai') as 'openai' | 'anthropic' | 'google',
            apiKey: envConfig.openaiApiKey,
            model: config.llm.model
        };
        this.llm = new OpenAIProvider(llmConfig);

        // Initialize tools
        this.initializeTools(config.tools);
    }

    private initializeMemories(config?: MemoryConfig) {
        const defaultConfig: MemoryConfig = {
            shortTerm: { type: 'short_term', capacity: 100, ttl: 3600 },
            longTerm: { type: 'long_term', capacity: 1000 },
            episodic: { type: 'episodic', capacity: 50 }
        };

        const memoryConfig = config || defaultConfig;

        this.shortTermMemory = createMemory(memoryConfig.shortTerm || defaultConfig.shortTerm!);
        this.longTermMemory = createMemory(memoryConfig.longTerm || defaultConfig.longTerm!);
        this.episodicMemory = createMemory(memoryConfig.episodic || defaultConfig.episodic!);
    }

    protected async remember(key: string): Promise<any> {
        // Try short-term memory first
        let value = await this.shortTermMemory.get(key);
        if (value) return value;

        // Try long-term memory
        value = await this.longTermMemory.get(key);
        if (value) return value;

        // Try episodic memory
        return await this.episodicMemory.get(key);
    }

    protected async memorize(key: string, value: any, type: 'short_term' | 'long_term' | 'episodic' = 'short_term'): Promise<void> {
        switch (type) {
            case 'short_term':
                await this.shortTermMemory.add(key, value);
                break;
            case 'long_term':
                await this.longTermMemory.add(key, value);
                break;
            case 'episodic':
                await this.episodicMemory.add(key, value);
                break;
        }
    }

    protected async searchMemory(query: string): Promise<any[]> {
        const results = await Promise.all([
            this.shortTermMemory.search(query),
            this.longTermMemory.search(query),
            this.episodicMemory.search(query)
        ]);

        return results.flat();
    }

    private initializeTools(tools: Array<string | ToolConfig>) {
        for (const tool of tools) {
            if (typeof tool === 'string') {
                // Load standard tool
                const standardTool = standardTools.find(t => t.name === tool);
                if (!standardTool) {
                    throw new Error(`Standard tool '${tool}' not found`);
                }
                this.tools.set(tool, standardTool);
            } else {
                // Load custom tool
                this.tools.set(tool.name, tool);
            }
        }
    }

    protected async executeTool(toolName: string, params: any): Promise<any> {
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
        }

        if (!tool.handler) {
            throw new Error(`Tool ${toolName} does not have a handler`);
        }

        try {
            return await tool.handler(params);
        } catch (error) {
            throw new Error(`Failed to execute tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    protected async planTask(task: string): Promise<string[]> {
        this.metrics.trackOperation('task_planning');

        // Search memory for relevant past experiences
        const relevantMemories = await this.searchMemory(task);
        const memoryContext = relevantMemories.length > 0
            ? `\nRelevant past experiences:\n${JSON.stringify(relevantMemories, null, 2)}`
            : '';
        
        const response = await this.llm.complete({
            messages: [
                {
                    role: 'system',
                    content: `You are an AI agent named ${this.name}. Your task is: ${this.task}${memoryContext}`
                },
                {
                    role: 'user',
                    content: `Plan how to accomplish this task: ${task}\nAvailable tools: ${Array.from(this.tools.keys()).join(', ')}`
                }
            ]
        });

        const steps = response.content.split('\n').filter(step => step.trim());

        // Store the plan in long-term memory
        await this.memorize(`plan:${Date.now()}`, {
            task,
            steps,
            relevantMemories
        }, 'long_term');

        return steps;
    }

    async run(task: string): Promise<any> {
        this.metrics.trackOperation('task_start');
        
        try {
            // Start a new episode for this task
            this.currentEpisodeId = `task:${Date.now()}`;
            (this.episodicMemory as any).startEpisode(this.currentEpisodeId);

            // Store task start in episodic memory
            await this.episodicMemory.add('task_start', {
                task,
                timestamp: Date.now()
            });

            // Plan the task
            const steps = await this.planTask(task);
            
            // Execute each step
            let result;
            for (const step of steps) {
                this.metrics.trackOperation(`step_execution`);
                
                // Parse tool and params from step
                const toolPattern = /Use (?<tool>\w+) to (?<desc>.*)/;
                const matches = toolPattern.exec(step);
                if (!matches?.groups) continue;
                
                const toolName = matches.groups.tool;
                const description = matches.groups.desc;
                if (this.requireApproval) {
                    // Store approval request in episodic memory
                    await this.episodicMemory.add(`approval_request:${Date.now()}`, {
                        tool: toolName,
                        description,
                        timestamp: Date.now()
                    });
                    console.log(`Waiting for approval to use ${toolName}: ${description}`);
                }
                
                result = await this.executeTool(toolName, { description });
            }

            // Store task completion in episodic memory
            await this.episodicMemory.add('task_complete', {
                task,
                result,
                timestamp: Date.now()
            });

            this.metrics.trackOperation('task_complete');
            (this.episodicMemory as any).endEpisode();
            this.currentEpisodeId = null;

            return {
                success: true,
                result,
                metrics: this.metrics.end()
            };
        } catch (error) {
            // Store error in episodic memory
            if (this.currentEpisodeId) {
                await this.episodicMemory.add('task_error', {
                    task,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: Date.now()
                });
                (this.episodicMemory as any).endEpisode();
                this.currentEpisodeId = null;
            }

            this.metrics.trackOperation('task_error');
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                metrics: this.metrics.end()
            };
        }
    }

    async *executeStream(task: string): AsyncGenerator<any, void, unknown> {
        this.metrics.trackOperation('stream_start');
        
        try {
            // Start a new episode for this task
            this.currentEpisodeId = `stream:${Date.now()}`;
            (this.episodicMemory as any).startEpisode(this.currentEpisodeId);

            // Store stream start in episodic memory
            await this.episodicMemory.add('stream_start', {
                task,
                timestamp: Date.now()
            });

            // Plan the task
            const steps = await this.planTask(task);
            
            // Execute each step
            for (const step of steps) {
                this.metrics.trackOperation(`stream_step`);
                
                // Parse tool and params from step
                const toolPattern = /Use (?<tool>\w+) to (?<desc>.*)/;
                const matches = toolPattern.exec(step);
                if (!matches?.groups) continue;
                
                const toolName = matches.groups.tool;
                const description = matches.groups.desc;
                if (this.requireApproval) {
                    // Store approval request in episodic memory
                    await this.episodicMemory.add(`approval_request:${Date.now()}`, {
                        tool: toolName,
                        description,
                        timestamp: Date.now()
                    });

                    yield {
                        type: 'approval_required',
                        tool: toolName,
                        description
                    };
                }
                
                const result = await this.executeTool(toolName, { description });
                yield {
                    type: 'step_complete',
                    tool: toolName,
                    result,
                    metrics: this.metrics.end()
                };
            }

            // Store stream completion in episodic memory
            await this.episodicMemory.add('stream_complete', {
                task,
                timestamp: Date.now()
            });

            this.metrics.trackOperation('stream_complete');
            (this.episodicMemory as any).endEpisode();
            this.currentEpisodeId = null;

            yield {
                type: 'complete',
                metrics: this.metrics.end()
            };
        } catch (error) {
            // Store error in episodic memory
            if (this.currentEpisodeId) {
                await this.episodicMemory.add('stream_error', {
                    task,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: Date.now()
                });
                (this.episodicMemory as any).endEpisode();
                this.currentEpisodeId = null;
            }

            this.metrics.trackOperation('stream_error');
            yield {
                type: 'error',
                error: error instanceof Error ? error : new Error(String(error)),
                metrics: this.metrics.end()
            };
        }
    }
}