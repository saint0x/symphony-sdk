import dotenv from 'dotenv';
import path from 'path';
import { logger, LogCategory } from './logger';

// Only load from local .env in user's project
const localEnvPath = path.resolve(process.cwd(), '.env');

// Log the environment file path
logger.info(LogCategory.SYSTEM, 'Loading environment from:', {
    metadata: {
        path: localEnvPath,
        exists: require('fs').existsSync(localEnvPath),
        currentDir: process.cwd()
    }
});

// Load environment variables from the local .env only
dotenv.config({ path: localEnvPath });

// Log the loaded OpenAI API key
logger.info(LogCategory.SYSTEM, 'Loaded OpenAI API key:', {
    metadata: {
        keyLength: process.env.OPENAI_API_KEY?.length,
        keyPrefix: process.env.OPENAI_API_KEY?.substring(0, 7)
    }
});

// Environment configuration interface
export interface EnvConfig {
    // OpenAI Configuration
    openaiApiKey: string;
    defaultModel: string;
    defaultTemperature: number;
    defaultMaxTokens: number;
    defaultTopP: number;
    defaultPresencePenalty: number;
    defaultFrequencyPenalty: number;

    // Service Configuration
    requestTimeoutMs: number;
    maxConcurrentRequests: number;
    retryAttempts: number;
    retryDelayMs: number;

    // Logging Configuration
    logLevel: string;
    enableConsoleLogging: boolean;
    enableFileLogging: boolean;
    logFilePath: string;

    // Cache Configuration
    cacheEnabled: boolean;
    cacheTTLSeconds: number;
    maxCacheSize: number;

    // Metrics Configuration
    metricsEnabled: boolean;
    metricsFlushIntervalMs: number;
    metricsRetentionHours: number;

    // Custom Configuration
    customEndpoints?: Record<string, string>;
    customModels?: Record<string, string>;
    customProviders?: Record<string, any>;

    // External API Configuration
    externalAPIs?: {
        [key: string]: {
            url: string;
            method?: string;
            headers?: Record<string, string>;
            timeout?: number;
            retryConfig?: {
                maxRetries: number;
                backoffMs: number;
                maxBackoffMs: number;
            };
            errorHandling?: {
                retryOnStatus?: number[];
                fallbackValue?: string;
                transformError?: string;
            };
        };
    };
}

// Default configuration values (no sensitive defaults)
const DEFAULT_CONFIG: EnvConfig = {
    openaiApiKey: '',
    defaultModel: 'gpt-4',
    defaultTemperature: 0.7,
    defaultMaxTokens: 1000,
    defaultTopP: 0.9,
    defaultPresencePenalty: 0.1,
    defaultFrequencyPenalty: 0.1,
    requestTimeoutMs: 30000,
    maxConcurrentRequests: 10,
    retryAttempts: 3,
    retryDelayMs: 1000,
    logLevel: 'info',
    enableConsoleLogging: true,
    enableFileLogging: false,
    logFilePath: './logs/symphonic.log',
    cacheEnabled: true,
    cacheTTLSeconds: 3600,
    maxCacheSize: 1000,
    metricsEnabled: true,
    metricsFlushIntervalMs: 60000,
    metricsRetentionHours: 24
};

// Load and validate environment variables
function loadConfig(): EnvConfig {
    const config = { ...DEFAULT_CONFIG };

    try {
        // Load all environment variables
        Object.entries(process.env).forEach(([key, value]) => {
            // Handle OpenAI configuration
            if (key === 'OPENAI_API_KEY') {
                config.openaiApiKey = value || '';
                logger.info(LogCategory.SYSTEM, 'Loaded OpenAI API key:', {
                    metadata: {
                        keyLength: value?.length || 0,
                        keyPrefix: value?.substring(0, 7) || 'none'
                    }
                });
            }
            // Handle custom endpoints
            else if (key.endsWith('_ENDPOINT')) {
                config.customEndpoints = config.customEndpoints || {};
                config.customEndpoints[key.replace('_ENDPOINT', '').toLowerCase()] = value || '';
            }
            // Handle custom models
            else if (key.endsWith('_MODEL')) {
                config.customModels = config.customModels || {};
                config.customModels[key.replace('_MODEL', '').toLowerCase()] = value || '';
            }
            // Handle custom providers
            else if (key.endsWith('_PROVIDER')) {
                config.customProviders = config.customProviders || {};
                config.customProviders[key.replace('_PROVIDER', '').toLowerCase()] = value || '';
            }
            // Handle external APIs
            else if (key.endsWith('_API')) {
                const apiName = key.replace('_API', '').toLowerCase();
                config.externalAPIs = config.externalAPIs || {};
                config.externalAPIs[apiName] = {
                    url: value || '',
                    timeout: config.requestTimeoutMs
                };
            }
        });

        // Log loaded configuration
        logger.info(LogCategory.SYSTEM, 'Environment configuration loaded successfully', {
            metadata: {
                customEndpoints: config.customEndpoints || [],
                customModels: config.customModels || [],
                customProviders: config.customProviders || [],
                externalAPIs: config.externalAPIs || []
            }
        });

        return config;
    } catch (error) {
        logger.error(LogCategory.SYSTEM, 'Failed to load environment configuration', {
            metadata: {
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        });
        return config;
    }
}

// Export the loaded configuration
export const envConfig = loadConfig(); 