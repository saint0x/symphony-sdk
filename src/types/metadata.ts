import { Component, ComponentConfig, ComponentType } from './components';

// Component metadata
export interface ComponentMetadata {
    id: string;
    name: string;
    description: string;
    type: ComponentType;
    capabilities: ComponentCapability[];
    requirements: ComponentRequirement[];
    config?: ComponentConfig;
    metrics?: {
        usageCount?: number;
        lastUsed?: number;
        averageLatency?: number;
        successRate?: number;
    };
}

// Component capability
export interface ComponentCapability {
    name: string;
    description: string;
    parameters?: Record<string, any>;
}

// Component requirement
export interface ComponentRequirement {
    capability: string;
    optional?: boolean;
    parameters?: Record<string, any>;
}

// Component instance
export interface ComponentInstance {
    metadata: ComponentMetadata;
    instance: Component;
    status: 'pending' | 'ready' | 'error';
    error?: Error;
    lastInitialized?: number;
}

// Component path for routing
export interface ComponentPath {
    components: string[];
    totalLatency: number;
    successProbability: number;
}

// Re-export component types
export type { Component, ComponentConfig, ComponentType };

// Export capability builder and common capabilities
export { CapabilityBuilder, CommonCapabilities } from './capabilities'; 