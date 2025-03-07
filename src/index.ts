import { ToolConfig, AgentConfig, TeamConfig, PipelineConfig } from './types/sdk';
import { ServiceRegistry } from './proto/symphonic/core/types';
import { logger, LogCategory } from './utils/logger';
import { OpenAIProvider } from './llm/providers/openai';
import { LLMConfig } from './llm/types';

// Add API configuration
const API_CONFIG = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SERPER_API_KEY: process.env.SERPER_API_KEY || 'a2137968d2f76ecff838fd798d9da14006d9fbc8'
};

// Add type guard for API key
if (!API_CONFIG.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required');
}

// Add type guard for model and ensure it's a string
const DEFAULT_MODEL = process.env.DEFAULT_LLM_MODEL ?? 'gpt-4o-mini-2024-07-18';

// Add search result types
interface SerperSearchResult {
    organic?: Array<{
        title?: string;
        link?: string;
        snippet?: string;
        source?: string;
        date?: string;
        position?: number;
    }>;
    news?: Array<{
        title?: string;
        link?: string;
        snippet?: string;
        source?: string;
        date?: string;
        position?: number;
    }>;
}

// Main SDK class
class Symphony {
    private registry: ServiceRegistry | null = null;

    private async ensureInitialized() {
        if (!this.registry) {
            logger.debug(LogCategory.SYSTEM, 'Initializing ServiceRegistry for SDK');
            this.registry = await ServiceRegistry.getInstance();
            logger.info(LogCategory.SYSTEM, 'SDK ServiceRegistry initialized');
        }
        return this.registry;
    }

    tools = {
        create: async (config: ToolConfig) => {
            logger.debug(LogCategory.SYSTEM, 'Creating new tool', {
                metadata: {
                    name: config.name,
                    inputs: config.inputs
                }
            });

            const registry = await this.ensureInitialized();
            
            // Create the tool object
            const tool = {
                name: config.name,
                description: config.description,
                inputs: config.inputs,
                outputs: config.outputs,
                chained: config.chained,
                target: config.target,
                handler: config.handler,
                timeout: config.timeout,
                retry: config.retry,
                config: {
                    timeout: config.timeout,
                    retry: config.retry
                },
                run: async (params: Record<string, any>) => {
                    logger.debug(LogCategory.SYSTEM, 'Executing tool', {
                        metadata: {
                            tool: config.name,
                            params: Object.keys(params)
                        }
                    });

                    const result = await registry.executeCall(
                        config.name,
                        'run',
                        params
                    );

                    if (!result.success) {
                        logger.error(LogCategory.SYSTEM, 'Tool execution failed', {
                            metadata: {
                                tool: config.name,
                                error: result.error
                            }
                        });
                    } else {
                        logger.info(LogCategory.SYSTEM, 'Tool execution completed', {
                            metadata: {
                                tool: config.name,
                                duration: result.metrics.duration
                            }
                        });
                    }

                    return {
                        result: result.data,
                        success: result.success
                    };
                },
                register: async () => {
                    logger.debug(LogCategory.SYSTEM, 'Registering tool service', {
                        metadata: {
                            name: config.name
                        }
                    });

                    await registry.registerService({
                        metadata: {
                            id: config.name,
                            name: config.name,
                            version: '1.0.0',
                            type: 'TOOL',
                            status: 'ACTIVE'
                        },
                        methods: {
                            run: async (params: any) => {
                                try {
                                    logger.debug(LogCategory.SYSTEM, 'Executing tool handler', {
                                        metadata: {
                                            tool: config.name,
                                            params: Object.keys(params)
                                        }
                                    });
                                    const result = await config.handler(params);
                                    return result.result;
                                } catch (error: any) {
                                    logger.error(LogCategory.SYSTEM, 'Tool handler failed', {
                                        metadata: {
                                            tool: config.name,
                                            error: error.message,
                                            stack: error.stack
                                        }
                                    });
                                    throw error;
                                }
                            }
                        }
                    });

                    logger.info(LogCategory.SYSTEM, 'Tool registered successfully', {
                        metadata: {
                            name: config.name
                        }
                    });
                }
            };

            return tool;
        }
    };

    agent = {
        create: async (config: AgentConfig) => {
            const registry = await this.ensureInitialized();
            logger.debug(LogCategory.SYSTEM, 'Creating new agent', {
                metadata: {
                    name: config.name,
                    tools: config.tools,
                    llm: config.llm
                }
            });

            // Load system prompt
            const systemPrompt = `You are an AI assistant helping with task: ${config.task}.
Available tools: ${config.tools.join(', ')}.
Follow user instructions carefully and use tools when needed.`;

            logger.info(LogCategory.SYSTEM, 'Agent system prompt loaded', {
                metadata: {
                    agent: config.name,
                    prompt: systemPrompt
                }
            });

            const agent = {
                ...config,
                run: async (task: string) => {
                    logger.debug(LogCategory.SYSTEM, 'Executing agent task', {
                        metadata: {
                            agent: config.name,
                            task,
                            llm: config.llm
                        }
                    });

                    // Create a type-safe config object
                    const llmConfig: LLMConfig = {
                        provider: 'openai',
                        apiKey: API_CONFIG.OPENAI_API_KEY!,
                        model: DEFAULT_MODEL,
                        temperature: 0.7,
                        maxTokens: 1000
                    };

                    // Initialize OpenAI provider
                    const openai = new OpenAIProvider(llmConfig);
                    await openai.initialize();

                    // Check if task requires web search
                    if (task.toLowerCase().includes('search') && !task.toLowerCase().includes('analyze')) {
                        // Call webSearch tool
                        const searchResponse = await fetch('https://google.serper.dev/search', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-KEY': API_CONFIG.SERPER_API_KEY
                            },
                            body: JSON.stringify({
                                q: task.replace(/search for /i, ''),
                                type: 'search',
                                num: 10
                            })
                        });

                        const searchResult = await searchResponse.json() as SerperSearchResult;
                        
                        // Validate response format
                        if (!searchResult || typeof searchResult !== 'object') {
                            throw new Error('Invalid search response format');
                        }

                        // Transform into expected format
                        const results = [];
                        
                        if (searchResult.organic && Array.isArray(searchResult.organic)) {
                            results.push(...searchResult.organic.map(item => ({
                                title: item.title || '',
                                link: item.link || '',
                                snippet: item.snippet || '',
                                source: item.source,
                                published_date: item.date,
                                additional_info: {
                                    position: String(item.position || ''),
                                    type: 'organic'
                                }
                            })));
                        }

                        if (searchResult.news && Array.isArray(searchResult.news)) {
                            results.push(...searchResult.news.map(item => ({
                                title: item.title || '',
                                link: item.link || '',
                                snippet: item.snippet || '',
                                source: item.source,
                                published_date: item.date,
                                additional_info: {
                                    position: String(item.position || ''),
                                    type: 'news'
                                }
                            })));
                        }

                        logger.info(LogCategory.SYSTEM, 'Search results received', {
                            metadata: {
                                agent: config.name,
                                query: task,
                                resultCount: results.length
                            }
                        });

                        return {
                            success: true,
                            data: {
                                results
                            }
                        };
                    }

                    // For non-search tasks or analysis tasks, call LLM API
                    const llmResponse = await openai.complete({
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: task }
                        ],
                        maxTokens: 100,
                        temperature: 0.7
                    });

                    logger.info(LogCategory.SYSTEM, 'LLM response received', {
                        metadata: {
                            agent: config.name,
                            model: config.llm,
                            usage: llmResponse.usage
                        }
                    });

                    return {
                        success: true,
                        data: {
                            content: llmResponse.content
                        }
                    };
                },
                executeStream: async function* (task: string) {
                    logger.debug(LogCategory.SYSTEM, 'Starting streaming execution', {
                        metadata: {
                            agent: config.name,
                            task,
                            llm: config.llm
                        }
                    });

                    // Create a type-safe config object
                    const llmConfig: LLMConfig = {
                        provider: 'openai',
                        apiKey: API_CONFIG.OPENAI_API_KEY!,
                        model: DEFAULT_MODEL,
                        temperature: 0.7,
                        maxTokens: 1000
                    };

                    // Initialize OpenAI provider for streaming
                    const openaiStream = new OpenAIProvider(llmConfig);
                    await openaiStream.initialize();

                    // Stream LLM response
                    const stream = openaiStream.completeStream({
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: task }
                        ],
                        maxTokens: 100,
                        temperature: 0.7
                    });

                    let streamContent = '';
                    for await (const chunk of stream) {
                        streamContent += chunk.content;
                        yield {
                            type: 'llm_stream',
                            content: chunk.content
                        };
                    }

                    logger.info(LogCategory.SYSTEM, 'LLM streaming completed', {
                        metadata: {
                            agent: config.name,
                            contentLength: streamContent.length
                        }
                    });

                    // Create a type-safe streaming function
                    async function* streamTask(task: string, llmContent: string): AsyncGenerator<any, void, unknown> {
                        yield { type: 'start', message: 'Starting task' };
                        yield { type: 'llm_content', content: llmContent };
                        yield { type: 'complete', result: `Completed: ${task}` };
                    }

                    // Use the streaming function
                    const streamResult = streamTask(task, streamContent);

                    for await (const update of streamResult) {
                        yield update;
                    }
                },
                search: async (query: string) => {
                    logger.debug(LogCategory.SYSTEM, 'Executing search', {
                        metadata: {
                            agent: config.name,
                            query
                        }
                    });

                    // Fix headers type error
                    const headers: Record<string, string> = {
                        'Content-Type': 'application/json',
                        'X-API-KEY': API_CONFIG.SERPER_API_KEY || ''
                    };

                    const searchResponse = await fetch('https://google.serper.dev/search', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            q: query
                        })
                    });

                    const searchResult = await searchResponse.json() as SerperSearchResult;
                    
                    // Validate response format
                    if (!searchResult || typeof searchResult !== 'object') {
                        throw new Error('Invalid search response format');
                    }

                    // Transform into expected format
                    const results = [];
                    
                    const organic = searchResult.organic || [];
                    if (Array.isArray(organic)) {
                        results.push(...organic.map(item => ({
                            title: item.title || '',
                            link: item.link || '',
                            snippet: item.snippet || '',
                            source: item.source,
                            published_date: item.date,
                            additional_info: {
                                position: String(item.position || ''),
                                type: 'organic'
                            }
                        })));
                    }

                    const news = searchResult.news || [];
                    if (Array.isArray(news)) {
                        results.push(...news.map(item => ({
                            title: item.title || '',
                            link: item.link || '',
                            snippet: item.snippet || '',
                            source: item.source,
                            published_date: item.date,
                            additional_info: {
                                position: String(item.position || ''),
                                type: 'news'
                            }
                        })));
                    }

                    logger.info(LogCategory.SYSTEM, 'Search results received', {
                        metadata: {
                            agent: config.name,
                            query,
                            resultCount: results.length
                        }
                    });

                    return {
                        query,
                        results
                    };
                }
            };

            // Register the agent service
            await registry.registerService({
                metadata: {
                    id: config.name,
                    name: config.name,
                    version: '1.0.0',
                    type: 'AGENT',
                    status: 'ACTIVE',
                    customMetadata: {
                        llm: config.llm,
                        systemPrompt
                    }
                },
                methods: {
                    run: async (params: any) => {
                        const { task, tools, llmResponse } = params;
                        logger.info(LogCategory.SYSTEM, 'Agent executing task', {
                            metadata: {
                                agent: config.name,
                                task,
                                tools,
                                llmTokens: llmResponse?.usage?.total_tokens
                            }
                        });
                        return { 
                            success: true, 
                            result: `Executed: ${task}`,
                            llmResponse 
                        };
                    },
                    executeStream: async function* (params: any) {
                        const { task, tools, llmContent } = params;
                        logger.info(LogCategory.SYSTEM, 'Agent streaming task', {
                            metadata: {
                                agent: config.name,
                                task,
                                tools,
                                llmContentLength: llmContent?.length
                            }
                        });
                        yield { type: 'start', message: 'Starting task' };
                        yield { type: 'llm_content', content: llmContent };
                        yield { type: 'complete', result: `Completed: ${task}` };
                    }
                }
            });

            logger.info(LogCategory.SYSTEM, 'Agent created successfully', {
                metadata: {
                    name: config.name,
                    llm: config.llm,
                    tools: config.tools.length
                }
            });

            return agent;
        }
    };

    team = {
        create: async (config: TeamConfig) => {
            const registry = await this.ensureInitialized();
            logger.debug(LogCategory.SYSTEM, 'Creating new team', {
                metadata: {
                    name: config.name,
                    agents: config.agents
                }
            });

            const team = {
                ...config,
                run: async (task: string) => {
                    logger.debug(LogCategory.SYSTEM, 'Executing team task', {
                        metadata: {
                            team: config.name,
                            task
                        }
                    });

                    const result = await registry.executeCall(
                        config.name,
                        'run',
                        { task, agents: config.agents }
                    );

                    return {
                        result: result.data,
                        success: result.success
                    };
                }
            };

            // Register the team service
            await registry.registerService({
                metadata: {
                    id: config.name,
                    name: config.name,
                    version: '1.0.0',
                    type: 'TEAM',
                    status: 'ACTIVE'
                },
                methods: {
                    run: async (params: any) => {
                        const { task, agents } = params;
                        logger.info(LogCategory.SYSTEM, 'Team executing task', {
                            metadata: {
                                team: config.name,
                                task,
                                agents
                            }
                        });
                        return { success: true, result: `Team executed: ${task}` };
                    }
                }
            });

            logger.info(LogCategory.SYSTEM, 'Team created successfully', {
                metadata: {
                    name: config.name
                }
            });

            return team;
        }
    };

    pipeline = {
        create: async (config: PipelineConfig) => {
            const registry = await this.ensureInitialized();
            logger.debug(LogCategory.SYSTEM, 'Creating new pipeline', {
                metadata: {
                    name: config.name,
                    steps: config.steps.map(s => s.name)
                }
            });

            const pipeline = {
                ...config,
                run: async (input: Record<string, any>) => {
                    logger.debug(LogCategory.SYSTEM, 'Executing pipeline', {
                        metadata: {
                            pipeline: config.name,
                            input: Object.keys(input)
                        }
                    });

                    const result = await registry.executeCall(
                        config.name,
                        'run',
                        { input, steps: config.steps }
                    );

                    return {
                        result: result.data,
                        success: result.success
                    };
                }
            };

            // Register the pipeline service
            await registry.registerService({
                metadata: {
                    id: config.name,
                    name: config.name,
                    version: '1.0.0',
                    type: 'PIPELINE',
                    status: 'ACTIVE'
                },
                methods: {
                    run: async (params: any) => {
                        const { input, steps } = params;
                        logger.info(LogCategory.SYSTEM, 'Pipeline executing', {
                            metadata: {
                                pipeline: config.name,
                                steps: steps.map((s: any) => s.name)
                            }
                        });
                        
                        let currentData = { data: input };  // Wrap input in data object
                        for (const step of steps) {
                            logger.debug(LogCategory.SYSTEM, 'Executing pipeline step', {
                                metadata: {
                                    pipeline: config.name,
                                    step: step.name,
                                    inputData: currentData
                                }
                            });

                            const result = await registry.executeCall(
                                step.tool,
                                'run',
                                currentData
                            );

                            if (!result.success) {
                                logger.error(LogCategory.SYSTEM, 'Pipeline step failed', {
                                    metadata: {
                                        pipeline: config.name,
                                        step: step.name,
                                        error: result.error
                                    }
                                });
                                throw new Error(`Pipeline step ${step.name} failed: ${result.error?.message}`);
                            }

                            currentData = { data: result.data };  // Wrap result in data object
                            
                            logger.debug(LogCategory.SYSTEM, 'Pipeline step completed', {
                                metadata: {
                                    pipeline: config.name,
                                    step: step.name,
                                    outputData: currentData
                                }
                            });
                        }
                        
                        return { success: true, result: currentData.data };
                    }
                }
            });

            logger.info(LogCategory.SYSTEM, 'Pipeline created successfully', {
                metadata: {
                    name: config.name
                }
            });

            return pipeline;
        }
    };
}

// Export singleton instance
export const symphony = new Symphony();
logger.info(LogCategory.SYSTEM, 'Symphony instance created');

// Export types
export * from './types/sdk'; 