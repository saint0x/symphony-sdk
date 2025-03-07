import { logger, LogCategory } from '../../utils/logger';
import { LLMProvider, LLMConfig, LLMRequest, LLMResponse } from '../types';

interface OpenAIResponse {
    model: string;
    choices: Array<{
        message: {
            content: string;
            function_call?: {
                name: string;
                arguments: string;
            };
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export class OpenAIProvider implements LLMProvider {
    private config: LLMConfig;
    private initialized: boolean = false;
    readonly name: string = 'openai';

    constructor(config: LLMConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        if (!this.config.apiKey) {
            throw new Error('OpenAI API key is required');
        }
        this.initialized = true;
        logger.info(LogCategory.AI, 'OpenAI provider initialized');
    }

    async complete(request: LLMRequest): Promise<LLMResponse> {
        if (!this.initialized) {
            throw new Error('Provider not initialized');
        }

        logger.debug(LogCategory.AI, 'Sending request to OpenAI', {
            metadata: {
                model: this.config.model,
                messages: request.messages.length
            }
        });

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: request.messages,
                    temperature: request.temperature ?? this.config.temperature ?? 0.7,
                    max_tokens: request.maxTokens ?? this.config.maxTokens,
                    functions: request.functions,
                    function_call: request.functionCall
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenAI API error: ${error}`);
            }

            const result = await response.json() as OpenAIResponse;

            logger.info(LogCategory.AI, 'Received response from OpenAI', {
                metadata: {
                    model: result.model,
                    usage: result.usage,
                    finishReason: result.choices[0].finish_reason
                }
            });

            return {
                content: [{
                    type: 'text',
                    text: result.choices[0].message.content
                }],
                model: result.model,
                role: 'assistant',
                usage: {
                    input_tokens: result.usage.prompt_tokens,
                    output_tokens: result.usage.completion_tokens,
                    total_tokens: result.usage.total_tokens
                },
                functionCall: result.choices[0].message.function_call ? {
                    name: result.choices[0].message.function_call.name,
                    arguments: result.choices[0].message.function_call.arguments
                } : undefined
            };
        } catch (error) {
            logger.error(LogCategory.AI, 'OpenAI API error', {
                metadata: {
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
            throw error;
        }
    }

    async *completeStream(request: LLMRequest): AsyncGenerator<LLMResponse, void, unknown> {
        if (!this.initialized) {
            throw new Error('Provider not initialized');
        }

        logger.debug(LogCategory.AI, 'Starting streaming request to OpenAI', {
            metadata: {
                model: this.config.model,
                messages: request.messages.length
            }
        });

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: request.messages,
                    temperature: request.temperature ?? this.config.temperature ?? 0.7,
                    max_tokens: request.maxTokens ?? this.config.maxTokens,
                    stream: true
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenAI API error: ${error}`);
            }

            if (!response.body) {
                throw new Error('No response body from OpenAI API');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') break;

                        try {
                            const result = JSON.parse(data) as OpenAIResponse;
                            yield {
                                content: [{
                                    type: 'text',
                                    text: result.choices[0].message.content
                                }],
                                model: result.model,
                                role: 'assistant',
                                usage: {
                                    input_tokens: result.usage.prompt_tokens,
                                    output_tokens: result.usage.completion_tokens,
                                    total_tokens: result.usage.total_tokens
                                }
                            };
                        } catch (parseError) {
                            logger.warn(LogCategory.AI, 'Failed to parse streaming response', {
                                metadata: {
                                    data,
                                    error: parseError instanceof Error ? parseError.message : 'Unknown error'
                                }
                            });
                        }
                    }
                }
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
} 