export class CapabilityBuilder {
    private capabilities: Set<string> = new Set();

    constructor(initialCapabilities?: string[]) {
        if (initialCapabilities) {
            initialCapabilities.forEach(cap => this.capabilities.add(cap));
        }
    }

    add(capability: string): CapabilityBuilder {
        this.capabilities.add(capability);
        return this;
    }

    addAll(capabilities: string[]): CapabilityBuilder {
        capabilities.forEach(cap => this.capabilities.add(cap));
        return this;
    }

    remove(capability: string): CapabilityBuilder {
        this.capabilities.delete(capability);
        return this;
    }

    has(capability: string): boolean {
        return this.capabilities.has(capability);
    }

    build(): string[] {
        return Array.from(this.capabilities);
    }
}

export const CommonCapabilities = {
    // Tool capabilities
    TOOL_EXECUTION: 'tool.execution',
    TOOL_CONFIGURATION: 'tool.configuration',
    TOOL_MANAGEMENT: 'tool.management',

    // Agent capabilities
    AGENT_EXECUTION: 'agent.execution',
    AGENT_CONFIGURATION: 'agent.configuration',
    AGENT_MANAGEMENT: 'agent.management',

    // Team capabilities
    TEAM_EXECUTION: 'team.execution',
    TEAM_CONFIGURATION: 'team.configuration',
    TEAM_MANAGEMENT: 'team.management',

    // Pipeline capabilities
    PIPELINE_EXECUTION: 'pipeline.execution',
    PIPELINE_CONFIGURATION: 'pipeline.configuration',
    PIPELINE_MANAGEMENT: 'pipeline.management',

    // Component capabilities
    COMPONENT_REGISTRATION: 'component.registration',
    COMPONENT_DISCOVERY: 'component.discovery',
    COMPONENT_MANAGEMENT: 'component.management',

    // Service capabilities
    SERVICE_REGISTRATION: 'service.registration',
    SERVICE_DISCOVERY: 'service.discovery',
    SERVICE_MANAGEMENT: 'service.management',

    // System capabilities
    SYSTEM_CONFIGURATION: 'system.configuration',
    SYSTEM_MONITORING: 'system.monitoring',
    SYSTEM_MANAGEMENT: 'system.management'
} as const; 