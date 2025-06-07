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
    role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
    content: string | null;
    name?: string; // Used for role: 'function' (legacy) AND role: 'tool' (name of the function that was called)
    tool_call_id?: string; // Used for role: 'tool'
    tool_calls?: {
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }[];
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
    } | "auto" | "none";
    tool_choice?: "none" | "auto" | { type: "function"; function: { name: string } };
    response_format?: { type: "text" | "json_object" };
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    provider?: string;
    llmConfig?: LLMRequestConfig;  // Only non-sensitive configuration
    expectsJsonResponse?: boolean; // ADDED: Hint that the caller expects a JSON-structured response
}

export interface LLMResponse {
    content: string | null;
    model: string;
    role: 'assistant';
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
    complete(request: LLMRequest, configOverride?: LLMRequestConfig): Promise<LLMResponse>;
    completeStream(request: LLMRequest, configOverride?: LLMRequestConfig): AsyncIterable<LLMResponse>;
} 