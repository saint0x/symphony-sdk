import { logger, LogCategory } from '../../utils/logger';
import { LLMConfig, LLMRequest, LLMResponse, LLMProvider } from '../types';
import { createMetricsTracker } from '../../utils/metrics';
import { Logger } from '../../utils/logger';
import { envConfig } from '../../utils/env';
import OpenAI from 'openai';

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
    readonly name = 'openai';
    readonly supportsStreaming = true;
    private client: OpenAI;
    private config: LLMConfig;
    private logger: Logger;
    private model: string;

    constructor(config?: LLMConfig) {
        const openAIKey = config?.apiKey || envConfig.openaiApiKey;
        if (!openAIKey) {
            throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable or provide it in config.');
        }
        this.client = new OpenAI({ apiKey: openAIKey });
        this.config = { provider: 'openai', apiKey: openAIKey, ...config };
        this.logger = Logger.getInstance('OpenAIProvider');
        this.logger.info('OpenAIProvider', 'OpenAIProvider initialized', { model: this.config.model });
        this.model = this.config.model || 'gpt-3.5-turbo';
    }

    async initialize(): Promise<void> {
        // OpenAI doesn't require initialization
    }

    async complete(request: LLMRequest): Promise<LLMResponse> {
        const metrics = createMetricsTracker();
        // Caching logic is simplified for now, assuming it's handled by LLMHandler or CacheServiceWrapper if available.

        try {
            metrics.trackOperation('request_preparation');
            
            this.logger.info('OpenAIProvider', 'Making OpenAI API request via SDK client with effective config:', {
                model: this.model,
                temperature: this.config.temperature,
                maxTokens: this.config.maxTokens,
                expectsJsonResponse: request.expectsJsonResponse,
                numMessages: request.messages.length,
            });

            const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
                model: this.model,
                messages: request.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
                temperature: this.config.temperature ?? 0.7,
                max_tokens: this.config.maxTokens ?? 2000,
            };

            if (request.expectsJsonResponse) { 
                completionParams.response_format = { type: 'json_object' };
                this.logger.info('OpenAIProvider', 'OpenAI request: JSON mode enabled via response_format due to expectsJsonResponse flag.');
            }

            metrics.trackOperation('api_request');
            const response: OpenAI.Chat.Completions.ChatCompletion = await this.client.chat.completions.create(completionParams);

            metrics.trackOperation('response_processing');
            
            const rawMessage = response.choices[0].message;
            const usage = response.usage;

            const llmCompletion: OpenAICompletion = {
                content: rawMessage.content,
                usage: {
                    prompt_tokens: usage?.prompt_tokens || 0,
                    completion_tokens: usage?.completion_tokens || 0,
                    total_tokens: usage?.total_tokens || 0,
                },
                functionCall: rawMessage.function_call ? { name: rawMessage.function_call.name!, arguments: rawMessage.function_call.arguments } : undefined,
                tool_calls: rawMessage.tool_calls as any,
            };

            if (request.response_format?.type === 'json_object') {
                this.logger.info('OpenAIProvider', 'OpenAI response in JSON mode. Content is the JSON payload.', { content: rawMessage.content });
            }
            
            // Caching (if re-introduced) would happen here using a proper cache service.

            return this.formatResponse(llmCompletion);
        } catch (error) {
            this.logger.error('OpenAIProvider', 'OpenAI API complete method error (SDK client)', {
                error: error instanceof Error ? error.message : String(error)
            });
            if (error instanceof OpenAI.APIError) {
                throw new Error(`OpenAI API error (${error.status}): ${error.message} (Type: ${error.type})`);
            }
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
}