import { 
    LLMProvider, 
    LLMConfig, 
    LLMRequest, 
    LLMResponse 
} from './types';
import { OpenAIProvider } from './providers/openai';
import { logger, LogCategory } from '../utils/logger';
import { envConfig } from '../utils/env';

export class LLMHandler {
    private static instance: LLMHandler;
    private providers: Map<string, LLMProvider>;
    private defaultProvider?: string;

    private constructor() {
        this.providers = new Map();
        this.initializeDefaultProviders().catch(error => {
            logger.error(LogCategory.AI, 'Failed to initialize default providers', {
                metadata: {
                    error: error.message
                }
            });
        });
    }

    static getInstance(): LLMHandler {
        if (!LLMHandler.instance) {
            LLMHandler.instance = new LLMHandler();
        }
        return LLMHandler.instance;
    }

    private async initializeDefaultProviders(): Promise<void> {
        // Initialize OpenAI if API key is provided
        if (envConfig.openaiApiKey) {
            logger.info(LogCategory.AI, 'Initializing OpenAI provider with API key:', {
                metadata: {
                    apiKey: envConfig.openaiApiKey,
                    source: 'envConfig',
                    file: require.resolve('../utils/env')
                }
            });
            
            await this.registerProvider({
                provider: 'openai',
                model: envConfig.defaultModel,
                apiKey: envConfig.openaiApiKey,  // Always use env API key
                temperature: envConfig.defaultTemperature,
                maxTokens: envConfig.defaultMaxTokens,
                timeout: envConfig.requestTimeoutMs
            });
            // Always set OpenAI as default provider
            this.defaultProvider = 'openai';
            
            logger.info(LogCategory.AI, 'Provider registered successfully', {
                metadata: {
                    name: 'openai',
                    type: 'OpenAIProvider',
                    apiKey: envConfig.openaiApiKey
                }
            });
        } else {
            throw new Error('OpenAI API key is required in environment configuration');
        }
    }

    async registerProvider(config: LLMConfig): Promise<void> {
        const provider = config.provider?.toLowerCase();
        if (!provider || provider !== 'openai') {
            throw new Error('Only OpenAI provider is supported');
        }

        try {
            // Always use API key from environment config
            logger.info(LogCategory.AI, 'Registering provider with API key:', {
                metadata: {
                    providedKey: config.apiKey,
                    envKey: envConfig.openaiApiKey,
                    source: 'envConfig',
                    file: require.resolve('../utils/env')
                }
            });
            
            const providerConfig = {
                ...config,
                apiKey: envConfig.openaiApiKey
            };
            
            const provider = new OpenAIProvider(providerConfig);
            this.providers.set('openai', provider);
            logger.info(LogCategory.AI, 'Provider registered successfully', {
                metadata: {
                    name: provider.name,
                    type: provider.constructor.name,
                    apiKey: providerConfig.apiKey
                }
            });
        } catch (error: any) {
            logger.error(LogCategory.AI, 'Failed to register provider', {
                metadata: {
                    provider: 'openai',
                    error: error.message,
                    providedKey: config.apiKey,
                    envKey: envConfig.openaiApiKey
                }
            });
            throw error;
        }
    }

    getProvider(name?: string): LLMProvider {
        const providerName = name?.toLowerCase() || this.defaultProvider;
        if (!providerName) {
            throw new Error('No default provider set');
        }

        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Provider not found: ${providerName}`);
        }

        return provider;
    }

    async complete(request: LLMRequest): Promise<LLMResponse> {
        const provider = this.getProvider(request.provider);
        
        // If request includes config, update non-sensitive settings only
        if (request.llmConfig) {
            await this.registerProvider({
                provider: 'openai',
                apiKey: envConfig.openaiApiKey,  // Always use env API key
                ...request.llmConfig,  // Safe to spread as LLMRequestConfig doesn't include apiKey
                timeout: envConfig.requestTimeoutMs
            });
        }
        
        return provider.complete(request);
    }

    async *completeStream(
        request: LLMRequest, 
        providerName?: string
    ): AsyncGenerator<LLMResponse> {
        const provider = this.getProvider(providerName);
        
        // If request includes config, update non-sensitive settings only
        if (request.llmConfig) {
            await this.registerProvider({
                provider: 'openai',
                apiKey: envConfig.openaiApiKey,  // Always use env API key
                ...request.llmConfig,  // Safe to spread as LLMRequestConfig doesn't include apiKey
                timeout: envConfig.requestTimeoutMs
            });
        }
        
        if (!provider.supportsStreaming) {
            // Fallback to non-streaming
            const response = await provider.complete(request);
            yield response;
            return;
        }

        yield* provider.completeStream(request);
    }
} 