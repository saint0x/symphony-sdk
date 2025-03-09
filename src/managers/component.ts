import type { Symphony } from '../symphony';
import { BaseManager } from './base';
import { 
    Component,
    ComponentMetadata,
    ComponentInstance,
    CapabilityBuilder,
    CommonCapabilities,
    ComponentPath,
    ComponentType
} from '../types/metadata';
import { Registry } from '../symphony/registry';
import { 
    Agent,
    Tool,
    Team,
    Pipeline,
    AgentConfig,
    ToolConfig,
    TeamConfig,
    PipelineConfig
} from '../types/sdk';

export class ComponentManager extends BaseManager {
    private static instance: ComponentManager;
    private registry: Registry;
    private _symphony: Symphony | null = null;
    protected initialized: boolean = false;  // Changed to protected to match BaseManager

    protected constructor(symphony?: Symphony) {
        super(symphony || null as any, 'ComponentManager');
        this.registry = new Registry(symphony || null as any);
    }

    static getInstance(symphony?: Symphony): ComponentManager {
        if (!this.instance) {
            this.instance = new ComponentManager(symphony);
        }
        if (symphony && !this.instance._symphony) {
            this.instance.setSymphony(symphony);
        }
        return this.instance;
    }

    setSymphony(symphony: Symphony): void {
        this._symphony = symphony;
        (this as any).symphony = symphony;
        this.registry = new Registry(symphony);
    }

    /**
     * Register a component with automatic capability discovery
     */
    async register<T extends Component>(
        metadata: ComponentMetadata,
        instance: T
    ): Promise<T> {
        if (!this._symphony) {
            throw new Error('ComponentManager must be initialized with Symphony instance');
        }
        
        await this.registry.registerService({
            id: metadata.id,
            capabilities: metadata.capabilities.map(c => c.name),
            status: 'ready'
        });

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
                            this._symphony?.metrics.update(metadata.id, {
                                latency,
                                success: true,
                                lastCall: Date.now()
                            });
                            return result;
                        } catch (error) {
                            const latency = Date.now() - startTime;
                            this._symphony?.metrics.update(metadata.id, {
                                latency,
                                success: false,
                                error: error as Error,
                                lastCall: Date.now()
                            });
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
        const services = this.registry.findServicesByCapability(capability);
        return services.map(service => ({
            metadata: {
                id: service.id,
                name: service.id,
                description: 'Dynamically registered component',
                type: 'TOOL' as ComponentType,
                version: '1.0.0',
                capabilities: service.capabilities.map(c => ({
                    name: c,
                    description: `Provides ${c} capability`,
                    version: '1.0.0'
                })),
                requirements: [],
                provides: service.capabilities,
                tags: []
            },
            instance: {} as Component,
            status: service.status === 'ready' ? 'ready' : 'error'
        }));
    }

    /**
     * Find optimal path between components
     */
    findOptimalPath(outputCapability: string): ComponentPath | null {
        this.assertInitialized();
        const services = this.registry.findServicesByCapability(outputCapability);
        if (!services.length) return null;
        
        // Simple direct path for now
        return {
            components: [services[0].id],
            totalLatency: 0,
            successProbability: 1.0
        };
    }

    /**
     * Get a specific component
     */
    getComponent(id: string): ComponentInstance | undefined {
        this.assertInitialized();
        const service = this.registry.getService(id);
        if (!service) return undefined;
        
        return {
            metadata: {
                id: service.id,
                name: service.id,
                description: 'Dynamically registered component',
                type: 'TOOL' as ComponentType,
                version: '1.0.0',
                capabilities: service.capabilities.map(c => ({
                    name: c,
                    description: `Provides ${c} capability`,
                    version: '1.0.0'
                })),
                requirements: [],
                provides: service.capabilities,
                tags: []
            },
            instance: {} as Component,
            status: service.status === 'ready' ? 'ready' : 'error'
        };
    }

    protected async initializeInternal(): Promise<void> {
        if (!this._symphony) {
            throw new Error('ComponentManager must be initialized with Symphony instance');
        }

        // Initialize registry
        await this.registry.initialize();
        this.initialized = true;
    }

    public async create(
        type: 'agent' | 'tool' | 'team' | 'pipeline',
        config: AgentConfig | ToolConfig | TeamConfig | PipelineConfig
    ): Promise<Agent | Tool | Team | Pipeline> {
        if (!this.initialized) {
            throw new Error('ComponentManager not initialized');
        }

        try {
            switch (type) {
                case 'agent':
                    return await this.createAgent(config as AgentConfig);
                case 'tool':
                    return await this.createTool(config as ToolConfig);
                case 'team':
                    return await this.createTeam(config as TeamConfig);
                case 'pipeline':
                    return await this.createPipeline(config as PipelineConfig);
                default:
                    throw new Error(`Unknown component type: ${type}`);
            }
        } catch (error) {
            this.logError('Failed to create component', { type, error });
            throw error;
        }
    }

    private async createAgent(config: AgentConfig): Promise<Agent> {
        return {
            id: config.name,
            name: config.name,
            description: config.description || '',
            task: config.task || '',
            tools: config.tools || [],
            run: async (userTask: string) => {
                throw new Error(`Not implemented for task: ${userTask}`);
            }
        };
    }

    private async createTool(config: ToolConfig): Promise<Tool> {
        if (!this._symphony) {
            throw new Error('Symphony instance is required to create tools');
        }
        const tool = await this._symphony.tool.create(config);
        return {
            id: config.name,
            name: config.name,
            description: config.description || '',
            run: tool.run
        };
    }

    private async createTeam(config: TeamConfig): Promise<Team> {
        return {
            id: config.name,
            name: config.name,
            description: config.description || '',
            agents: config.agents || [],
            run: async (teamTask: string) => {
                throw new Error(`Not implemented for task: ${teamTask}`);
            }
        };
    }

    private async createPipeline(config: PipelineConfig): Promise<Pipeline> {
        return {
            id: config.name,
            name: config.name,
            description: config.description || '',
            steps: config.steps || [],
            run: async (pipelineInput: any) => {
                throw new Error(`Not implemented for input: ${JSON.stringify(pipelineInput)}`);
            }
        };
    }

    public async getRegistry(): Promise<Registry | null> {
        return this.registry;
    }
}

// Export types and utilities
export * from '../types/metadata';
export { CapabilityBuilder, CommonCapabilities }; 