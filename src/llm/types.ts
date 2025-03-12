import { ExecutionMetrics } from '../types/sdk';

// Base configuration that requires API key
export interface LLMConfig {
    provider: 'openai' | 'anthropic' | 'google';
    apiKey: string;  // Required but always sourced from environment
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}

// Configuration that can be passed in requests (no API key)
export interface LLMRequestConfig {
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
    llmConfig?: LLMRequestConfig;  // Only non-sensitive configuration
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