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
    private cacheService?: any; // ICacheService from Symphony

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

    // Set cache service from Symphony
    setCacheService(cacheService: any): void {
        this.cacheService = cacheService;
    }

    // Get cache service for providers
    getCacheService(): any {
        return this.cacheService;
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
        const providerName = config.provider?.toLowerCase();
        if (!providerName) {
            throw new Error('Provider name must be specified in LLMConfig');
        }

        // For now, only OpenAI is instantiated, extend this for other providers
        if (providerName !== 'openai') {
            logger.warn(LogCategory.AI, `Provider ${providerName} not fully supported for dynamic registration, only OpenAI for now.`);
            // throw new Error(`Provider ${providerName} is not supported for dynamic registration yet.`);
            // Allow it to proceed if it's just updating an existing openai config
            if (providerName !== 'openai' && !this.providers.has(providerName)) {
                 throw new Error(`Provider ${providerName} is not supported for dynamic registration yet.`);
            }
        }

        try {
            let finalConfig = { ...config };
            // Ensure API key from environment for OpenAI for security, can be adapted for other providers
            if (providerName === 'openai') {
                if (!envConfig.openaiApiKey) {
                    throw new Error('OpenAI API key not found in environment for registration.');
                }
                finalConfig.apiKey = envConfig.openaiApiKey;
            }
            // Add similar logic for other providers if they source API keys from env

            // Log what config is being used for provider registration
            logger.debug(LogCategory.AI, `Registering/Updating provider ${providerName} with config:`, {
                model: finalConfig.model,
                temperature: finalConfig.temperature,
                maxTokens: finalConfig.maxTokens,
                provider: finalConfig.provider
            });

            // Instantiate or update provider
            // This is simplified; a real multi-provider setup would have a factory or switch
            if (providerName === 'openai') {
                const providerInstance = new OpenAIProvider(finalConfig);
                this.providers.set(providerName, providerInstance);
            } else {
                // If other providers are pre-registered, this could update them
                // For now, this branch might not be hit if we throw error above for non-openai
                const existingProvider = this.providers.get(providerName);
                if (existingProvider) {
                    // Providers would need an updateConfig method for this to be clean
                    logger.warn(LogCategory.AI, `Updating existing provider ${providerName} via re-registration (not ideal).`);
                    // This creates a new instance, effectively replacing the old one.
                    // const updatedProvider = new WhatEverProvider(finalConfig);
                    // this.providers.set(providerName, updatedProvider);
                } else {
                     throw new Error(`No existing provider ${providerName} to update and dynamic creation not supported.`);
                }
            }
            
            if (!this.defaultProvider) {
                this.defaultProvider = providerName;
            }

            logger.info(LogCategory.AI, `Provider ${providerName} (re)registered successfully`);
        } catch (error: any) {
            logger.error(LogCategory.AI, 'Failed to register provider', { 
                providerName, 
                error: error.message 
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
        const targetProviderName = request.provider?.toLowerCase() || this.defaultProvider;
        if (!targetProviderName) {
            throw new Error('No provider specified in request and no default provider set.');
        }

        let providerInstance = this.providers.get(targetProviderName);

        if (!providerInstance) {
            // Attempt to initialize if it's a known type (e.g. openai) and config implies it
            if (targetProviderName === 'openai' && envConfig.openaiApiKey) {
                logger.warn(LogCategory.AI, `OpenAI provider for ${targetProviderName} not found, attempting on-demand initialization.`);
                await this.registerProvider({
                    provider: 'openai',
                    apiKey: envConfig.openaiApiKey,
                    model: request.llmConfig?.model || envConfig.defaultModel,
                    temperature: request.llmConfig?.temperature,
                    maxTokens: request.llmConfig?.maxTokens,
                });
                providerInstance = this.providers.get(targetProviderName);
                if (!providerInstance) throw new Error(`Failed to dynamically initialize provider: ${targetProviderName}`);
            } else {
                throw new Error(`Provider ${targetProviderName} not found or not configured for on-demand initialization.`);
            }
        }
        
        // If request includes llmConfig, we might need to use a provider instance
        // that reflects these specific settings. The current approach of global
        // re-registration in `registerProvider` will affect subsequent calls.
        // A truly request-specific provider instance or config override on the provider is ideal.
        if (request.llmConfig) {
            // Create a combined config for this request
            const currentProviderConfig = (providerInstance as any).config as LLMConfig; // Cast to access config
            const requestSpecificConfig: LLMConfig = {
                provider: targetProviderName as any,
                apiKey: currentProviderConfig.apiKey, // Keep original API key
                model: request.llmConfig.model || currentProviderConfig.model,
                temperature: request.llmConfig.temperature ?? currentProviderConfig.temperature,
                maxTokens: request.llmConfig.maxTokens ?? currentProviderConfig.maxTokens,
                timeout: request.llmConfig.timeout ?? currentProviderConfig.timeout,
            };
            
            // Re-register the provider with this specific config for this call.
            // This means the provider instance stored in `this.providers` is updated.
            await this.registerProvider(requestSpecificConfig);
            providerInstance = this.providers.get(targetProviderName)!; // Re-fetch the updated provider
        }
        
        return providerInstance.complete(request);
    }

    async *completeStream(
        request: LLMRequest, 
        providerName?: string // providerName from argument is less common, request.provider takes precedence
    ): AsyncGenerator<LLMResponse> {
        const targetProviderName = request.provider?.toLowerCase() || providerName?.toLowerCase() || this.defaultProvider;
        if (!targetProviderName) {
            throw new Error('No provider specified in request or argument, and no default provider set.');
        }

        let providerInstance = this.providers.get(targetProviderName);

        if (!providerInstance) {
            if (targetProviderName === 'openai' && envConfig.openaiApiKey) {
                logger.warn(LogCategory.AI, `OpenAI provider for ${targetProviderName} not found in completeStream, attempting on-demand initialization.`);
                await this.registerProvider({
                    provider: 'openai',
                    apiKey: envConfig.openaiApiKey,
                    model: request.llmConfig?.model || envConfig.defaultModel,
                    temperature: request.llmConfig?.temperature,
                    maxTokens: request.llmConfig?.maxTokens,
                });
                providerInstance = this.providers.get(targetProviderName);
                if (!providerInstance) throw new Error(`Failed to dynamically initialize provider for stream: ${targetProviderName}`);
            } else {
                throw new Error(`Provider ${targetProviderName} not found or not configured for on-demand initialization for stream.`);
            }
        }
        
        if (request.llmConfig) {
            const currentProviderConfig = (providerInstance as any).config as LLMConfig;
            const requestSpecificConfig: LLMConfig = {
                provider: targetProviderName as any,
                apiKey: currentProviderConfig.apiKey,
                model: request.llmConfig.model || currentProviderConfig.model,
                temperature: request.llmConfig.temperature ?? currentProviderConfig.temperature,
                maxTokens: request.llmConfig.maxTokens ?? currentProviderConfig.maxTokens,
                timeout: request.llmConfig.timeout ?? currentProviderConfig.timeout,
            };
            
            await this.registerProvider(requestSpecificConfig);
            providerInstance = this.providers.get(targetProviderName)!;
        }
        
        if (!providerInstance.supportsStreaming) {
            // Fallback to non-streaming
            const response = await providerInstance.complete(request);
            yield response;
            return;
        }

        yield* providerInstance.completeStream(request);
    }
} 