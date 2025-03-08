import { ValidationManager } from '../../managers/validation';
import { TeamManager } from '../../managers/team';
import { Registry } from '../../symphony/registry';
import { MetricsService } from '../../services/metrics';
import { BaseManager } from '../../managers/base';
import { ToolService } from '../../services/tool';
import { AgentService } from '../../services/agent';
import { PipelineService } from '../../services/pipeline';

export class Symphony extends BaseManager {
    private static instance: Symphony;
    private _registry: Registry | null = null;
    private _initialized: boolean = false;
    
    readonly validation: ValidationManager;
    readonly team: TeamManager;
    readonly metrics: MetricsService;
    readonly tools: ToolService;
    readonly agent: AgentService;
    readonly pipeline: PipelineService;

    private constructor() {
        // Self-reference for BaseManager
        super(null as any, 'Symphony');
        
        // Initialize core services
        this.metrics = new MetricsService();
        
        // Update self-reference now that we have metrics
        (this as any).symphony = this;
        
        // Initialize managers
        this.validation = ValidationManager.getInstance(this);
        this.team = TeamManager.getInstance(this);
        this.tools = new ToolService(this);
        this.agent = new AgentService(this);
        this.pipeline = new PipelineService(this);
        
        this.logInfo('Symphony SDK initialized');
    }

    static getInstance(): Symphony {
        if (!Symphony.instance) {
            Symphony.instance = new Symphony();
        }
        return Symphony.instance;
    }

    async initialize(): Promise<void> {
        return this.withErrorHandling('initialize', async () => {
            if (this._initialized) {
                this.logInfo('Symphony already initialized');
                return;
            }

            try {
                // Initialize validation manager first
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