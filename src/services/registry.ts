import { BaseService } from './base';
import { ISymphony } from '../types/symphony';
import { ToolLifecycleState } from '../types/lifecycle';

export class ServiceRegistry extends BaseService {
    private readonly registry: Map<string, any> = new Map();

    constructor(symphony: ISymphony) {
        super(symphony, 'ServiceRegistry');
        this._dependencies = [];
    }

    async register<T>(name: string, service: T): Promise<void> {
        return this.withErrorHandling('register', async () => {
            this.assertInitialized();
            if (this.registry.has(name)) {
                throw new Error(`Service ${name} is already registered`);
            }
            this.registry.set(name, service);
            this.logInfo(`Registered service: ${name}`);
        });
    }

    async get<T>(name: string): Promise<T | undefined> {
        return this.withErrorHandling('get', async () => {
            this.assertInitialized();
            return this.registry.get(name) as T;
        });
    }

    async list(): Promise<string[]> {
        return this.withErrorHandling('list', async () => {
            this.assertInitialized();
            return Array.from(this.registry.keys());
        });
    }

    protected async initializeInternal(): Promise<void> {
        this.logInfo('Initializing service registry');
        this._state = ToolLifecycleState.READY;
    }
} 