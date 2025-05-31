import { logger, LogCategory } from '../../utils/logger';
import { LLMConfig, LLMRequest, LLMResponse, LLMProvider, LLMFunctionDefinition } from '../types';
import { createMetricsTracker } from '../../utils/metrics';
import { LLMHandler } from '../handler';

interface OpenAICompletion {
    content: string | null;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    functionCall?: {
        id?: string;
        name: string;
        arguments: string;
    };
    tool_calls?: {
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }[];
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
        logger.info(LogCategory.AI, 'Initializing OpenAI provider with effective config:', {
            model: config.model || 'gpt-3.5-turbo',
            useFunctionCalling: config.useFunctionCalling,
            temperature: config.temperature
        });
        this.config = config;
        this.model = config.model || 'gpt-3.5-turbo';
    }

    async initialize(): Promise<void> {
        // OpenAI doesn't require initialization
    }

    async complete(request: LLMRequest): Promise<LLMResponse> {
        const metrics = createMetricsTracker();
        const llmHandler = LLMHandler.getInstance();
        const cache = llmHandler.getCacheService();

        try {
            metrics.trackOperation('request_preparation');
            const cacheKeyParts = ['openai', this.model, JSON.stringify(request.messages)];
            if (request.functions) {
                cacheKeyParts.push(JSON.stringify(request.functions));
            }
            const cacheKey = cacheKeyParts.join(':');
            
            if (cache) {
                const cached = await cache.get(cacheKey);
                if (cached && this.isOpenAICompletion(cached)) {
                    return this.formatResponse(cached);
                }
            }

            const apiKey = this.config.apiKey;
            if (!apiKey) {
                throw new Error('OpenAI API key not found in provider config');
            }

            const effectiveUseFunctionCalling = this.config.useFunctionCalling === true; // This flag now means "expect structured JSON output"
            // The request.response_format will specifically trigger OpenAI JSON mode.

            logger.info(LogCategory.AI, 'Making OpenAI API request with effective config:', {
                model: this.model,
                temperature: this.config.temperature,
                maxTokens: this.config.maxTokens,
                useFunctionCalling: effectiveUseFunctionCalling,
                numMessages: request.messages.length,
                numFunctions: request.functions?.length || 0
            });

            const body: any = {
                model: this.model,
                messages: request.messages,
                temperature: this.config.temperature ?? 0.7,
                max_tokens: this.config.maxTokens ?? 2000
            };

            // Check if JSON mode is requested
            if (request.response_format?.type === 'json_object') {
                body.response_format = { type: 'json_object' };
                logger.info(LogCategory.AI, 'OpenAI request: JSON mode enabled via response_format.');
                // When in JSON mode, 'tools' and 'tool_choice' are not sent.
            }

            metrics.trackOperation('api_request');
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(body)
            });

            metrics.trackOperation('response_processing');
            if (!response.ok) {
                const errorText = await response.text();
                this.logger.error(LogCategory.AI, 'OpenAI API error response:', { status: response.status, errorText });
                try {
                    const errorJson = JSON.parse(errorText);
                    throw new Error(`OpenAI API error (${response.status}): ${errorJson.error?.message || errorText}`);
                } catch (e) {
                    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
                }
            }

            const data = await response.json();
            const rawMessage = data.choices[0].message;

            const completion: OpenAICompletion = {
                content: rawMessage.content, // In JSON mode, this content IS the JSON string.
                usage: data.usage,
                functionCall: undefined, // No longer attempting to populate this from tool_calls
                tool_calls: rawMessage.tool_calls // This will likely be null/empty in JSON mode, store whatever OpenAI sends
            };

            // If using JSON mode, tool_calls won't be populated by OpenAI in the same way.
            // The content itself is the JSON. We no longer need to derive simplified functionCall from tool_calls here.
            if (request.response_format?.type === 'json_object') {
                logger.info(LogCategory.AI, 'OpenAI response in JSON mode. Content is the JSON payload.', { content: rawMessage.content });
            }

            if (cache) {
                await cache.set(cacheKey, completion);
            }

            return this.formatResponse(completion);
        } catch (error) {
            logger.error(LogCategory.AI, 'OpenAI API complete method error', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private formatResponse(completion: OpenAICompletion): LLMResponse {
        const now = Date.now();
        return {
            content: completion.content,
            model: this.model,
            role: 'assistant',
            functionCall: completion.functionCall,
            tool_calls: completion.tool_calls,
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
                return String(this.content);
            }
        };
    }

    async *completeStream(request: LLMRequest): AsyncIterable<LLMResponse> {
        // If JSON mode is requested, it's better to use the non-streaming complete() method
        // as the entire JSON object is expected as one coherent unit.
        if (request.response_format?.type === 'json_object') {
            logger.warn(LogCategory.AI, 'OpenAI completeStream: JSON mode requested. Falling back to non-streaming complete() call.');
            const response = await this.complete(request);
            yield response;
            return;
        }

        // Proceed with text streaming if not in JSON mode.
        // The old check for 'effectiveUseFunctionCalling && request.functions' is removed as that paradigm is gone.
        logger.info(LogCategory.AI, 'OpenAI completeStream: Proceeding with text streaming.');

        const metrics = createMetricsTracker();
        try {
            metrics.trackOperation('stream_preparation');
            const apiKey = this.config.apiKey;
            if (!apiKey) throw new Error('OpenAI API key not found in provider config');

            const body: any = {
                model: this.model,
                messages: request.messages,
                temperature: this.config.temperature ?? 0.7,
                max_tokens: this.config.maxTokens ?? 2000,
                stream: true
            };
             logger.info(LogCategory.AI, 'Making OpenAI streaming API request (no function calls)', { model: this.model });

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logger.error(LogCategory.AI, 'OpenAI API streaming error response:', { status: response.status, errorText });
                try {
                    const errorJson = JSON.parse(errorText);
                    throw new Error(`OpenAI API streaming error (${response.status}): ${errorJson.error?.message || errorText}`);
                } catch (e) {
                    throw new Error(`OpenAI API streaming error (${response.status}): ${errorText}`);
                }
            }
            if (!response.body) throw new Error('No response body received for stream');

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
                            const dataStr = line.slice(6);
                            if (dataStr.trim() === '[DONE]') break;
                            const data = JSON.parse(dataStr);
                            if (data.choices?.[0]?.delta?.content) {
                                yield {
                                    content: data.choices[0].delta.content,
                                    model: this.model,
                                    role: 'assistant',
                                    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                                    toString() { return String(this.content); }
                                };
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } catch (error) {
            logger.error(LogCategory.AI, 'OpenAI streaming error', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private isOpenAICompletion(obj: any): obj is OpenAICompletion {
        return obj && 
               (typeof obj.content === 'string' || obj.content === null) && 
               obj.usage && 
               typeof obj.usage.prompt_tokens === 'number' &&
               typeof obj.usage.completion_tokens === 'number' &&
               typeof obj.usage.total_tokens === 'number';
    }
}