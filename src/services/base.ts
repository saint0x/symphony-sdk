import { ISymphony } from '../symphony/interfaces/types';
import { Logger, LogCategory } from '../utils/logger';

export abstract class BaseService {
    protected initialized = false;
    protected symphony: ISymphony;
    protected name: string;
    protected logger: Logger;

    constructor(symphony: ISymphony, name: string) {
        this.symphony = symphony;
        this.name = name;
        this.logger = Logger.getInstance({ serviceContext: name });
    }

    protected logInfo(message: string, data?: Record<string, any>): void {
        this.logger.info(LogCategory.SYSTEM, message, data);
    }

    protected logError(message: string, error?: Error | unknown): void {
        this.logger.error(LogCategory.ERROR, message, { error });
    }

    protected assertInitialized(): void {
        if (!this.initialized) {
            throw new Error(`${this.name} is not initialized`);
        }
    }

    protected async withErrorHandling<T>(
        operation: string,
        fn: () => Promise<T>
    ): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            this.logError(`Failed to ${operation}`, error);
            throw error;
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

    protected async initializeInternal(): Promise<void> {
        // Base initialization logic - can be overridden by services
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            this.logInfo('Already initialized');
            return;
        }

        await this.initializeInternal();
        this.initialized = true;
        this.logInfo('Initialization complete');
    }
} 