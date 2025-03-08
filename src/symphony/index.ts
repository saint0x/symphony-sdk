import { ToolService } from '../services/tool';
import { AgentService } from '../services/agent';
import { TeamManager } from '../managers/team';
import { PipelineService } from '../services/pipeline';
import { ComponentManager } from '../managers/component';
import { MetricsService } from '../services/metrics';
import { ValidationManager } from '../managers/validation';
import { Registry } from './registry';
import { ServiceBus } from '../core/servicebus';
import { LogCategory } from '../utils/logger';
import { LogLevel } from '../types/sdk';
import { ISymphony, SymphonyConfig, SymphonyUtils } from './interfaces/types';
import { IToolService, IAgentService, ITeamService, IPipelineService } from '../services/interfaces';
import { IValidationManager } from '../managers/validation';
import { BaseManager } from '../managers/base';

export class Symphony extends BaseManager implements ISymphony {
    private static instance: Symphony;
    protected _registry: Registry | null = null;
    protected _initialized: boolean = false;
    protected _toolService: ToolService;
    protected _agentService: AgentService;
    protected _teamService: TeamManager;
    protected _pipelineService: PipelineService;
    protected _validationManager: ValidationManager;
    protected _metrics: MetricsService;
    protected _components: ComponentManager;
    protected _bus: ServiceBus;
    protected _config: SymphonyConfig = {
        serviceRegistry: {
            enabled: false,
            maxRetries: 3,
            retryDelay: 1000
        },
        logging: {
            level: 'info' as const,
            format: 'json' as const
        },
        metrics: {
            enabled: true,
            detailed: false
        }
    };
    private initPromise?: Promise<void>;

    readonly validation!: IValidationManager;
    readonly team!: ITeamService;
    readonly metrics!: {
        startTime: number;
        start(id: string, metadata?: Record<string, any>): void;
        end(id: string, metadata?: Record<string, any>): void;
        get(id: string): Record<string, any> | undefined;
        update(id: string, metadata: Record<string, any>): void;
        getAll(): Record<string, any>;
    };
    readonly tools!: IToolService;
    readonly agent!: IAgentService;
    readonly pipeline!: IPipelineService;
    readonly components!: ComponentManager;
    readonly componentManager!: ComponentManager;
    readonly types = {
        CapabilityBuilder: {
            team: (capability: string) => `team.${capability}`,
            agent: (capability: string) => `agent.${capability}`,
            numeric: (capability: string) => `numeric.${capability}`,
            processing: (capability: string) => `processing.${capability}`
        },
        CommonCapabilities: {
            TOOL_USE: 'tool.use',
            COORDINATION: 'coordination',
            PARALLEL: 'parallel',
            ADD: 'add'
        },
        DEFAULT_LLM_CONFIG: {
            provider: 'openai',
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 2000
        }
    };

    get logger() {
        const logger = this.getLogger();
        return {
            debug: (category: string, message: string, data?: any) => logger.debug(category as LogCategory, message, data),
            info: (category: string, message: string, data?: any) => logger.info(category as LogCategory, message, data),
            warn: (category: string, message: string, data?: any) => logger.warn(category as LogCategory, message, data),
            error: (category: string, message: string, data?: any) => logger.error(category as LogCategory, message, data)
        };
    }

    get utils(): SymphonyUtils {
        return {
            validation: {
                validate: async (data: any, schema: string) => {
                    return this.validation.validate(data, schema);
                }
            },
            metrics: {
                start: (id: string, metadata?: Record<string, any>) => this._metrics.start(id, metadata),
                end: (id: string, metadata?: Record<string, any>) => this._metrics.end(id, metadata),
                get: (id: string) => this._metrics.get(id)
            }
        };
    }

    private constructor() {
        super(null as any, 'Symphony');
        
        // Initialize core services
        this._metrics = new MetricsService();
        this._components = ComponentManager.getInstance(this);
        this._registry = new Registry(this);
        
        // Initialize metrics property
        this.metrics = {
            startTime: this._metrics.startTime,
            start: (id: string, metadata?: Record<string, any>) => this._metrics.start(id, metadata),
            end: (id: string, metadata?: Record<string, any>) => this._metrics.end(id, metadata),
            get: (id: string) => this._metrics.get(id),
            update: (id: string, metadata: Record<string, any>) => this._metrics.update(id, metadata),
            getAll: () => this._metrics.getAll()
        };
        
        // Update self-reference now that we have metrics
        (this as any).symphony = this;
        
        // Create service instances
        this._toolService = new ToolService(this);
        this._agentService = new AgentService(this);
        this._teamService = TeamManager.getInstance(this);
        this._pipelineService = new PipelineService(this);
        this._validationManager = ValidationManager.getInstance(this);
        this._bus = new ServiceBus();

        // Add dependencies
        this.addDependency(this._components);
        this.addDependency(this._validationManager);
        this.addDependency(this._toolService);
        this.addDependency(this._agentService);
        this.addDependency(this._teamService);
        this.addDependency(this._pipelineService);

        // Expose services through interfaces
        this.tools = this._toolService;
        this.agent = this._agentService;
        this.team = this._teamService;
        this.pipeline = this._pipelineService;
        this.validation = this._validationManager;
        this.components = this._components;
        this.componentManager = this._components;
        
        this.logInfo('Symphony SDK initialized');
    }

    static getInstance(): Symphony {
        if (!Symphony.instance) {
            Symphony.instance = new Symphony();
        }
        return Symphony.instance;
    }

    getConfig(): SymphonyConfig {
        return { ...this._config };
    }

    updateConfig(config: Partial<SymphonyConfig>): void {
        this._config = {
            ...this._config,
            ...config
        };

        if (config.logging?.level) {
            this.getLogger().setMinLevel(this.mapLogLevel(config.logging.level));
        }
    }

    private mapLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): LogLevel {
        switch (level) {
            case 'debug': return LogLevel.DEBUG;
            case 'info': return LogLevel.NORMAL;
            case 'warn': return LogLevel.VERBOSE;
            case 'error': return LogLevel.ERROR;
            default: return LogLevel.NORMAL;
        }
    }

    async initialize(options: { logLevel?: LogLevel } = {}): Promise<void> {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                if (options.logLevel) {
                    this.getLogger().setMinLevel(options.logLevel);
                }

                // Initialize core managers first
                await this._components.initialize();
                await this._validationManager.initialize();

                // Initialize registry after core managers
                if (this._registry) {
                    await this._registry.initialize();
                }

                // Initialize services that depend on core managers
                await this._toolService.initialize();
                this._registry?.updateServiceStatus('tool', 'ready');

                await this._agentService.initialize();
                this._registry?.updateServiceStatus('agent', 'ready');

                await this._teamService.initialize();
                this._registry?.updateServiceStatus('team', 'ready');

                await this._pipelineService.initialize();
                this._registry?.updateServiceStatus('pipeline', 'ready');

                this._initialized = true;
                this.logInfo('Symphony initialization complete');
            } catch (error) {
                this._initialized = false;
                this.initPromise = undefined;
                this.logError('Symphony initialization failed', { error });
                throw error;
            }
        })();

        return this.initPromise;
    }

    async getRegistry(): Promise<Registry | null> {
        if (!this._initialized) {
            throw new Error('Symphony must be initialized before accessing registry');
        }
        return this._registry;
    }

    getServiceBus(): ServiceBus {
        return this._bus;
    }

    isInitialized(): boolean {
        return this._initialized;
    }

    startMetric(id: string, metadata?: Record<string, any>): void {
        if (!this._initialized) {
            throw new Error('Symphony must be initialized before using metrics');
        }
        this._metrics.start(id, metadata);
    }

    endMetric(id: string, metadata?: Record<string, any>): void {
        if (!this._initialized) {
            throw new Error('Symphony must be initialized before using metrics');
        }
        this._metrics.end(id, metadata);
    }

    getMetric(id: string): Record<string, any> | undefined {
        if (!this._initialized) {
            throw new Error('Symphony must be initialized before using metrics');
        }
        return this._metrics.get(id);
    }

    protected async initializeInternal(): Promise<void> {
        // Already handled in initialize()
    }
}

export const symphony = Symphony.getInstance();

// Export types and utilities
export type { SymphonyConfig, ISymphony } from './interfaces/types';
export type * from '../types/metadata';
export type * from '../types/components';
export * from '../types/capabilities';
export { ComponentManager, CapabilityBuilder, CommonCapabilities } from '../managers/component';
export { TeamService } from './services/team'; 