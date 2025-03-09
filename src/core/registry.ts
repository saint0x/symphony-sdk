import { Logger, LogCategory } from '../utils/logger';
import { BaseManager } from '../managers/base';

interface ServiceInstance {
    id: string;
    capabilities: string[];
    status: 'pending' | 'ready' | 'error';
    lastError?: Error;
}

export class Registry extends BaseManager {
    private services = new Map<string, ServiceInstance>();
    private capabilities = new Map<string, Set<string>>();
    private logger: Logger;

    constructor() {
        super(null as any, 'Registry');
        this.logger = Logger.getInstance('Registry');
    }

    registerService(service: ServiceInstance): void {
        // O(1) service registration
        this.services.set(service.id, service);
        
        // O(1) capability indexing
        service.capabilities.forEach(cap => {
            if (!this.capabilities.has(cap)) {
                this.capabilities.set(cap, new Set());
            }
            this.capabilities.get(cap)!.add(service.id);
        });
        
        this.logger.debug(LogCategory.SYSTEM, `Service registered: ${service.id}`, {
            metadata: {
                capabilities: service.capabilities,
                serviceId: service.id
            }
        });
    }

    findServicesByCapability(capability: string): ServiceInstance[] {
        // O(1) capability lookup
        const serviceIds = this.capabilities.get(capability) || new Set();
        return Array.from(serviceIds)
            .map(id => this.services.get(id)!)
            .filter(service => service.status === 'ready');
    }

    getService(id: string): ServiceInstance | undefined {
        return this.services.get(id);
    }

    updateServiceStatus(id: string, status: 'pending' | 'ready' | 'error', error?: Error): void {
        const service = this.services.get(id);
        if (service) {
            service.status = status;
            service.lastError = error;
            
            this.logger.debug(LogCategory.SYSTEM, `Service status updated: ${id}`, {
                metadata: {
                    status,
                    serviceId: id,
                    error: error?.message
                }
            });
        }
    }

    protected async initializeInternal(): Promise<void> {
        // Clear existing registrations on initialization
        this.services.clear();
        this.capabilities.clear();
        
        this.logger.info(LogCategory.SYSTEM, 'Registry initialized');
    }
} 