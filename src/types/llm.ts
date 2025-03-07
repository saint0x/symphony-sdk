export interface LLMConfig {
    provider: 'openai' | 'anthropic' | 'google';
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMRequest {
    messages: LLMMessage[];
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}

export interface LLMResponse {
    content: string;
    model: string;
    role: 'assistant';
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface LLMProvider {
    name: string;
    supportsStreaming: boolean;
    initialize(): Promise<void>;
    complete(request: LLMRequest): Promise<LLMResponse>;
    completeStream(request: LLMRequest): AsyncIterable<LLMResponse>;
} 