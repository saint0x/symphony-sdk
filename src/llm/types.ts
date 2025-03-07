// LLM Provider types
export interface LLMProvider {
    name: string;
    supportsStreaming?: boolean;
    initialize(): Promise<void>;
    complete(request: LLMRequest): Promise<LLMResponse>;
    completeStream(request: LLMRequest): AsyncIterable<LLMResponse>;
}

// LLM Configuration
export interface LLMConfig {
    provider?: string;
    apiKey: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    timeout?: number;
}

// LLM Request types
export interface LLMRequest {
    messages: LLMMessage[];
    maxTokens?: number;
    temperature?: number;
    functions?: LLMFunctionDefinition[];
    functionCall?: 'auto' | 'none' | { name: string };
    provider?: string;
}

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant' | 'function';
    content: string;
    name?: string;
    functionCall?: {
        name: string;
        arguments: string;
    };
}

export interface LLMFunctionDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, {
            type: string;
            description: string;
            enum?: string[];
        }>;
        required?: string[];
    };
}

// LLM Response types
export interface LLMResponse {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    model: string;
    role: 'assistant';
    usage: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
    };
    functionCall?: {
        name: string;
        arguments: string;
    };
} 