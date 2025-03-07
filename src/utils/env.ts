import dotenv from 'dotenv';
import { logger, LogCategory } from './logger';

// Load environment variables
dotenv.config();

// Environment configuration interface
export interface EnvConfig {
    // OpenAI Configuration
    openaiApiKey: string;
    defaultModel: string;
    defaultTemperature: number;
    defaultMaxTokens: number;

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

// Default configuration values
const DEFAULT_CONFIG: EnvConfig = {
    openaiApiKey: '',
    defaultModel: 'gpt-4',
    defaultTemperature: 0.7,
    defaultMaxTokens: 1000,
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
            // Handle custom endpoints
            if (key.endsWith('_ENDPOINT')) {
                config.customEndpoints = config.customEndpoints || {};
                config.customEndpoints[key.replace('_ENDPOINT', '').toLowerCase()] = value || '';
            }
            // Handle custom models
            if (key.endsWith('_MODEL')) {
                config.customModels = config.customModels || {};
                config.customModels[key.replace('_MODEL', '').toLowerCase()] = value || '';
            }
            // Handle custom providers
            if (key.endsWith('_PROVIDER_CONFIG')) {
                config.customProviders = config.customProviders || {};
                try {
                    config.customProviders[key.replace('_PROVIDER_CONFIG', '').toLowerCase()] = 
                        value ? JSON.parse(value) : {};
                } catch (e) {
                    logger.warn(LogCategory.SYSTEM, `Failed to parse provider config for ${key}`, {
                        metadata: { error: e instanceof Error ? e.message : String(e) }
                    });
                }
            }

            // Handle external API configurations
            if (key.endsWith('_API_CONFIG')) {
                const apiName = key.replace('_API_CONFIG', '').toLowerCase();
                try {
                    config.externalAPIs = config.externalAPIs || {};
                    const apiConfig = JSON.parse(value || '{}');
                    
                    // Handle headers from environment variables
                    const headerPrefix = `${apiName.toUpperCase()}_HEADER_`;
                    Object.entries(process.env)
                        .filter(([envKey]) => envKey.startsWith(headerPrefix))
                        .forEach(([envKey, headerValue]) => {
                            const headerName = envKey.replace(headerPrefix, '').toLowerCase();
                            apiConfig.headers = apiConfig.headers || {};
                            apiConfig.headers[headerName] = headerValue;
                        });

                    config.externalAPIs[apiName] = apiConfig;
                    
                    logger.debug(LogCategory.SYSTEM, `Loaded API configuration for ${apiName}`, {
                        metadata: {
                            url: apiConfig.url,
                            method: apiConfig.method,
                            hasHeaders: Object.keys(apiConfig.headers || {}).length > 0
                        }
                    });
                } catch (e) {
                    logger.warn(LogCategory.SYSTEM, `Failed to parse API config for ${apiName}`, {
                        metadata: { error: e instanceof Error ? e.message : String(e) }
                    });
                }
            }
        });

        // Load standard configuration
        config.openaiApiKey = process.env.OPENAI_API_KEY || '';
        config.defaultModel = process.env.DEFAULT_MODEL || config.defaultModel;
        config.defaultTemperature = parseFloat(process.env.DEFAULT_TEMPERATURE || String(config.defaultTemperature));
        config.defaultMaxTokens = parseInt(process.env.DEFAULT_MAX_TOKENS || String(config.defaultMaxTokens), 10);

        // Service Configuration
        config.requestTimeoutMs = parseInt(process.env.REQUEST_TIMEOUT_MS || String(config.requestTimeoutMs), 10);
        config.maxConcurrentRequests = parseInt(process.env.MAX_CONCURRENT_REQUESTS || String(config.maxConcurrentRequests), 10);
        config.retryAttempts = parseInt(process.env.RETRY_ATTEMPTS || String(config.retryAttempts), 10);
        config.retryDelayMs = parseInt(process.env.RETRY_DELAY_MS || String(config.retryDelayMs), 10);

        // Logging Configuration
        config.logLevel = process.env.LOG_LEVEL || config.logLevel;
        config.enableConsoleLogging = process.env.ENABLE_CONSOLE_LOGGING === 'true';
        config.enableFileLogging = process.env.ENABLE_FILE_LOGGING === 'true';
        config.logFilePath = process.env.LOG_FILE_PATH || config.logFilePath;

        // Cache Configuration
        config.cacheEnabled = process.env.CACHE_ENABLED === 'true';
        config.cacheTTLSeconds = parseInt(process.env.CACHE_TTL_SECONDS || String(config.cacheTTLSeconds), 10);
        config.maxCacheSize = parseInt(process.env.MAX_CACHE_SIZE || String(config.maxCacheSize), 10);

        // Metrics Configuration
        config.metricsEnabled = process.env.METRICS_ENABLED === 'true';
        config.metricsFlushIntervalMs = parseInt(process.env.METRICS_FLUSH_INTERVAL_MS || String(config.metricsFlushIntervalMs), 10);
        config.metricsRetentionHours = parseInt(process.env.METRICS_RETENTION_HOURS || String(config.metricsRetentionHours), 10);

        // Validate external API configurations
        if (config.externalAPIs) {
            Object.entries(config.externalAPIs).forEach(([name, api]) => {
                if (!api.url) {
                    throw new Error(`URL is required for external API: ${name}`);
                }
                if (api.method && !['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(api.method.toUpperCase())) {
                    throw new Error(`Invalid HTTP method for external API ${name}: ${api.method}`);
                }
                if (api.timeout && api.timeout < 0) {
                    throw new Error(`Invalid timeout for external API ${name}: ${api.timeout}`);
                }
                if (api.retryConfig) {
                    if (api.retryConfig.maxRetries < 0) {
                        throw new Error(`Invalid maxRetries for external API ${name}: ${api.retryConfig.maxRetries}`);
                    }
                    if (api.retryConfig.backoffMs < 0) {
                        throw new Error(`Invalid backoffMs for external API ${name}: ${api.retryConfig.backoffMs}`);
                    }
                }
            });
        }

        // Validate configuration
        validateConfig(config);

        logger.info(LogCategory.SYSTEM, 'Environment configuration loaded successfully', {
            metadata: {
                customEndpoints: Object.keys(config.customEndpoints || {}),
                customModels: Object.keys(config.customModels || {}),
                customProviders: Object.keys(config.customProviders || {}),
                externalAPIs: Object.keys(config.externalAPIs || {})
            }
        });
        return config;
    } catch (error: any) {
        logger.error(LogCategory.SYSTEM, 'Failed to load environment configuration', {
            metadata: {
                error: error.message,
                stack: error.stack
            }
        });
        throw error;
    }
}

// Validate required configuration values
function validateConfig(config: EnvConfig): void {
    // Validate API keys
    if (!config.openaiApiKey) {
        throw new Error('OPENAI_API_KEY is required');
    }
    if (config.openaiApiKey && !config.openaiApiKey.startsWith('sk-')) {
        throw new Error('Invalid OpenAI API key format');
    }

    // Validate temperature
    if (config.defaultTemperature < 0 || config.defaultTemperature > 1) {
        throw new Error('DEFAULT_TEMPERATURE must be between 0 and 1');
    }

    // Validate token limits
    if (config.defaultMaxTokens < 1) {
        throw new Error('DEFAULT_MAX_TOKENS must be greater than 0');
    }

    // Validate timeouts and retries
    if (config.requestTimeoutMs < 1000) {
        throw new Error('REQUEST_TIMEOUT_MS must be at least 1000');
    }
    if (config.maxConcurrentRequests < 1) {
        throw new Error('MAX_CONCURRENT_REQUESTS must be at least 1');
    }
    if (config.retryAttempts < 0) {
        throw new Error('RETRY_ATTEMPTS must be non-negative');
    }
    if (config.retryDelayMs < 0) {
        throw new Error('RETRY_DELAY_MS must be non-negative');
    }

    // Validate cache settings
    if (config.cacheTTLSeconds < 0) {
        throw new Error('CACHE_TTL_SECONDS must be non-negative');
    }
    if (config.maxCacheSize < 0) {
        throw new Error('MAX_CACHE_SIZE must be non-negative');
    }

    // Validate metrics settings
    if (config.metricsFlushIntervalMs < 1000) {
        throw new Error('METRICS_FLUSH_INTERVAL_MS must be at least 1000');
    }
    if (config.metricsRetentionHours < 1) {
        throw new Error('METRICS_RETENTION_HOURS must be at least 1');
    }

    // Validate custom configurations
    if (config.customEndpoints) {
        Object.entries(config.customEndpoints).forEach(([key, value]) => {
            if (!value || !value.startsWith('http')) {
                throw new Error(`Invalid endpoint URL for ${key}`);
            }
        });
    }

    if (config.customModels) {
        Object.entries(config.customModels).forEach(([key, value]) => {
            if (!value) {
                throw new Error(`Invalid model name for ${key}`);
            }
        });
    }
}

// Export configuration
export const envConfig = loadConfig(); 