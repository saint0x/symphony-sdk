import { 
    LLMProvider, 
    LLMConfig, 
    LLMRequest, 
    LLMResponse,
    LLMFunctionDefinition
} from '../types';
import { ExecutionMetrics } from '../../types/sdk';
import { logger, LogCategory } from '../../utils/logger';
import { ConfigurationError, LLMError, ValidationError, ErrorCode } from '../../errors/index';

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
        tokenUsage: {
            input: number;
            output: number;
            total: number;
        };
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
            throw new ConfigurationError(
                'Provider name is required',
                { config },
                { component: 'BaseLLMProvider', operation: 'constructor' }
            );
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
            throw new LLMError(
                ErrorCode.MISSING_API_KEY,
                `API key not provided for ${this.name} provider`,
                { provider: this.name },
                { component: 'BaseLLMProvider', operation: 'validateApiKey' }
            );
        }
        if (typeof this.config.apiKey !== 'string') {
            throw new ValidationError(
                `Invalid API key type for ${this.name} provider`,
                { 
                    provider: this.name, 
                    apiKeyType: typeof this.config.apiKey,
                    expectedType: 'string'
                },
                { component: 'BaseLLMProvider', operation: 'validateApiKey' }
            );
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
            throw new ValidationError(
                'Invalid request: messages must be an array',
                { request, messageType: typeof request.messages },
                { component: 'BaseLLMProvider', operation: 'validateRequest' }
            );
        }

        if (request.messages.length === 0) {
            throw new ValidationError(
                'Invalid request: messages array cannot be empty',
                { request },
                { component: 'BaseLLMProvider', operation: 'validateRequest' }
            );
        }

        if (request.functions && !this.supportsFunctions) {
            throw new LLMError(
                ErrorCode.LLM_API_ERROR,
                `${this.name} provider does not support function calling`,
                { 
                    provider: this.name, 
                    supportsFunctions: this.supportsFunctions,
                    functionsRequested: request.functions.length
                },
                { component: 'BaseLLMProvider', operation: 'validateRequest' }
            );
        }

        request.messages.forEach((message, index) => {
            if (!message.role || !message.content) {
                throw new ValidationError(
                    `Invalid message at index ${index}: must have role and content`,
                    { 
                        message, 
                        index, 
                        hasRole: !!message.role, 
                        hasContent: !!message.content 
                    },
                    { component: 'BaseLLMProvider', operation: 'validateRequest' }
                );
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

        // If it's already a SymphonyError, just re-throw it
        if (error.code && error.component) {
            throw error;
        }

        // Convert generic errors to LLMError
        throw new LLMError(
            ErrorCode.LLM_API_ERROR,
            `${this.name} provider error: ${error.message}`,
            error,
            { component: 'BaseLLMProvider', operation: 'handleError' }
        );
    }
} 