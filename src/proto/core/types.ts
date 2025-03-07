import { ExecutionMetrics } from '../../types/sdk';
import { logger, LogCategory } from '../../utils/logger';

// Service metadata
export interface ServiceMetadata {
    id: string;
    name: string;
    version: string;
    type: 'TOOL' | 'AGENT' | 'TEAM' | 'PIPELINE';
    status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
    customMetadata?: Record<string, any>;
}

// Service method definition
export interface ServiceMethod {
    name: string;
    handler: (params: any) => Promise<any>;
    streaming?: boolean;
}

// Service definition
export interface Service {
    metadata: ServiceMetadata;
    methods: Record<string, ServiceMethod>;
}

// Call result
export interface CallResult {
    success: boolean;
    data?: any;
    error?: {
        message: string;
        code: string;
        details?: any;
    };
    metrics?: ExecutionMetrics;
}

// Service registry for managing services and executing calls
export class ServiceRegistry {
    private static instance: ServiceRegistry | null = null;
    private services: Map<string, Service> = new Map();

    private constructor() {}

    static async getInstance(): Promise<ServiceRegistry> {
        if (!ServiceRegistry.instance) {
            ServiceRegistry.instance = new ServiceRegistry();
        }
        return ServiceRegistry.instance;
    }

    async registerService(service: Service): Promise<void> {
        logger.debug(LogCategory.GRPC, 'Registering service', {
            metadata: {
                id: service.metadata.id,
                type: service.metadata.type,
                methods: Object.keys(service.methods)
            }
        });

        if (this.services.has(service.metadata.id)) {
            throw new Error(`Service with ID ${service.metadata.id} already registered`);
        }

        this.services.set(service.metadata.id, service);

        logger.info(LogCategory.GRPC, 'Service registered successfully', {
            metadata: {
                id: service.metadata.id,
                type: service.metadata.type
            }
        });
    }

    async executeCall(serviceId: string, method: string, params: any): Promise<CallResult> {
        const startTime = Date.now();

        logger.debug(LogCategory.GRPC, 'Executing service call', {
            metadata: {
                serviceId,
                method,
                params: Object.keys(params)
            }
        });

        try {
            const service = this.services.get(serviceId);
            if (!service) {
                throw new Error(`Service ${serviceId} not found`);
            }

            const serviceMethod = service.methods[method];
            if (!serviceMethod) {
                throw new Error(`Method ${method} not found in service ${serviceId}`);
            }

            const result = await serviceMethod.handler(params);

            const metrics: ExecutionMetrics = {
                duration: Date.now() - startTime,
                startTime,
                endTime: Date.now()
            };

            logger.info(LogCategory.GRPC, 'Service call completed successfully', {
                metadata: {
                    serviceId,
                    method,
                    duration: metrics.duration
                }
            });

            return {
                success: true,
                data: result,
                metrics
            };
        } catch (error: any) {
            logger.error(LogCategory.GRPC, 'Service call failed', {
                metadata: {
                    serviceId,
                    method,
                    error: error.message,
                    stack: error.stack
                }
            });

            return {
                success: false,
                error: {
                    message: error.message,
                    code: 'EXECUTION_ERROR',
                    details: error.stack
                },
                metrics: {
                    duration: Date.now() - startTime,
                    startTime,
                    endTime: Date.now()
                }
            };
        }
    }

    async executeStreamingCall(serviceId: string, method: string, params: any): Promise<AsyncIterable<any>> {
        logger.debug(LogCategory.GRPC, 'Executing streaming service call', {
            metadata: {
                serviceId,
                method,
                params: Object.keys(params)
            }
        });

        try {
            const service = this.services.get(serviceId);
            if (!service) {
                throw new Error(`Service ${serviceId} not found`);
            }

            const serviceMethod = service.methods[method];
            if (!serviceMethod) {
                throw new Error(`Method ${method} not found in service ${serviceId}`);
            }

            if (!serviceMethod.streaming) {
                throw new Error(`Method ${method} in service ${serviceId} is not a streaming method`);
            }

            return serviceMethod.handler(params);
        } catch (error: any) {
            logger.error(LogCategory.GRPC, 'Streaming service call failed', {
                metadata: {
                    serviceId,
                    method,
                    error: error.message,
                    stack: error.stack
                }
            });

            throw error;
        }
    }

    getService(serviceId: string): Service | undefined {
        return this.services.get(serviceId);
    }

    listServices(): ServiceMetadata[] {
        return Array.from(this.services.values()).map(service => service.metadata);
    }
} 