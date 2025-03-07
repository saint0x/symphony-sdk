import * as grpc from '@grpc/grpc-js';
import { ValidationError } from './cache/validation';
import { logger, LogCategory } from '../../../utils/logger';
import { ChainExecutor } from '../../../services/chain';
import { RateLimiter } from './middleware/rate-limiter';
import { CircuitBreaker } from './middleware/circuit-breaker';
import { AuthHandler } from './middleware/auth-handler';
import { ToolConfig, AgentConfig, TeamConfig, PipelineConfig } from '../../../types/sdk';

/**
 * Custom UntypedServiceImplementation that doesn't require an index signature
 * This allows us to implement service interfaces without the index signature requirement
 */
export interface CustomServiceImplementation {
    [methodName: string]: grpc.UntypedHandleCall;
}

/**
 * Type guard to check if an object is a gRPC unary call
 */
export function isUnaryCall(obj: any): obj is grpc.UntypedHandleCall {
    return typeof obj === 'function';
}

export interface ServiceMetadata {
    id: string;
    name: string;
    version: string;
    type: 'TOOL' | 'AGENT' | 'TEAM' | 'PIPELINE';
    status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
    description?: string;
    inputParams?: Array<{
        name: string;
        required: boolean;
        description: string;
    }>;
    customMetadata?: Record<string, any>;
    lastHeartbeat?: string;
    metrics?: {
        averageDuration?: number;
        successRate?: number;
        resourceUsage?: {
            averageMemory: number;
            averageCpu: number;
            peakMemory: number;
            peakCpu: number;
        };
    };
}

export interface ServiceContext {
    serviceId: string;
    callId: string;
    timestamp: string;
    metadata: Record<string, string>;
}

export interface CallResult {
    success: boolean;
    data?: any;
    error?: ValidationError;
    metrics: {
        startTime: string;
        endTime: string;
        duration: number;
        resourceUsage: {
            memory: number;
            cpu: number;
        };
    };
}

export interface ServiceHealth {
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    lastCheck: string;
    metrics: {
        uptime: number;
        successRate: number;
        averageLatency: number;
        errorRate: number;
    };
    issues?: string[];
}

export interface ServiceMethods {
    [key: string]: ((params: any) => Promise<any>) | ((params: any) => AsyncGenerator<any, void, unknown>);
}

export interface ServiceConfig {
    metadata: ServiceMetadata;
    methods: ServiceMethods;
}

export interface ServiceResult {
    success: boolean;
    data?: any;
    error?: Error;
    metrics?: {
        duration: number;
        startTime: number;
        endTime: number;
    };
}

export interface RateLimitConfig {
    maxRequestsPerSecond: number;
    maxRequestsPerMinute: number;
    keyPrefix: string;
}

export interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeoutMs: number;
    healthCheckEndpoint?: string;
    fallbackService?: string;
}

export interface AuthConfig {
    type: 'basic' | 'bearer' | 'oauth2';
    credentials?: {
        username?: string;
        password?: string;
        token?: string;
    };
    refreshToken?: () => Promise<string>;
    retryOnAuthFailure?: boolean;
}

export interface APIMiddleware {
    pre?: (request: any) => Promise<any>;
    post?: (response: any) => Promise<any>;
    error?: (error: any) => Promise<any>;
}

export interface ExternalAPIConfig {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    timeout?: number;
    retryConfig?: {
        maxRetries: number;
        backoffMs: number;
        maxBackoffMs: number;
    };
    errorHandling?: {
        retryOnStatus?: number[];
        fallbackValue?: any;
        transformError?: (error: any) => any;
    };
    rateLimit?: RateLimitConfig;
    circuitBreaker?: CircuitBreakerConfig;
    auth?: AuthConfig;
    middlewares?: APIMiddleware[];
    isStreaming?: boolean;
    streamChunkHandler?: (chunk: any) => Promise<void>;
    streamErrorHandler?: (error: any) => Promise<void>;
    keepAliveTimeout?: number;
    transformRequest?: (params: any) => Promise<any>;
    transformResponse?: (response: any) => Promise<any>;
    validateResponse?: (response: any) => boolean;
}

export interface ComponentService {
    metadata: ServiceMetadata;
    methods: ServiceMethods;
    health?: ServiceHealth;
    externalAPIs?: Record<string, ExternalAPIConfig>;
}

export interface ServiceRegistryConfig {
    enableMetrics?: boolean;
    enableHealthChecks?: boolean;
    enableCircuitBreakers?: boolean;
    enableRateLimiting?: boolean;
    enableAuthentication?: boolean;
}

export interface ServiceRegistry {
    executeCall(serviceId: string, methodName: string, request: any): Promise<CallResult>;
    registerService(service: ComponentService): Promise<void>;
    getService(serviceId: string): ComponentService | undefined;
    listServices(): ServiceMetadata[];
    getServiceHealth(serviceId: string): ServiceHealth | undefined;
    createTool(config: ToolConfig): Promise<ComponentService>;
    createAgent(config: AgentConfig): Promise<ComponentService>;
    createTeam(config: TeamConfig): Promise<ComponentService>;
    createPipeline(config: PipelineConfig): Promise<ComponentService>;
}

export interface ServiceDefinition {
    metadata: {
        id: string;
        name: string;
        version: string;
        type: 'TOOL' | 'AGENT' | 'TEAM' | 'PIPELINE';
        status: 'ACTIVE' | 'INACTIVE';
        customMetadata?: Record<string, any>;
    };
    methods: Record<string, (...args: any[]) => Promise<any>>;
}

// Service Registry Implementation
export class ServiceRegistry {
    private static instance: ServiceRegistry | null = null;
    private services: Map<string, ComponentService> = new Map();
    private chainExecutor: ChainExecutor;
    private healthChecks: Map<string, ServiceHealth> = new Map();
    private contextManager: any;
    private rateLimiters: Map<string, RateLimiter> = new Map();
    private circuitBreakers: Map<string, CircuitBreaker> = new Map();
    private authHandlers: Map<string, AuthHandler> = new Map();

    private constructor() {
        this.chainExecutor = new ChainExecutor();
    }

    static async getInstance(): Promise<ServiceRegistry>;
    static async getInstance(config?: ServiceRegistryConfig): Promise<ServiceRegistry> {
        if (!ServiceRegistry.instance) {
            ServiceRegistry.instance = new ServiceRegistry();
            // Initialize with config if provided
            if (config) {
                // Config initialization logic here
            }
        }
        return ServiceRegistry.instance;
    }

    public async registerService(service: ComponentService): Promise<void> {
        try {
            logger.debug(LogCategory.SYSTEM, 'Registering new service', {
                metadata: {
                    serviceId: service.metadata.id,
                    serviceName: service.metadata.name,
                    serviceType: service.metadata.type
                }
            });

            await this.validateService(service);
            this.services.set(service.metadata.id, service);
            
            // Register with chain executor if it's a tool with chain metadata
            if (service.metadata.type === 'TOOL' && service.metadata.customMetadata?.chained) {
                this.chainExecutor.registerTool({
                    name: service.metadata.id,
                    description: service.metadata.description || service.metadata.name,
                    chained: parseFloat(service.metadata.customMetadata.chained),
                    target: service.metadata.customMetadata.target,
                    inputs: (service.metadata.inputParams || []).map(p => p.name),
                    handler: async (input: any) => {
                        const result = await service.methods.execute(input);
                        return {
                            success: true,
                            result: result
                        };
                    }
                });
                logger.debug(LogCategory.SYSTEM, 'Tool registered with chain executor', {
                    metadata: {
                        toolId: service.metadata.id,
                        chainType: service.metadata.customMetadata.chained,
                        target: service.metadata.customMetadata.target
                    }
                });
            }

            this.healthChecks.set(service.metadata.id, {
                status: 'HEALTHY',
                lastCheck: new Date().toISOString(),
                metrics: {
                    uptime: 0,
                    successRate: 1,
                    averageLatency: 0,
                    errorRate: 0
                }
            });

            await this.contextManager.updateServiceContext({
                type: 'SERVICE_REGISTERED',
                serviceId: service.metadata.id,
                timestamp: new Date().toISOString(),
                metadata: service.metadata
            });

            logger.info(LogCategory.SYSTEM, 'Service registered successfully', {
                metadata: {
                    serviceId: service.metadata.id,
                    serviceName: service.metadata.name
                }
            });
        } catch (error: any) {
            logger.error(LogCategory.SYSTEM, 'Failed to register service', {
                metadata: {
                    serviceId: service.metadata.id,
                    error: error.message,
                    stack: error.stack
                }
            });
            throw new Error(`Failed to register service: ${error.message}`);
        }
    }

    private async executeExternalAPICall(
        apiConfig: ExternalAPIConfig,
        params: any
    ): Promise<any> {
        const serviceId = apiConfig.url;

        // Apply rate limiting
        if (apiConfig.rateLimit) {
            const limiter = this.rateLimiters.get(serviceId) || 
                new RateLimiter(apiConfig.rateLimit);
            this.rateLimiters.set(serviceId, limiter);
            await limiter.acquire();
        }

        // Check circuit breaker
        if (apiConfig.circuitBreaker) {
            const breaker = this.circuitBreakers.get(serviceId) || 
                new CircuitBreaker(apiConfig.circuitBreaker);
            this.circuitBreakers.set(serviceId, breaker);
            if (!breaker.isAllowed()) {
                if (apiConfig.circuitBreaker.fallbackService) {
                    return this.executeCall(
                        apiConfig.circuitBreaker.fallbackService,
                        'execute',
                        params
                    );
                }
                throw new Error('Circuit breaker is open');
            }
        }

        // Handle authentication
        if (apiConfig.auth) {
            const authHandler = this.authHandlers.get(serviceId) || 
                new AuthHandler(apiConfig.auth);
            this.authHandlers.set(serviceId, authHandler);
            const authHeaders = await authHandler.getAuthHeaders();
            apiConfig.headers = { ...apiConfig.headers, ...authHeaders };
        }

        // Apply pre-request middleware
        let transformedParams = params;
        if (apiConfig.middlewares?.length) {
            for (const middleware of apiConfig.middlewares) {
                if (middleware.pre) {
                    transformedParams = await middleware.pre(transformedParams);
                }
            }
        }

        // Transform request if configured
        if (apiConfig.transformRequest) {
            transformedParams = await apiConfig.transformRequest(transformedParams);
        }

        let retryCount = 0;
        const maxRetries = apiConfig.retryConfig?.maxRetries ?? 3;
        const baseBackoff = apiConfig.retryConfig?.backoffMs ?? 1000;
        const maxBackoff = apiConfig.retryConfig?.maxBackoffMs ?? 10000;

        while (true) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => {
                    controller.abort();
                }, apiConfig.timeout ?? 30000);

                const response = await fetch(apiConfig.url, {
                    method: apiConfig.method ?? 'GET',
                    headers: apiConfig.headers ?? {},
                    body: apiConfig.method !== 'GET' ? JSON.stringify(transformedParams) : undefined,
                    signal: controller.signal
                });

                clearTimeout(timeout);

                if (!response.ok) {
                    // Handle auth failure
                    if (response.status === 401 && apiConfig.auth?.retryOnAuthFailure) {
                        const authHandler = this.authHandlers.get(serviceId);
                        if (authHandler) {
                            await authHandler.refreshAuth();
                            const newHeaders = await authHandler.getAuthHeaders();
                            apiConfig.headers = { ...apiConfig.headers, ...newHeaders };
                            continue;
                        }
                    }

                    const shouldRetry = apiConfig.errorHandling?.retryOnStatus?.includes(response.status);
                    if (shouldRetry && retryCount < maxRetries) {
                        retryCount++;
                        const backoff = Math.min(baseBackoff * Math.pow(2, retryCount), maxBackoff);
                        await new Promise(resolve => setTimeout(resolve, backoff));
                        continue;
                    }

                    // Update circuit breaker
                    if (apiConfig.circuitBreaker) {
                        const breaker = this.circuitBreakers.get(serviceId);
                        breaker?.recordFailure();
                    }

                    if (apiConfig.errorHandling?.fallbackValue !== undefined) {
                        logger.warn(LogCategory.SYSTEM, 'Using fallback value for failed API call', {
                            metadata: {
                                url: apiConfig.url,
                                status: response.status,
                                attempt: retryCount + 1
                            }
                        });
                        return apiConfig.errorHandling.fallbackValue;
                    }

                    const error = await response.text();
                    throw new Error(`API call failed: ${error}`);
                }

                // Handle streaming response
                if (apiConfig.isStreaming) {
                    if (!response.body) {
                        throw new Error('No response body for streaming request');
                    }

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();

                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            const chunk = decoder.decode(value, { stream: true });
                            if (apiConfig.streamChunkHandler) {
                                await apiConfig.streamChunkHandler(chunk);
                            }
                        }
                        return;
                    } catch (error) {
                        if (apiConfig.streamErrorHandler) {
                            await apiConfig.streamErrorHandler(error);
                        }
                        throw error;
                    }
                }

                let result = await response.json();

                // Apply response transformation
                if (apiConfig.transformResponse) {
                    result = await apiConfig.transformResponse(result);
                }

                // Validate response if configured
                if (apiConfig.validateResponse && !apiConfig.validateResponse(result)) {
                    throw new Error('Response validation failed');
                }

                // Apply post-response middleware
                if (apiConfig.middlewares?.length) {
                    for (const middleware of apiConfig.middlewares) {
                        if (middleware.post) {
                            result = await middleware.post(result);
                        }
                    }
                }

                // Update circuit breaker
                if (apiConfig.circuitBreaker) {
                    const breaker = this.circuitBreakers.get(serviceId);
                    breaker?.recordSuccess();
                }

                return result;

            } catch (error: any) {
                // Apply error middleware
                if (apiConfig.middlewares?.length) {
                    for (const middleware of apiConfig.middlewares) {
                        if (middleware.error) {
                            try {
                                return await middleware.error(error);
                            } catch (middlewareError) {
                                error = middlewareError;
                            }
                        }
                    }
                }

                if (error.name === 'AbortError') {
                    throw new Error(`API call timed out after ${apiConfig.timeout}ms`);
                }

                if (retryCount < maxRetries) {
                    retryCount++;
                    const backoff = Math.min(baseBackoff * Math.pow(2, retryCount), maxBackoff);
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    continue;
                }

                // Update circuit breaker
                if (apiConfig.circuitBreaker) {
                    const breaker = this.circuitBreakers.get(serviceId);
                    breaker?.recordFailure();
                }

                if (apiConfig.errorHandling?.transformError) {
                    return apiConfig.errorHandling.transformError(error);
                }

                throw error;
            } finally {
                // Release rate limiter
                if (apiConfig.rateLimit) {
                    const limiter = this.rateLimiters.get(serviceId);
                    limiter?.release();
                }
            }
        }
    }

    public async executeCall(
        serviceId: string,
        methodName: string,
        request: any
    ): Promise<CallResult> {
        const startTime = new Date();
        const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        logger.debug(LogCategory.SYSTEM, 'Executing service call', {
            metadata: {
                serviceId,
                methodName,
                callId,
                requestParams: Object.keys(request)
            }
        });

        try {
            const service = this.services.get(serviceId);
            if (!service) {
                logger.error(LogCategory.SYSTEM, 'Service not found', {
                    metadata: {
                        id: serviceId
                    }
                });
                throw new Error(`Service not found: ${serviceId}`);
            }

            // Check for external API configuration
            if (service.externalAPIs?.[methodName]) {
                const apiConfig = service.externalAPIs[methodName];
                const result = await this.executeExternalAPICall(apiConfig, request);
                
                const endTime = new Date();
                return {
                    success: true,
                    data: result,
                    metrics: {
                        startTime: startTime.toISOString(),
                        endTime: endTime.toISOString(),
                        duration: endTime.getTime() - startTime.getTime(),
                        resourceUsage: await this.calculateResourceUsage()
                    }
                };
            }

            // Check if this is a chained tool execution
            if (service.metadata.type === 'TOOL' && 
                service.metadata.customMetadata?.chained && 
                parseFloat(service.metadata.customMetadata.chained) === 1) {
                logger.debug(LogCategory.SYSTEM, 'Initiating chain execution', {
                    metadata: {
                        initialTool: serviceId,
                        chainType: service.metadata.customMetadata.chained
                    }
                });
                const chainResult = await this.chainExecutor.executeChain(serviceId, request);
                if (!chainResult) {
                    logger.error(LogCategory.SYSTEM, 'Chain execution failed', {
                        metadata: {
                            id: serviceId
                        }
                    });
                    return {
                        success: false,
                        error: {
                            errorCode: 'CHAIN_EXECUTION_FAILED',
                            message: 'Chain execution returned no result',
                            component: serviceId,
                            severity: 'ERROR'
                        },
                        metrics: {
                            startTime: startTime.toISOString(),
                            endTime: new Date().toISOString(),
                            duration: new Date().getTime() - startTime.getTime(),
                            resourceUsage: await this.calculateResourceUsage()
                        }
                    };
                }
                return chainResult;
            }

            // Execute the method
            const method = service.methods[methodName];
            if (!method) {
                logger.error(LogCategory.SYSTEM, 'Method not found', {
                    metadata: {
                        id: serviceId,
                        method: methodName
                    }
                });
                throw new Error(`Method not found: ${methodName}`);
            }

            const result = await (async () => {
                const methodResult = method(request);
                if (methodResult instanceof Promise) {
                    return await methodResult;
                } else if (methodResult[Symbol.asyncIterator]) {
                    const results = [];
                    for await (const item of methodResult) {
                        results.push(item);
                    }
                    return results;
                }
                return methodResult;
            })();

            const endTime = new Date();

            // Update health metrics
            const health = this.healthChecks.get(serviceId);
            if (health) {
                health.lastCheck = endTime.toISOString();
                health.metrics.successRate = (health.metrics.successRate * 9 + 1) / 10;
                health.metrics.averageLatency = (health.metrics.averageLatency * 9 + (endTime.getTime() - startTime.getTime())) / 10;
                health.metrics.errorRate = (health.metrics.errorRate * 9) / 10;
            }

            return {
                success: true,
                data: result,
                metrics: {
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    duration: endTime.getTime() - startTime.getTime(),
                    resourceUsage: await this.calculateResourceUsage()
                }
            };
        } catch (error: any) {
            const endTime = new Date();

            // Update health metrics
            const health = this.healthChecks.get(serviceId);
            if (health) {
                health.lastCheck = endTime.toISOString();
                health.metrics.successRate = (health.metrics.successRate * 9) / 10;
                health.metrics.averageLatency = (health.metrics.averageLatency * 9 + (endTime.getTime() - startTime.getTime())) / 10;
                health.metrics.errorRate = (health.metrics.errorRate * 9 + 1) / 10;
            }

            logger.error(LogCategory.SYSTEM, 'Service call failed', {
                metadata: {
                    serviceId,
                    methodName,
                    error: error.message,
                    stack: error.stack
                }
            });

            return {
                success: false,
                error: {
                    errorCode: error.code || 'EXECUTION_ERROR',
                    message: error.message,
                    component: serviceId,
                    severity: 'ERROR'
                },
                metrics: {
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    duration: endTime.getTime() - startTime.getTime(),
                    resourceUsage: await this.calculateResourceUsage()
                }
            };
        }
    }

    private async calculateResourceUsage(): Promise<{ memory: number; cpu: number }> {
        return {
            memory: process.memoryUsage().heapUsed / 1024 / 1024,
            cpu: process.cpuUsage().user / 1000000
        };
    }

    private async validateService(service: ComponentService): Promise<void> {
        if (!service.metadata.id) {
            throw new Error('Service ID is required');
        }
        if (!service.metadata.name) {
            throw new Error('Service name is required');
        }
        if (!service.metadata.version) {
            throw new Error('Service version is required');
        }
        if (!service.metadata.type) {
            throw new Error('Service type is required');
        }
        if (!service.methods || Object.keys(service.methods).length === 0) {
            throw new Error('Service must have at least one method');
        }
    }

    public getService(serviceId: string): ComponentService | undefined {
        return this.services.get(serviceId);
    }

    public listServices(): ServiceMetadata[] {
        return Array.from(this.services.values()).map(service => service.metadata);
    }

    public getServiceHealth(serviceId: string): ServiceHealth | undefined {
        return this.healthChecks.get(serviceId);
    }
} 