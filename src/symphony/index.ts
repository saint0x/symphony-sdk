import { ToolService } from '../services/tool';
import { AgentService } from '../services/agent';
import { TeamManager } from '../managers/team';
import { PipelineService } from '../services/pipeline';
import { ComponentManager } from '../managers/component';
import { MetricsService } from '../services/metrics';
import { ValidationManager } from '../managers/validation';
import { Registry } from './registry';
import { ServiceBus } from '../core/servicebus';
import { Logger, LogCategory } from '../utils/logger';
import { LogLevel } from '../types/sdk';
import { ISymphony, SymphonyConfig, SymphonyUtils } from './interfaces/types';
import { BaseManager } from '../managers/base';

export class Symphony extends BaseManager implements ISymphony {
    private static instance: Symphony;
    protected _registry: Registry | null = null;
    private _initialized: boolean = false;
    private initPromise?: Promise<void>;
    private _metrics: MetricsService;
    private _logger: Logger;
    private _bus: ServiceBus;
    private _toolService: ToolService;
    private _agentService: AgentService;
    private _teamManager: TeamManager;
    private _pipelineService: PipelineService;
    private _config: SymphonyConfig = {
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

    readonly tools: ISymphony['tools'];
    readonly agent: ISymphony['agent'];
    readonly team: ISymphony['team'];
    readonly pipeline: ISymphony['pipeline'];
    readonly components: ComponentManager;
    readonly validation: ValidationManager;

    get metrics() {
        return {
            startTime: this._metrics.startTime,
            start: (id: string, metadata?: Record<string, any>) => this._metrics.start(id, metadata),
            end: (id: string, metadata?: Record<string, any>) => this._metrics.end(id, metadata),
            get: (id: string) => this._metrics.get(id),
            update: (id: string, metadata: Record<string, any>) => this._metrics.update(id, metadata),
            getAll: () => this._metrics.getAll()
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

    get logger() {
        return {
            debug: (category: string, message: string, data?: any) => this._logger.debug(category as LogCategory, message, data),
            info: (category: string, message: string, data?: any) => this._logger.info(category as LogCategory, message, data),
            warn: (category: string, message: string, data?: any) => this._logger.warn(category as LogCategory, message, data),
            error: (category: string, message: string, data?: any) => this._logger.error(category as LogCategory, message, data)
        };
    }

    private constructor() {
        super(null as any, 'Symphony');
        
        // Initialize core services
        this._logger = Logger.getInstance({ serviceContext: 'Symphony' });
        this._metrics = new MetricsService();
        this._bus = new ServiceBus();
        
        // Create service instances
        this._toolService = new ToolService(this);
        this._agentService = new AgentService(this);
        this._teamManager = TeamManager.getInstance(this);
        this._pipelineService = new PipelineService(this);
        
        // Initialize managers and services
        this.validation = ValidationManager.getInstance(this);
        this.components = ComponentManager.getInstance();

        // Initialize registry
        this._registry = new Registry(this);

        // Register core services with registry
        this._registry.registerService({
            id: 'tool',
            capabilities: ['tool.create', 'tool.execute', 'tool.manage'],
            status: 'pending'
        });
        this._registry.registerService({
            id: 'agent',
            capabilities: ['agent.execute', 'agent.manage'],
            status: 'pending'
        });
        this._registry.registerService({
            id: 'team',
            capabilities: ['team.create', 'team.manage'],
            status: 'pending'
        });
        this._registry.registerService({
            id: 'pipeline',
            capabilities: ['pipeline.execute', 'pipeline.manage'],
            status: 'pending'
        });

        // Add dependencies
        this.addDependency(this.validation);
        this.addDependency(this.components);
        this.addDependency(this._toolService);
        this.addDependency(this._agentService);
        this.addDependency(this._teamManager);
        this.addDependency(this._pipelineService);

        // Expose services through interfaces
        this.tools = this._toolService;
        this.agent = this._agentService;
        this.team = this._teamManager;
        this.pipeline = this._pipelineService;
        
        this._logger.info(LogCategory.SYSTEM, 'Symphony SDK initialized');
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
            this._logger.setMinLevel(this.mapLogLevel(config.logging.level));
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
                    this._logger.setMinLevel(options.logLevel);
                }

                // Initialize registry first
                await this._registry?.initialize();

                // Initialize component manager
                await this.components.initialize();

                // Initialize validation manager
                await this.validation.initialize();

                // Initialize core services in order of dependency
                await this._toolService.initialize();
                this._registry?.updateServiceStatus('tool', 'ready');

                await this._agentService.initialize();
                this._registry?.updateServiceStatus('agent', 'ready');

                await this._teamManager.initialize();
                this._registry?.updateServiceStatus('team', 'ready');

                await this._pipelineService.initialize();
                this._registry?.updateServiceStatus('pipeline', 'ready');

                this._initialized = true;
                this._logger.info(LogCategory.SYSTEM, 'Symphony initialization complete');
            } catch (error) {
                this._initialized = false;
                this.initPromise = undefined;
                this._logger.error(LogCategory.ERROR, 'Symphony initialization failed', { error });
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
export * from './core/symphony';
export type { SymphonyConfig, ISymphony } from './interfaces/types';
export type * from '../types/metadata';
export type * from '../types/components';
export * from '../types/capabilities';
export { ComponentManager, CapabilityBuilder, CommonCapabilities } from '../managers/component';
export { TeamService } from './services/team'; 