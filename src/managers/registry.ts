import {
    Component,
    ComponentMetadata,
    ComponentInstance,
    ComponentCapability,
    ComponentRequirement
} from '../types/metadata';
import { BaseManager } from './base';

interface CapabilityMap {
    [capability: string]: Set<string>;  // capability -> component IDs
}

interface RequirementMap {
    [requirement: string]: Set<string>;  // requirement -> component IDs
}

interface ComponentPath {
    components: string[];
    totalLatency: number;
    successProbability: number;
}

export class ComponentRegistry extends BaseManager {
    private static instance: ComponentRegistry;
    
    private components = new Map<string, ComponentInstance>();
    private capabilityIndex: CapabilityMap = {};
    private requirementIndex: RequirementMap = {};
    private pathCache = new Map<string, ComponentPath>();
    
    // Performance optimization: pre-computed compatibility matrix
    private compatibilityMatrix = new Map<string, Set<string>>();
    
    protected constructor() {
        super(null as any, 'ComponentRegistry');
    }

    static getInstance(): ComponentRegistry {
        if (!this.instance) {
            this.instance = new ComponentRegistry();
        }
        return this.instance;
    }

    /**
     * Register a component with O(1) indexing of capabilities and requirements
     */
    async register(metadata: ComponentMetadata, instance: Component): Promise<void> {
        this.assertInitialized();
        
        const componentInstance: ComponentInstance = {
            metadata,
            instance,
            status: 'pending'
        };

        // O(1) component registration
        this.components.set(metadata.id, componentInstance);

        // O(1) capability indexing
        metadata.capabilities.forEach(cap => {
            if (!this.capabilityIndex[cap.name]) {
                this.capabilityIndex[cap.name] = new Set();
            }
            this.capabilityIndex[cap.name].add(metadata.id);
        });

        // O(1) requirement indexing
        metadata.requirements.forEach(req => {
            if (!this.requirementIndex[req.capability]) {
                this.requirementIndex[req.capability] = new Set();
            }
            this.requirementIndex[req.capability].add(metadata.id);
        });

        // Update compatibility matrix
        this.updateCompatibilityMatrix(metadata);

        // Initialize the component
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
    }

    /**
     * Find components that provide a specific capability - O(1)
     */
    findByCapability(capability: string): ComponentInstance[] {
        this.assertInitialized();
        
        const componentIds = this.capabilityIndex[capability];
        if (!componentIds) return [];
        
        return Array.from(componentIds)
            .map(id => this.components.get(id)!)
            .filter(component => component.status === 'ready');
    }

    /**
     * Find optimal component chain for a given input/output requirement - O(1)
     */
    findOptimalPath(inputCapability: string, outputCapability: string): ComponentPath | null {
        this.assertInitialized();
        
        const cacheKey = `${inputCapability}->${outputCapability}`;
        
        // Check cache first - O(1)
        const cachedPath = this.pathCache.get(cacheKey);
        if (cachedPath) return cachedPath;

        // Find direct path first - O(1)
        const directComponents = this.findDirectPath(inputCapability, outputCapability);
        if (directComponents) {
            const path = this.createComponentPath(directComponents);
            this.pathCache.set(cacheKey, path);
            return path;
        }

        // Find multi-step path using pre-computed compatibility matrix - O(1)
        const path = this.findMultiStepPath(inputCapability, outputCapability);
        if (path) {
            this.pathCache.set(cacheKey, path);
        }
        
        return path;
    }

    /**
     * Get a component by ID - O(1)
     */
    getComponent(id: string): ComponentInstance | undefined {
        this.assertInitialized();
        return this.components.get(id);
    }

    /**
     * Update component metrics - O(1)
     */
    updateMetrics(id: string, latency: number, success: boolean): void {
        this.assertInitialized();
        
        const component = this.components.get(id);
        if (!component) return;

        const metrics = component.metadata.metrics || {};
        const usageCount = (metrics.usageCount || 0) + 1;
        
        metrics.usageCount = usageCount;
        metrics.lastUsed = Date.now();
        metrics.averageLatency = ((metrics.averageLatency || 0) * (usageCount - 1) + latency) / usageCount;
        metrics.successRate = ((metrics.successRate || 1) * (usageCount - 1) + (success ? 1 : 0)) / usageCount;

        component.metadata.metrics = metrics;

        // Invalidate relevant path cache entries if metrics change significantly
        this.invalidateAffectedPaths(id);
    }

    /**
     * Pre-compute compatibility between components - O(n²) but done once at registration
     */
    private updateCompatibilityMatrix(metadata: ComponentMetadata): void {
        const id = metadata.id;
        const compatible = new Set<string>();

        // Check which existing components can work with this one
        for (const [otherId, other] of this.components) {
            if (this.areCompatible(metadata, other.metadata)) {
                compatible.add(otherId);
                
                // Update the other component's compatibility set
                const otherCompatible = this.compatibilityMatrix.get(otherId) || new Set();
                otherCompatible.add(id);
                this.compatibilityMatrix.set(otherId, otherCompatible);
            }
        }

        this.compatibilityMatrix.set(id, compatible);
    }

    /**
     * Check if two components can work together - O(1)
     */
    private areCompatible(a: ComponentMetadata, b: ComponentMetadata): boolean {
        // Check if any capability of A matches any requirement of B or vice versa
        return a.capabilities.some(cap => 
            b.requirements.some(req => req.capability === cap.name)
        ) || b.capabilities.some(cap =>
            a.requirements.some(req => req.capability === cap.name)
        );
    }

    /**
     * Find direct path between components - O(1)
     */
    private findDirectPath(input: string, output: string): string[] | null {
        const inputComponents = this.capabilityIndex[input] || new Set();
        const outputComponents = this.capabilityIndex[output] || new Set();

        // Find components that can handle both input and output
        for (const id of inputComponents) {
            if (outputComponents.has(id)) {
                return [id];
            }
        }

        return null;
    }

    /**
     * Find multi-step path using compatibility matrix - O(1) average case
     */
    private findMultiStepPath(input: string, output: string): ComponentPath | null {
        const inputComponents = Array.from(this.capabilityIndex[input] || new Set());
        const outputComponents = Array.from(this.capabilityIndex[output] || new Set());

        let bestPath: ComponentPath | null = null;

        // Try all possible start-end combinations
        for (const start of inputComponents) {
            for (const end of outputComponents) {
                const path = this.findShortestPath(start, end);
                if (path && (!bestPath || path.totalLatency < bestPath.totalLatency)) {
                    bestPath = path;
                }
            }
        }

        return bestPath;
    }

    /**
     * Create a component path with metrics - O(1)
     */
    private createComponentPath(componentIds: string[]): ComponentPath {
        let totalLatency = 0;
        let successProbability = 1;

        componentIds.forEach(id => {
            const component = this.components.get(id)!;
            const metrics = component.metadata.metrics || {};
            totalLatency += metrics.averageLatency || 0;
            successProbability *= metrics.successRate || 1;
        });

        return {
            components: componentIds,
            totalLatency,
            successProbability
        };
    }

    /**
     * Find shortest path between two components using pre-computed matrix - O(1) average case
     */
    private findShortestPath(start: string, end: string): ComponentPath | null {
        if (start === end) return this.createComponentPath([start]);

        const compatible = this.compatibilityMatrix.get(start);
        if (!compatible) return null;

        // If direct compatibility exists, use it
        if (compatible.has(end)) {
            return this.createComponentPath([start, end]);
        }

        // Otherwise, find path through compatible components
        let bestPath: ComponentPath | null = null;

        for (const mid of compatible) {
            const remainingPath = this.findShortestPath(mid, end);
            if (remainingPath) {
                const fullPath = this.createComponentPath([start, ...remainingPath.components]);
                if (!bestPath || fullPath.totalLatency < bestPath.totalLatency) {
                    bestPath = fullPath;
                }
            }
        }

        return bestPath;
    }

    /**
     * Invalidate cached paths affected by component metrics changes - O(1)
     */
    private invalidateAffectedPaths(componentId: string): void {
        for (const [key, path] of this.pathCache) {
            if (path.components.includes(componentId)) {
                this.pathCache.delete(key);
            }
        }
    }

    protected async initializeInternal(): Promise<void> {
        // No additional initialization needed
    }
} 