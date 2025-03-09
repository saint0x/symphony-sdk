import { ISymphony, SymphonyConfig, IMetricsAPI } from '../types/symphony';
import { IToolService, IAgentService, ITeamService, IPipelineService } from '../services/interfaces';
import { ValidationManager, IValidationManager } from '../managers/validation';
import { ServiceRegistry } from '../proto/symphonic/core/types';
import { LLMHandler } from '../llm/handler';
import { ContextManager } from '../proto/symphonic/core/cache/context';
import { ServiceBus } from '../services/bus';
import { ComponentManager } from './components/component-manager';
import { MetricsService } from '../services/metrics';
import { Logger } from '../utils/logger';
import { ToolLifecycleState } from '../types/lifecycle';
import { CapabilityBuilder, CommonCapabilities as TypedCommonCapabilities } from '../types/capabilities';
import { LogLevel } from '../types/sdk';
import { ToolService } from './services/tool';
import { AgentService } from './services/agent';
import { TeamService } from './services/team';
import { PipelineService } from './services/pipeline';

// Flatten CommonCapabilities to match ISymphony interface
const CommonCapabilities = {
    TOOL_USE: TypedCommonCapabilities.AGENT.TOOL_USE,
    COORDINATION: TypedCommonCapabilities.TEAM.COORDINATION,
    PARALLEL: TypedCommonCapabilities.PROCESSING.PARALLEL,
    ADD: TypedCommonCapabilities.NUMERIC.ADD
} as {
    readonly TOOL_USE: string;
    readonly COORDINATION: string;
    readonly PARALLEL: string;
    readonly ADD: string;
};

export class Symphony implements ISymphony {
    private _services: Map<string, any> = new Map();
    private _validationManager!: ValidationManager;
    private _components: ComponentManager;
    private _componentManager: ComponentManager;
    private _logger: Logger;
    private _contextManager!: ContextManager;
    private _serviceRegistry!: ServiceRegistry;
    private _state: ToolLifecycleState = ToolLifecycleState.PENDING;
    private _config: SymphonyConfig;

    readonly name: string = 'Symphony';
    readonly initialized: boolean = false;
    readonly isInitialized: boolean = false;
    readonly llm!: LLMHandler;
    readonly bus!: ServiceBus;
    readonly tool!: IToolService;
    readonly agent!: IAgentService;
    readonly team!: ITeamService;
    readonly pipeline!: IPipelineService;
    readonly validation!: IValidationManager;
    readonly validationManager!: IValidationManager;
    readonly metrics!: IMetricsAPI;
    readonly types = {
        CapabilityBuilder,
        CommonCapabilities
    };

    constructor(config: SymphonyConfig) {
        // Use envConfig singleton which already handles environment loading
        this._config = config;
        this._logger = Logger.getInstance('Symphony');
        this._components = ComponentManager.getInstance(this);
        this._componentManager = this._components;

        // Initialize core services
        this.llm = LLMHandler.getInstance();
        this.bus = new ServiceBus();

        // Initialize validation manager first as other services depend on it
        this._validationManager = ValidationManager.getInstance(this);
        this.validation = this._validationManager;
        this.validationManager = this._validationManager;

        // Initialize metrics service
        const metricsService = new MetricsService();
        Object.defineProperty(this, 'metrics', {
            value: {
                startTime: metricsService.startTime,
                start: (id: string, metadata?: Record<string, any>) => metricsService.start(id, metadata),
                end: (id: string, metadata?: Record<string, any>) => metricsService.end(id, metadata),
                get: (id: string) => metricsService.get(id),
                update: (id: string, metadata: Record<string, any>) => metricsService.update(id, metadata),
                getAll: () => metricsService.getAll()
            },
            writable: false
        });

        // Initialize tool service
        const toolService = new ToolService(this);
        Object.defineProperty(this, 'tool', { value: toolService, writable: false });

        // Initialize agent service
        const agentService = new AgentService(this);
        Object.defineProperty(this, 'agent', { value: agentService, writable: false });

        // Initialize team service
        const teamService = new TeamService(this);
        Object.defineProperty(this, 'team', { value: teamService, writable: false });

        // Initialize pipeline service
        const pipelineService = new PipelineService(this);
        Object.defineProperty(this, 'pipeline', { value: pipelineService, writable: false });

        // Register services
        this._services.set('llm', this.llm);
        this._services.set('bus', this.bus);
        this._services.set('tool', toolService);
        this._services.set('agent', agentService);
        this._services.set('team', teamService);
        this._services.set('pipeline', pipelineService);
        this._services.set('validation', this.validationManager);
        this._services.set('metrics', metricsService);
        this._services.set('component', this._componentManager);

        // Initialize async services
        Promise.all([
            ContextManager.getInstance(),
            ServiceRegistry.getInstance(),
            metricsService.initialize()
        ]).then(([contextManager, registry]) => {
            this._contextManager = contextManager;
            this._serviceRegistry = registry;
        }).catch(error => {
            this._logger.error('Symphony', 'Failed to initialize async services', { error });
        });
    }

    get logger(): Logger {
        return this._logger;
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    get contextManager(): ContextManager {
        return this._contextManager;
    }

    get serviceRegistry(): ServiceRegistry {
        return this._serviceRegistry;
    }

    get components(): ComponentManager {
        return this._components;
    }

    get componentManager(): ComponentManager {
        return this._componentManager;
    }

    getDependencies(): string[] {
        return [];
    }

    getConfig(): SymphonyConfig {
        return this._config;
    }

    updateConfig(config: Partial<SymphonyConfig>): void {
        this._config = { ...this._config, ...config };
    }

    async getRegistry(): Promise<ServiceRegistry> {
        return this.serviceRegistry;
    }

    getServiceBus(): ServiceBus {
        return this.bus;
    }

    startMetric(id: string, metadata?: Record<string, any>): void {
        new MetricsService().start(id, metadata);
    }

    endMetric(id: string, metadata?: Record<string, any>): void {
        new MetricsService().end(id, metadata);
    }

    getMetric(id: string): any {
        return new MetricsService().get(id);
    }

    async initialize(): Promise<void> {
        if (this.state === ToolLifecycleState.READY) {
            return;
        }

        this._state = ToolLifecycleState.INITIALIZING;
        this._logger.info('Symphony', 'Initializing...');

        try {
            // Wait for async services to be ready
            await Promise.all([
                ContextManager.getInstance(),
                ServiceRegistry.getInstance()
            ]);

            // Initialize all services
            await Promise.all([
                this.tool.initialize(),
                this.agent.initialize(),
                this.team.initialize(),
                this.pipeline.initialize(),
                this.validationManager.initialize(),
                this.componentManager.initialize()
            ]);

            this._state = ToolLifecycleState.READY;
            Object.defineProperty(this, 'initialized', { value: true, writable: false });
            this._logger.info('Symphony', 'Initialization complete');
        } catch (error) {
            this._state = ToolLifecycleState.ERROR;
            this._logger.error('Symphony', 'Initialization failed', { error });
            throw error;
        }
    }

    async getService(name: string): Promise<any> {
        return this._services.get(name);
    }

    getState(): ToolLifecycleState {
        return this._state;
    }
}

// Export default instance
export const symphony = new Symphony({
    serviceRegistry: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000
    },
    logging: {
        level: LogLevel.INFO,
        format: 'json'
    },
    metrics: { enabled: true, detailed: true }
});

// Export types and utilities
export { ToolLifecycleState } from '../types/lifecycle';
export type { ISymphony } from '../types/symphony';
export type * from '../types/metadata';
export type * from '../types/components';
export * from '../types/capabilities';
export * from '../types/interfaces';
export { ComponentManager } from './components/component-manager';
export { TeamService } from './services/team'; 