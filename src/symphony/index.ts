import { ToolService } from '../services/tool';
import { AgentService } from '../services/agent';
import { TeamManager } from '../managers/team';
import { PipelineService } from '../services/pipeline';
import { ComponentManager } from '../managers/component';
import { MetricsService } from '../services/metrics';
import { ValidationManager } from '../managers/validation';
import { BaseManager } from '../managers/base';
import { Registry } from './registry';
import { Logger } from '../utils/logger';
import { LogLevel } from '../types/sdk';
import { Symphony as CoreSymphony } from './core/symphony';

export class Symphony extends CoreSymphony {
    private static instance: Symphony;
    private _registry: Registry | null = null;
    private _initialized: boolean = false;
    private initPromise?: Promise<void>;

    readonly tools: ToolService;
    readonly agent: AgentService;
    readonly team: TeamManager;
    readonly pipeline: PipelineService;
    readonly components: ComponentManager;
    readonly metrics: MetricsService;
    readonly validation: ValidationManager;

    private constructor() {
        super();
        
        // Initialize core services
        this.metrics = new MetricsService(this);
        
        // Update self-reference now that we have metrics
        (this as any).symphony = this;
        
        // Initialize managers and services
        this.validation = ValidationManager.getInstance(this);
        this.team = TeamManager.getInstance(this);
        this.tools = new ToolService(this);
        this.agent = new AgentService(this);
        this.pipeline = new PipelineService(this);
        this.components = ComponentManager.getInstance();
        
        this.logInfo('Symphony SDK initialized');
    }

    static getInstance(): Symphony {
        if (!Symphony.instance) {
            Symphony.instance = new Symphony();
        }
        return Symphony.instance as Symphony;
    }

    async initialize(options: { logLevel?: string } = {}): Promise<void> {
        return this.withErrorHandling('initialize', async () => {
            if (this.initPromise) return this.initPromise;

            this.initPromise = (async () => {
                try {
                    if (options.logLevel) {
                        Logger.setGlobalLevel(options.logLevel);
                    }

                    // Initialize component manager first as it manages all other components
                    await this.components.initialize();

                    // Initialize validation manager
                    await this.validation.initialize();

                    // Initialize metrics service
                    await this.metrics.initialize();

                    this._initialized = true;
                    this.logInfo('Symphony initialization complete');
                } catch (error) {
                    this._initialized = false;
                    this.initPromise = undefined;
                    this.logError('Symphony initialization failed', error);
                    throw error;
                }
            })();

            return this.initPromise;
        });
    }

    async getRegistry(): Promise<Registry | null> {
        return this._registry;
    }

    isInitialized(): boolean {
        return this._initialized;
    }

    startMetric(metricId: string, metadata?: Record<string, any>): void {
        this.assertInitialized();
        this.metrics.start(metricId, metadata);
    }

    endMetric(metricId: string, metadata?: Record<string, any>): void {
        this.assertInitialized();
        this.metrics.end(metricId, metadata);
    }

    getMetric(metricId: string): Record<string, any> | undefined {
        this.assertInitialized();
        return this.metrics.get(metricId);
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