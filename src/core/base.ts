import { Logger } from '../types/logging';
import { ToolLifecycleState } from '../types/lifecycle';

export interface IBaseManager {
    readonly name: string;
    readonly initialized: boolean;
    initialize(): Promise<void>;
    getDependencies(): string[];
    getState(): ToolLifecycleState;
}

export abstract class BaseManager implements IBaseManager {
    protected _initialized: boolean = false;
    protected _logger: Logger;
    protected _dependencies: string[] = [];
    protected _state: ToolLifecycleState = ToolLifecycleState.CREATED;

    constructor(protected readonly _name: string) {
        this._logger = new Logger(_name);
    }

    get name(): string {
        return this._name;
    }

    get initialized(): boolean {
        return this._initialized;
    }

    getDependencies(): string[] {
        return [...this._dependencies];
    }

    getState(): ToolLifecycleState {
        return this._state;
    }

    async initialize(): Promise<void> {
        if (this._initialized) {
            return;
        }

        try {
            this._state = ToolLifecycleState.INITIALIZING;
            await this.initializeInternal();
            this._initialized = true;
            this._state = ToolLifecycleState.READY;
        } catch (error) {
            this._state = ToolLifecycleState.ERROR;
            throw error;
        }
    }

    protected abstract initializeInternal(): Promise<void>;

    protected log(level: string, message: string, metadata?: Record<string, any>): void {
        this._logger.log(level, message, metadata);
    }

    protected logInfo(message: string, metadata?: Record<string, any>): void {
        this.log('INFO', message, metadata);
    }

    protected logError(message: string, metadata?: Record<string, any>): void {
        this.log('ERROR', message, metadata);
    }

    protected logWarn(message: string, metadata?: Record<string, any>): void {
        this.log('WARN', message, metadata);
    }

    protected logDebug(message: string, metadata?: Record<string, any>): void {
        this.log('DEBUG', message, metadata);
    }
} 