import { symphony } from '../symphony';
import { ComponentRegistry } from './registry';
import { BaseManager } from './base';
import { 
    Component,
    ComponentMetadata,
    ComponentInstance,
    CapabilityBuilder,
    CommonCapabilities,
    ComponentPath
} from '../types/metadata';

export class ComponentManager extends BaseManager {
    private static instance: ComponentManager;
    private registry: ComponentRegistry;

    protected constructor() {
        super(null as any, 'ComponentManager');
        this.registry = ComponentRegistry.getInstance();
    }

    static getInstance(): ComponentManager {
        if (!this.instance) {
            this.instance = new ComponentManager();
        }
        return this.instance;
    }

    /**
     * Register a component with automatic capability discovery
     */
    async register<T extends Component>(
        metadata: ComponentMetadata,
        instance: T
    ): Promise<T> {
        this.assertInitialized();
        await this.registry.register(metadata, instance);

        // Create a proxy to handle method calls with automatic routing
        return new Proxy(instance, {
            get: (target: any, prop: string | symbol) => {
                const original = target[prop];
                if (typeof original === 'function') {
                    return async (...args: any[]) => {
                        const startTime = Date.now();
                        try {
                            const result = await original.apply(target, args);
                            const latency = Date.now() - startTime;
                            this.registry.updateMetrics(metadata.id, latency, true);
                            return result;
                        } catch (error) {
                            const latency = Date.now() - startTime;
                            this.registry.updateMetrics(metadata.id, latency, false);
                            throw error;
                        }
                    };
                }
                return original;
            }
        });
    }

    /**
     * Find components by capability with automatic routing
     */
    findComponents(capability: string): ComponentInstance[] {
        this.assertInitialized();
        return this.registry.findByCapability(capability);
    }

    /**
     * Find optimal path between components
     */
    findOptimalPath(inputCapability: string, outputCapability: string): ComponentPath | null {
        this.assertInitialized();
        return this.registry.findOptimalPath(inputCapability, outputCapability);
    }

    /**
     * Get a specific component
     */
    getComponent(id: string): ComponentInstance | undefined {
        this.assertInitialized();
        return this.registry.getComponent(id);
    }

    protected async initializeInternal(): Promise<void> {
        // Initialize core services
        await symphony.initialize();
        
        // Initialize registry
        await this.registry.initialize();
        
        // Initialize core services in parallel
        await Promise.all([
            symphony.tools.initialize(),
            symphony.agent.initialize(),
            symphony.team.initialize(),
            symphony.pipeline.initialize()
        ]);

        // Initialize registry last to ensure all services are ready
        const registry = await symphony.getRegistry();
        if (registry) {
            await registry.initialize();
        }
    }
}

// Export types and utilities
export * from '../types/metadata';
export { ComponentRegistry } from './registry';
export { CapabilityBuilder, CommonCapabilities }; 