import { BaseService } from './base';
import { ISymphony } from '../types/symphony';
import { ToolLifecycleState } from '../types/lifecycle';
import { IMetricsService } from '../types/interfaces';

export class MetricsService extends BaseService implements IMetricsService {
    private metrics: Map<string, any> = new Map();
    private readonly _startTime: number;
    protected _state: ToolLifecycleState = ToolLifecycleState.PENDING;
    protected _dependencies: string[] = [];
    protected initialized = false;

    constructor() {
        super({} as ISymphony, 'MetricsService');
        this._startTime = Date.now();
        this._state = ToolLifecycleState.READY;
        this.initialized = true;
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return this._dependencies;
    }

    get startTime(): number {
        return this._startTime;
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            this.logInfo('Already initialized');
            return;
        }

        await this.initializeInternal();
        this._state = ToolLifecycleState.READY;
        this.initialized = true;
        this.logInfo('Initialization complete');
    }

    start(id: string, metadata?: Record<string, any>): void {
        this.metrics.set(id, {
            startTime: Date.now(),
            metadata
        });
        this.logDebug(`Started metric: ${id}`, { metadata });
    }

    end(id: string, metadata?: Record<string, any>): void {
        const metric = this.metrics.get(id);
        if (!metric) {
            this.logError(`Metric ${id} not found`, new Error(`Metric ${id} not found`));
            return;
        }

        metric.endTime = Date.now();
        metric.duration = metric.endTime - metric.startTime;
        if (metadata) {
            metric.metadata = { ...metric.metadata, ...metadata };
        }
        this.logDebug(`Ended metric: ${id}`, { duration: metric.duration, metadata: metric.metadata });
    }

    get(id: string): any {
        return this.metrics.get(id);
    }

    update(id: string, metadata: Record<string, any>): void {
        const metric = this.metrics.get(id);
        if (!metric) {
            this.logError(`Metric ${id} not found`, new Error(`Metric ${id} not found`));
            return;
        }

        metric.metadata = { ...metric.metadata, ...metadata };
        this.logDebug(`Updated metric: ${id}`, { metadata: metric.metadata });
    }

    getAll(): Map<string, any> {
        return this.metrics;
    }

    protected async initializeInternal(): Promise<void> {
        // Nothing to initialize
    }
}