import { ISymphony } from '../interfaces/types';

export abstract class BaseService {
    protected initialized = false;
    protected symphony: ISymphony;
    protected name: string;

    constructor(symphony: ISymphony, name: string) {
        this.symphony = symphony;
        this.name = name;
    }

    protected logInfo(message: string, data?: Record<string, any>): void {
        this.symphony.logger.info(this.name, message, data);
    }

    protected logError(message: string, error?: Error | unknown): void {
        this.symphony.logger.error(this.name, message, { error });
    }

    protected assertInitialized(): void {
        if (!this.initialized) {
            throw new Error(`${this.name} is not initialized`);
        }
    }

    protected async withErrorHandling<T>(
        operation: string,
        fn: () => Promise<T>,
        context?: Record<string, any>
    ): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            this.logError(`Failed to ${operation}`, error);
            throw error;
        }
    }

    protected async initializeInternal(): Promise<void> {
        // Base initialization logic - can be overridden by services
    }

    abstract initialize(): Promise<void>;
} 