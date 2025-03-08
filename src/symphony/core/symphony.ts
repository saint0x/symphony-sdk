import { ValidationManager } from '../../managers/validation';
import { TeamManager } from '../../managers/team';
import { Registry } from '../../symphony/registry';
import { MetricsService } from '../../services/metrics';
import { BaseManager } from '../../managers/base';
import { ToolService } from '../../services/tool';
import { AgentService } from '../../services/agent';
import { PipelineService } from '../../services/pipeline';
import { ComponentManager } from '../../managers/component';
import { Logger, LogCategory } from '../../utils/logger';
import { LogLevel } from '../../types/sdk';
import { ISymphony, SymphonyConfig, SymphonyUtils, GlobalMetrics } from '../interfaces/types';

export class Symphony extends BaseManager implements ISymphony {
    private static instance: Symphony;
    private _registry: Registry | null = null;
    private _initialized: boolean = false;
    private _logger: Logger;
    private _config: SymphonyConfig = {
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
    
    readonly validation: ValidationManager;
    readonly team: ISymphony['team'];
    readonly metrics: GlobalMetrics;
    readonly tools: ISymphony['tools'];
    readonly agent: ISymphony['agent'];
    readonly pipeline: ISymphony['pipeline'];
    readonly components: ComponentManager;

    get utils(): SymphonyUtils {
        return {
            validation: {
                validate: async (data: any, schema: string) => {
                    return this.validation.validate(data, schema);
                }
            },
            metrics: {
                start: (id: string, metadata?: Record<string, any>) => this.metrics.start(id, metadata),
                end: (id: string, metadata?: Record<string, any>) => this.metrics.end(id, metadata),
                get: (id: string) => this.metrics.get(id)
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
        // Self-reference for BaseManager
        super(null as any, 'Symphony');
        
        // Initialize logger first
        this._logger = Logger.getInstance({ serviceContext: 'Symphony' });
        
        // Initialize core services
        const metricsService = new MetricsService();
        this.metrics = {
            startTime: metricsService.startTime,
            start: (id, metadata) => metricsService.start(id, metadata),
            end: (id, metadata) => metricsService.end(id, metadata),
            get: (id) => metricsService.get(id),
            update: (id, metadata) => metricsService.update(id, metadata),
            getAll: () => metricsService.getAll()
        };
        
        // Update self-reference now that we have metrics
        (this as any).symphony = this;
        
        // Initialize managers
        this.validation = ValidationManager.getInstance(this);
        this.team = {
            create: async (config) => TeamManager.getInstance(this).createTeam(config),
            initialize: async () => TeamManager.getInstance(this).initialize()
        };
        this.tools = {
            create: async (config) => new ToolService(this).create(config),
            initialize: async () => new ToolService(this).initialize()
        };
        this.agent = {
            create: async (config) => new AgentService(this).create(config),
            initialize: async () => new AgentService(this).initialize()
        };
        this.pipeline = {
            create: async (config) => new PipelineService(this).create(config),
            initialize: async () => new PipelineService(this).initialize()
        };
        this.components = ComponentManager.getInstance();
        
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
            Logger.getInstance().setMinLevel(this.mapLogLevel(config.logging.level));
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
        return this.withErrorHandling('initialize', async () => {
            if (this._initialized) {
                this.logInfo('Symphony already initialized');
                return;
            }

            try {
                if (options.logLevel) {
                    Logger.getInstance().setMinLevel(options.logLevel);
                }

                // Initialize component manager first as it manages all other components
                await this.components.initialize();

                // Initialize validation manager
                await this.validation.initialize();

                // Initialize registry
                this._registry = new Registry(this);
                await this._registry.initialize();

                // Initialize remaining managers and services
                await Promise.all([
                    this.team.initialize(),
                    this.tools.initialize(),
                    this.agent.initialize(),
                    this.pipeline.initialize()
                ]);

                this._initialized = true;
                this.logInfo('Symphony initialization complete');
            } catch (error) {
                this.logError('Symphony initialization failed', error);
                throw error;
            }
        });
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
    startMetric(metricId: string, metadata?: Record<string, any>): void {
        this.metrics.start(metricId, metadata);
    }

    endMetric(metricId: string, metadata?: Record<string, any>): void {
        this.metrics.end(metricId, metadata);
    }

    getMetric(metricId: string): Record<string, any> | undefined {
        return this.metrics.get(metricId);
    }
}

// Export singleton instance
export const symphony = Symphony.getInstance(); 