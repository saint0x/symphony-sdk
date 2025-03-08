import { BaseManager } from '../../managers/base';
import { ISymphony, IComponentManager } from '../interfaces/types';
import { ComponentInstance, ComponentMetadata, Component, ComponentPath } from '../../types/metadata';

export class ComponentManager extends BaseManager implements IComponentManager {
    private static instance: ComponentManager;
    private _components: Map<string, ComponentInstance>;

    private constructor(symphony: ISymphony) {
        super(symphony, 'ComponentManager');
        this._components = new Map();
    }

    static getInstance(symphony: ISymphony): ComponentManager {
        if (!ComponentManager.instance) {
            ComponentManager.instance = new ComponentManager(symphony);
        }
        return ComponentManager.instance;
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing component manager');
    }

    async shutdown(): Promise<void> {
        this.logInfo('Shutting down component manager');
        this._components.clear();
    }

    async register(metadata: ComponentMetadata, instance: Component): Promise<void> {
        if (this._components.has(metadata.id)) {
            throw new Error(`Component ${metadata.id} already registered`);
        }
        
        const componentInstance: ComponentInstance = {
            metadata,
            instance,
            status: 'pending'
        };

        try {
            if ('initialize' in instance && typeof instance.initialize === 'function') {
                await instance.initialize();
            }
            componentInstance.status = 'ready';
            componentInstance.lastInitialized = Date.now();
        } catch (error) {
            componentInstance.status = 'error';
            componentInstance.error = error as Error;
            throw error;
        }

        this._components.set(metadata.id, componentInstance);
        this.logInfo('Registered component', { id: metadata.id });
    }

    findComponents(capability: string): ComponentInstance[] {
        return Array.from(this._components.values())
            .filter(component => 
                component.status === 'ready' && 
                component.metadata.capabilities.some(cap => cap.name === capability)
            );
    }

    findOptimalPath(inputCapability: string, outputCapability: string): ComponentPath | null {
        // For now, just find a direct path
        const components = Array.from(this._components.values())
            .filter(component => 
                component.status === 'ready' &&
                component.metadata.capabilities.some(cap => cap.name === inputCapability) &&
                component.metadata.capabilities.some(cap => cap.name === outputCapability)
            );

        if (components.length === 0) return null;

        // Return the component with the best metrics
        const bestComponent = components.reduce((best, current) => {
            const bestMetrics = best.metadata.metrics || {};
            const currentMetrics = current.metadata.metrics || {};
            
            const bestScore = (bestMetrics.successRate || 0) / (bestMetrics.averageLatency || 1);
            const currentScore = (currentMetrics.successRate || 0) / (currentMetrics.averageLatency || 1);
            
            return currentScore > bestScore ? current : best;
        });

        return {
            components: [bestComponent.metadata.id],
            totalLatency: bestComponent.metadata.metrics?.averageLatency || 0,
            successProbability: bestComponent.metadata.metrics?.successRate || 1
        };
    }

    getComponent(id: string): ComponentInstance | undefined {
        return this._components.get(id);
    }
} 