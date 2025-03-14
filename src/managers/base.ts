import { LogCategory } from '../utils/logger';
import { ISymphony } from '../types/symphony';
import { Logger } from '../utils/logger';

export abstract class BaseManager {
    protected initialized: boolean = false;
    protected dependencies: BaseManager[] = [];
    protected symphony: ISymphony;
    protected name: string;
    private _logger: Logger;

    constructor(symphony: ISymphony, name: string) {
        this.symphony = symphony;
        this.name = name;
        this._logger = Logger.getInstance(name);
    }

    protected getLogger(): Logger {
        return this._logger;
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            this.logInfo('Already initialized');
            return;
        }

        // Initialize dependencies first
        if (this.dependencies.length > 0) {
            this.logInfo('Initializing dependencies...');
            for (const dep of this.dependencies) {
                if (dep && typeof dep.initialize === 'function') {
                    await dep.initialize();
                } else {
                    this.logError('Invalid dependency', { dependency: dep?.constructor?.name });
                }
            }
        }

        await this.initializeInternal();
        this.initialized = true;
        this.logInfo('Initialization complete');
    }

    protected addDependency(manager: BaseManager | null | undefined): void {
        if (manager && manager instanceof BaseManager && !this.dependencies.includes(manager)) {
            this.dependencies.push(manager);
        }
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

    protected logInfo(message: string, metadata?: Record<string, any>): void {
        this._logger.info(LogCategory.SYSTEM, message, { metadata });
    }

    protected logError(message: string, error?: Error | unknown): void {
        this._logger.error(LogCategory.ERROR, message, { error });
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
        fn: () => Promise<T>,
        metadata?: Record<string, any>
    ): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            this.logError(`Failed to ${operation}`, { error, metadata });
            throw error;
        }
    }

    protected subscribe(messageType: string): void {
        const bus = this.symphony.getServiceBus();
        if (bus) {
            bus.subscribe(messageType, {
                handle: (msg: any) => this.handleMessage(msg)
            });
            this.logInfo(`Subscribed to message type: ${messageType}`);
        }
    }

    protected async publish(message: any): Promise<void> {
        const bus = this.symphony.getServiceBus();
        if (bus) {
            await bus.publish({
                ...message,
                service: this.name,
                timestamp: Date.now()
            });
        }
    }

    protected async handleMessage(message: any): Promise<void> {
        try {
            await this.processMessage(message);
        } catch (error) {
            this.logError(`Failed to handle message: ${message.type}`, error);
            throw error;
        }
    }

    protected async processMessage(_message: any): Promise<void> {
        // Override in derived classes to handle specific message types
        throw new Error('Message handler not implemented');
    }
} 