import { logger, LogCategory } from '../../utils/logger';
import { LLMConfig, LLMRequest, LLMResponse, LLMProvider } from '../types';
import { createMetricsTracker } from '../../utils/metrics';
import { getCache } from '../../cache';

interface OpenAICompletion {
    content: string;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export class OpenAIProvider implements LLMProvider {
    name = 'openai';
    supportsStreaming = true;
    private config: LLMConfig;
    private model: string;

    constructor(config: LLMConfig) {
        if (!config.apiKey) {
            throw new Error('OpenAI API key is required in config');
        }
        this.config = config;
        this.model = config.model || 'gpt-3.5-turbo'; // Default model if not specified
    }

    async initialize(): Promise<void> {
        // OpenAI doesn't require initialization
    }

    async complete(request: LLMRequest): Promise<LLMResponse> {
        const metrics = createMetricsTracker();
        const cache = getCache();

        try {
            metrics.trackOperation('request_preparation');
            const cacheKey = `openai:${this.model}:${JSON.stringify(request.messages)}`;
            
            // Check cache
            const cached = await cache.get(cacheKey);
            if (cached && this.isOpenAICompletion(cached)) {
                return this.formatResponse(cached);
            }

            // Get API key from config
            const apiKey = this.config.apiKey;
            if (!apiKey) {
                throw new Error('OpenAI API key not found in config');
            }

            metrics.trackOperation('api_request');
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: request.messages,
                    temperature: this.config.temperature || 0.7,
                    max_tokens: this.config.maxTokens || 2000
                })
            });

            metrics.trackOperation('response_processing');
            if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            const completion: OpenAICompletion = {
                content: data.choices[0].message.content,
                usage: data.usage
            };

            // Cache successful responses
            await cache.set(cacheKey, completion);

            return this.formatResponse(completion);
        } catch (error) {
            logger.error(LogCategory.AI, 'OpenAI API error', {
                metadata: {
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
            throw error;
        }
    }

    private formatResponse(completion: OpenAICompletion): LLMResponse {
        const now = Date.now();
        const response: LLMResponse = {
            content: completion.content,
            model: this.model,
            role: 'assistant',
            usage: {
                prompt_tokens: completion.usage.prompt_tokens,
                completion_tokens: completion.usage.completion_tokens,
                total_tokens: completion.usage.total_tokens
            },
            metrics: {
                duration: 0,
                startTime: now,
                endTime: now,
                tokenUsage: {
                    input: completion.usage.prompt_tokens,
                    output: completion.usage.completion_tokens,
                    total: completion.usage.total_tokens
                }
            },
            toString() {
                return this.content;
            }
        };
        return response;
    }

    async *completeStream(request: LLMRequest): AsyncIterable<LLMResponse> {
        const metrics = createMetricsTracker();

        try {
            metrics.trackOperation('stream_preparation');
            
            // Get API key from config
            const apiKey = this.config.apiKey;
            if (!apiKey) {
                throw new Error('OpenAI API key not found in config');
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: request.messages,
                    temperature: this.config.temperature || 0.7,
                    max_tokens: this.config.maxTokens || 2000,
                    stream: true
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
            }

            if (!response.body) {
                throw new Error('No response body received');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n').filter(line => line.trim() !== '');
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = JSON.parse(line.slice(6));
                            if (data.choices?.[0]?.delta?.content) {
                                const streamResponse: LLMResponse = {
                                    content: data.choices[0].delta.content,
                                    model: this.model,
                                    role: 'assistant',
                                    usage: {
                                        prompt_tokens: 0,
                                        completion_tokens: 0,
                                        total_tokens: 0
                                    },
                                    toString() {
                                        return this.content;
                                    }
                                };
                                yield streamResponse;
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } catch (error) {
            logger.error(LogCategory.AI, 'OpenAI streaming error', {
                metadata: {
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
            throw error;
        }
    }

    private isOpenAICompletion(obj: any): obj is OpenAICompletion {
        return obj && 
               typeof obj.content === 'string' && 
               obj.usage && 
               typeof obj.usage.prompt_tokens === 'number' &&
               typeof obj.usage.completion_tokens === 'number' &&
               typeof obj.usage.total_tokens === 'number';
    }
} 