import { ExecutionMetrics } from '../types/sdk';

export interface LLMConfig {
    provider: 'openai' | 'anthropic' | 'google';
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant' | 'function';
    content: string;
    name?: string;
}

export interface LLMFunctionDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}

export interface LLMRequest {
    messages: LLMMessage[];
    functions?: LLMFunctionDefinition[];
    functionCall?: {
        name: string;
        arguments: any;
    };
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    provider?: string;
}

export interface LLMResponse {
    content: string;
    model: string;
    role: 'assistant';
    functionCall?: {
        name: string;
        arguments: string;
    };
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    metrics?: ExecutionMetrics & {
        tokenUsage: {
            input: number;
            output: number;
            total: number;
        };
    };
    toString(): string;
}

export interface LLMProvider {
    name: string;
    supportsStreaming: boolean;
    initialize(): Promise<void>;
    complete(request: LLMRequest): Promise<LLMResponse>;
    completeStream(request: LLMRequest): AsyncIterable<LLMResponse>;
} 