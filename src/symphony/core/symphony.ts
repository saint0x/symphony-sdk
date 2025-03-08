import { ValidationManager } from '../../managers/validation';
import { TeamManager } from '../../managers/team';
import { Registry } from '../../symphony/registry';
import { MetricsService } from '../../services/metrics';
import { BaseManager } from '../../managers/base';
import { ToolService } from '../../services/tool';
import { AgentService } from '../../services/agent';
import { PipelineService } from '../../services/pipeline';
import { ComponentManager } from '../../managers/component';
import { LogCategory } from '../../utils/logger';
import { LogLevel } from '../../types/sdk';
import { ISymphony, SymphonyConfig, SymphonyUtils } from '../interfaces/types';
import { IToolService, IAgentService, ITeamService, IPipelineService } from '../../services/interfaces';
import { IValidationManager } from '../../managers/validation';
import { ServiceBus } from '../../core/servicebus';

export class Symphony extends BaseManager implements ISymphony {
    private static instance: Symphony;
    protected _registry: Registry | null = null;
    protected _initialized: boolean = false;
    protected _toolService: IToolService;
    protected _agentService: IAgentService;
    protected _teamService: ITeamService;
    protected _pipelineService: IPipelineService;
    protected _validationManager: IValidationManager;
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
            level: 'info',
            format: 'json'
        },
        metrics: {
            enabled: true,
            detailed: false
        }
    };

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

    get logger() {
        const logger = this.getLogger();
        return {
            debug: (category: string, message: string, data?: any) => logger.debug(category as LogCategory, message, data),
            info: (category: string, message: string, data?: any) => logger.info(category as LogCategory, message, data),
            warn: (category: string, message: string, data?: any) => logger.warn(category as LogCategory, message, data),
            error: (category: string, message: string, data?: any) => logger.error(category as LogCategory, message, data)
        };
    }

    private constructor() {
        super(null as any, 'Symphony');
        
        // Initialize core services
        this._metrics = new MetricsService();
        this._components = ComponentManager.getInstance();
        
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

        // Update log level if specified
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

    protected async initializeInternal(): Promise<void> {
        try {
            // Initialize component manager first
            await this._components.initialize();

            // Initialize validation manager
            await this._validationManager.initialize();

            // Initialize core services in order of dependency
            await this._toolService.initialize();
            await this._agentService.initialize();
            await this._teamService.initialize();
            await this._pipelineService.initialize();

            this._initialized = true;
            this.logInfo('Symphony initialization complete');
        } catch (error) {
            this._initialized = false;
            this.logError('Symphony initialization failed', { error });
            throw error;
        }
    }

    async getRegistry(): Promise<Registry | null> {
        if (!this._initialized) {
            this.logError('Symphony not initialized');
            throw new Error('Symphony must be initialized before accessing registry');
        }
        return this._registry;
    }

    isInitialized(): boolean {
        return this._initialized;
    }

    // Expose metrics methods directly for convenience
    startMetric(id: string, metadata?: Record<string, any>): void {
        this.assertInitialized();
        this._metrics.start(id, metadata);
    }

    endMetric(id: string, metadata?: Record<string, any>): void {
        this.assertInitialized();
        this._metrics.end(id, metadata);
    }

    getMetric(id: string): Record<string, any> | undefined {
        this.assertInitialized();
        return this._metrics.get(id);
    }

    getServiceBus(): ServiceBus {
        return this._bus;
    }
}

// Export singleton instance
export const symphony = Symphony.getInstance(); 