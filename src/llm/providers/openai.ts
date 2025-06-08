import { logger, LogCategory } from '../../utils/logger';
import { LLMConfig, LLMRequest, LLMResponse, LLMRequestConfig } from '../types';
import OpenAI from 'openai';
import { BaseLLMProvider, ExtendedLLMConfig } from './base';
import { LLMError, ErrorCode } from '../../errors/index';

export class OpenAIProvider extends BaseLLMProvider {
    readonly name = 'openai';
    readonly supportsStreaming = true;
    readonly supportsFunctions = true;
    private client: OpenAI;

    constructor(config: LLMConfig) {
        // Convert to ExtendedLLMConfig with defaults
        const extendedConfig: ExtendedLLMConfig = {
            ...config,
            provider: 'openai',
            apiKey: config?.apiKey || process.env.OPENAI_API_KEY || '',
            model: config?.model || 'gpt-3.5-turbo',
            timeout: config?.timeout || 30000
        };

        // Check for API key early
        if (!extendedConfig.apiKey) {
            throw new LLMError(
                ErrorCode.MISSING_API_KEY,
                'OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable or provide it in config.',
                { 
                    hasEnvKey: !!process.env.OPENAI_API_KEY,
                    hasConfigKey: !!config?.apiKey 
                },
                { component: 'OpenAIProvider', operation: 'constructor' }
            );
        }

        super(extendedConfig);

        this.client = new OpenAI({
            apiKey: extendedConfig.apiKey,
            timeout: extendedConfig.timeout || 30000,
        });
    }

    async initialize(): Promise<void> {
        this.validateApiKey();
        logger.info(LogCategory.AI, 'OpenAIProvider initialized', {
            model: this.config.model || 'gpt-3.5-turbo'
        });
    }

    async complete(request: LLMRequest, requestConfig?: LLMRequestConfig): Promise<LLMResponse> {
        try {
            this.validateRequest(request);
            
            const model = requestConfig?.model || this.config.model || 'gpt-3.5-turbo';
            const temperature = requestConfig?.temperature || this.config.temperature || 0.7;
            const maxTokens = requestConfig?.maxTokens || this.config.maxTokens;

            const openaiRequest: OpenAI.Chat.ChatCompletionCreateParams = {
                model,
                messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
                temperature,
                max_tokens: maxTokens,
                stream: false
            };

            // Add function support if provided
            if (request.functions && request.functions.length > 0) {
                if (!this.supportsFunctions) {
                    throw new LLMError(
                        ErrorCode.LLM_API_ERROR,
                        'This provider does not support function calling',
                        { provider: this.name, functions: request.functions },
                        { component: 'OpenAIProvider', operation: 'complete' }
                    );
                }
                
                openaiRequest.tools = request.functions.map(func => ({
                    type: 'function' as const,
                    function: {
                        name: func.name,
                        description: func.description,
                        parameters: func.parameters
                    }
                }));
                
                if (request.functionCall) {
                    if (request.functionCall === 'auto') {
                        openaiRequest.tool_choice = 'auto';
                    } else if (request.functionCall === 'none') {
                        openaiRequest.tool_choice = 'none';
                    } else if (typeof request.functionCall === 'object' && request.functionCall.name) {
                        openaiRequest.tool_choice = {
                            type: 'function',
                            function: { name: request.functionCall.name }
                        };
                    }
                }
            }

            const response = await this.client.chat.completions.create(openaiRequest);
            const choice = response.choices[0];
            const content = choice.message.content || '';

            return {
                content,
                model: model,
                role: 'assistant',
                usage: response.usage ? {
                    prompt_tokens: response.usage.prompt_tokens,
                    completion_tokens: response.usage.completion_tokens,
                    total_tokens: response.usage.total_tokens
                } : {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0
                },
                tool_calls: choice.message.tool_calls?.map(call => ({
                    id: call.id,
                    type: call.type,
                    function: call.function
                })),
                toString() {
                    return String(content);
                }
            };
        } catch (error: any) {
            throw this.handleError(error);
        }
    }

    async *completeStream(request: LLMRequest, requestConfig?: LLMRequestConfig): AsyncIterable<LLMResponse> {
        try {
            this.validateRequest(request);
            
            const model = requestConfig?.model || this.config.model || 'gpt-3.5-turbo';
            const temperature = requestConfig?.temperature || this.config.temperature || 0.7;
            const maxTokens = requestConfig?.maxTokens || this.config.maxTokens;

            const openaiRequest: OpenAI.Chat.ChatCompletionCreateParams = {
                model,
                messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
                temperature,
                max_tokens: maxTokens,
                stream: true
            };

            const apiKey = this.config.apiKey;
            if (!apiKey) {
                throw new LLMError(
                    ErrorCode.MISSING_API_KEY,
                    'OpenAI API key not found in provider config',
                    { hasConfigKey: !!this.config.apiKey },
                    { component: 'OpenAIProvider', operation: 'completeStream' }
                );
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify(openaiRequest),
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorJson;
                try {
                    errorJson = JSON.parse(errorText);
                } catch {
                    throw new LLMError(
                        ErrorCode.LLM_API_ERROR,
                        `OpenAI API streaming error (${response.status}): ${errorText}`,
                        { status: response.status, responseText: errorText },
                        { component: 'OpenAIProvider', operation: 'completeStream' }
                    );
                }
                throw new LLMError(
                    response.status === 429 ? ErrorCode.LLM_RATE_LIMITED : ErrorCode.LLM_API_ERROR,
                    `OpenAI API streaming error (${response.status}): ${errorJson.error?.message || errorText}`,
                    { status: response.status, error: errorJson },
                    { component: 'OpenAIProvider', operation: 'completeStream' }
                );
            }

            if (!response.body) {
                throw new LLMError(
                    ErrorCode.LLM_API_ERROR,
                    'No response body received for stream',
                    { status: response.status },
                    { component: 'OpenAIProvider', operation: 'completeStream' }
                );
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(data);
                                const choice = parsed.choices?.[0];
                                if (choice) {
                                    const deltaContent = choice.delta?.content || '';
                                    yield {
                                        content: deltaContent,
                                        model: model,
                                        role: 'assistant',
                                        usage: parsed.usage ? {
                                            prompt_tokens: parsed.usage.prompt_tokens,
                                            completion_tokens: parsed.usage.completion_tokens,
                                            total_tokens: parsed.usage.total_tokens
                                        } : {
                                            prompt_tokens: 0,
                                            completion_tokens: 0,
                                            total_tokens: 0
                                        },
                                        toString() {
                                            return String(deltaContent);
                                        }
                                    };
                                }
                            } catch (parseError) {
                                // Skip malformed chunks
                                continue;
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } catch (error: any) {
            throw this.handleError(error);
        }
    }

    protected handleError(error: any): never {
        logger.error(LogCategory.AI, `${this.name} provider error`, {
            metadata: {
                error: error.message,
                stack: error.stack
            }
        });

        // Convert OpenAI-specific errors to SymphonyErrors
        if (error.status === 401) {
            throw new LLMError(
                ErrorCode.MISSING_API_KEY,
                'OpenAI API authentication failed - invalid API key',
                error,
                { component: 'OpenAIProvider', operation: 'handleError' }
            );
        }

        if (error.status === 429) {
            throw new LLMError(
                ErrorCode.LLM_RATE_LIMITED,
                'OpenAI API rate limit exceeded',
                error,
                { component: 'OpenAIProvider', operation: 'handleError' }
            );
        }

        if (error.status === 402 || error.message?.includes('quota')) {
            throw new LLMError(
                ErrorCode.LLM_QUOTA_EXCEEDED,
                'OpenAI API quota exceeded',
                error,
                { component: 'OpenAIProvider', operation: 'handleError' }
            );
        }

        if (error.status >= 400 && error.status < 500) {
            throw new LLMError(
                ErrorCode.LLM_INVALID_RESPONSE,
                `OpenAI API client error: ${error.message}`,
                error,
                { component: 'OpenAIProvider', operation: 'handleError' }
            );
        }

        if (error.status >= 500) {
            throw new LLMError(
                ErrorCode.LLM_API_ERROR,
                `OpenAI API server error: ${error.message}`,
                error,
                { component: 'OpenAIProvider', operation: 'handleError' }
            );
        }

        // Generic fallback
        throw new LLMError(
            ErrorCode.LLM_API_ERROR,
            `OpenAI API error: ${error.message}`,
            error,
            { component: 'OpenAIProvider', operation: 'handleError' }
        );
    }
}