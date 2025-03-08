import { logger, LogCategory } from '../utils/logger';
import { ISymphony } from '../symphony/interfaces/types';

export abstract class BaseManager {
    protected initialized: boolean = false;

    protected constructor(
        protected symphony: ISymphony,
        protected name: string
    ) {}

    async initialize(): Promise<void> {
        if (this.initialized) {
            this.logInfo('Already initialized');
            return;
        }

        await this.initializeInternal();
        this.initialized = true;
        this.logInfo('Initialization complete');
    }

    protected async initializeInternal(): Promise<void> {
        // Override in derived classes if needed
    }

    protected isInitialized(): boolean {
        return this.initialized;
    }

    protected assertInitialized(): void {
        if (!this.initialized) {
            throw new Error(`${this.name} is not initialized`);
        }
    }

    protected logInfo(message: string, metadata?: Record<string, any>) {
        logger.info(LogCategory.SYSTEM, `[${this.name}] ${message}`, { metadata });
    }

    protected logError(message: string, error?: any) {
        logger.error(LogCategory.SYSTEM, `[${this.name}] ${message}`, {
            metadata: {
                error: error instanceof Error ? error.message : error
            }
        });
    }

    protected startMetrics(operation: string, metadata?: Record<string, any>) {
        const metricId = `${this.name}_${operation}`;
        this.symphony.metrics.start(metricId, metadata);
        return metricId;
    }

    protected endMetrics(metricId: string, metadata?: Record<string, any>) {
        this.symphony.metrics.end(metricId, metadata);
    }

    protected async withErrorHandling<T>(
        operation: string,
        action: () => Promise<T>,
        metadata?: Record<string, any>
    ): Promise<T> {
        const metricId = this.startMetrics(operation, metadata);
        
        try {
            const result = await action();
            this.endMetrics(metricId, { success: true, ...metadata });
            return result;
        } catch (error) {
            this.endMetrics(metricId, { 
                success: false, 
                error: error instanceof Error ? error.message : String(error),
                ...metadata 
            });
            throw error;
        }
    }
} 