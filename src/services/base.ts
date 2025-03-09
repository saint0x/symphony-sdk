import { ISymphony } from '../types/symphony';
import { ToolLifecycleState } from '../types/lifecycle';
import { Logger } from '../utils/logger';

export abstract class BaseService {
    protected _state: ToolLifecycleState = ToolLifecycleState.PENDING;
    protected _dependencies: string[] = [];
    protected readonly logger: Logger;
    protected readonly symphony: ISymphony;
    protected readonly name: string;

    constructor(symphony: ISymphony, name: string) {
        this.symphony = symphony;
        this.name = name;
        this.logger = Logger.getInstance(name);
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return this._dependencies;
    }

    protected logDebug(message: string, data?: Record<string, any>): void {
        this.logger.debug(this.name, message, data);
    }

    protected logInfo(message: string, data?: Record<string, any>): void {
        this.logger.info(this.name, message, data);
    }

    protected logWarning(message: string, data?: Record<string, any>): void {
        this.logger.warn(this.name, message, data);
    }

    protected logError(message: string, error?: Error, data?: Record<string, any>): void {
        this.logger.error(this.name, message, { ...data, error });
    }

    protected assertInitialized(): void {
        if (this._state !== ToolLifecycleState.READY) {
            throw new Error(`${this.name} is not initialized`);
        }
    }

    protected async withErrorHandling<T>(operation: string, fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            this.logError(`Error in ${operation}`, error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    async initialize(): Promise<void> {
        if (this._state === ToolLifecycleState.READY) {
            return;
        }

        this._state = ToolLifecycleState.INITIALIZING;
        this.logInfo('Initializing...');

        try {
            await this.initializeInternal();
            this._state = ToolLifecycleState.READY;
            this.logInfo('Initialization complete');
        } catch (error) {
            this._state = ToolLifecycleState.ERROR;
            this.logError('Initialization failed', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    protected abstract initializeInternal(): Promise<void>;
} 