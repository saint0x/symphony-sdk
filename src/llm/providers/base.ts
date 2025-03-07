import { 
    LLMProvider, 
    LLMConfig, 
    LLMRequest, 
    LLMResponse,
    LLMFunctionDefinition
} from '../types';
import { ExecutionMetrics } from '../../types/sdk';
import { logger, LogCategory } from '../../utils/logger';

export interface ExtendedLLMConfig extends LLMConfig {
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    timeout?: number;
}

export interface ExtendedLLMRequest extends LLMRequest {
    functions?: LLMFunctionDefinition[];
    functionCall?: {
        name: string;
        arguments: any;
    };
}

export interface ExtendedLLMResponse extends LLMResponse {
    metrics?: ExecutionMetrics & {
        usage: LLMResponse['usage'];
    };
}

export abstract class BaseLLMProvider implements LLMProvider {
    name: string;
    protected config: ExtendedLLMConfig;
    public supportsStreaming: boolean = false;
    protected supportsFunctions: boolean = false;
    protected supportsVision: boolean = false;

    constructor(config: ExtendedLLMConfig) {
        if (!config.provider) {
            throw new Error('Provider name is required');
        }
        this.name = config.provider;
        this.config = {
            ...config,
            temperature: config.temperature ?? 0.7,
            maxTokens: config.maxTokens ?? 1000,
            topP: config.topP ?? 1,
            frequencyPenalty: config.frequencyPenalty ?? 0,
            presencePenalty: config.presencePenalty ?? 0,
            timeout: config.timeout ?? 30000
        };
    }

    abstract initialize(): Promise<void>;
    abstract complete(request: LLMRequest): Promise<LLMResponse>;
    abstract completeStream(request: LLMRequest): AsyncIterable<LLMResponse>;

    protected validateApiKey(): void {
        if (!this.config.apiKey) {
            throw new Error(`API key not provided for ${this.name} provider`);
        }
        if (typeof this.config.apiKey !== 'string') {
            throw new Error(`Invalid API key type for ${this.name} provider`);
        }
    }

    protected getStartTime(): number {
        return Date.now();
    }

    protected createMetrics(startTime: number, tokenUsage: { input: number; output: number }): ExecutionMetrics {
        const endTime = Date.now();
        return {
            duration: endTime - startTime,
            startTime,
            endTime,
            tokenUsage: {
                input: tokenUsage.input,
                output: tokenUsage.output,
                total: tokenUsage.input + tokenUsage.output
            }
        };
    }

    protected validateRequest(request: LLMRequest): void {
        if (!request.messages || !Array.isArray(request.messages)) {
            throw new Error('Invalid request: messages must be an array');
        }

        if (request.messages.length === 0) {
            throw new Error('Invalid request: messages array cannot be empty');
        }

        if (request.functions && !this.supportsFunctions) {
            throw new Error(`${this.name} provider does not support function calling`);
        }

        request.messages.forEach((message, index) => {
            if (!message.role || !message.content) {
                throw new Error(`Invalid message at index ${index}: must have role and content`);
            }
        });

        logger.debug(LogCategory.AI, 'Request validation passed', {
            metadata: {
                provider: this.name,
                messageCount: request.messages.length,
                hasFunctions: !!request.functions
            }
        });
    }

    protected async handleError(error: any): Promise<never> {
        logger.error(LogCategory.AI, `${this.name} provider error`, {
            metadata: {
                error: error.message,
                stack: error.stack
            }
        });

        throw new Error(`${this.name} provider error: ${error.message}`);
    }
} 