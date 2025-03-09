import { BaseService } from './base';
import { ISymphony } from '../types/symphony';
import { ToolLifecycleState } from '../types/lifecycle';

export class ContextManager extends BaseService {
    private contexts: Map<string, any> = new Map();

    constructor() {
        super({} as ISymphony, 'ContextManager');
        this._dependencies = [];
    }

    async set(key: string, value: any): Promise<void> {
        return this.withErrorHandling('set', async () => {
            this.assertInitialized();
            this.contexts.set(key, value);
        });
    }

    async get(key: string): Promise<any> {
        return this.withErrorHandling('get', async () => {
            this.assertInitialized();
            return this.contexts.get(key);
        });
    }

    async delete(key: string): Promise<void> {
        return this.withErrorHandling('delete', async () => {
            this.assertInitialized();
            this.contexts.delete(key);
        });
    }

    async clear(): Promise<void> {
        return this.withErrorHandling('clear', async () => {
            this.assertInitialized();
            this.contexts.clear();
        });
    }

    protected async initializeInternal(): Promise<void> {
        this.logInfo('Initializing context manager');
        this._state = ToolLifecycleState.READY;
    }
} 