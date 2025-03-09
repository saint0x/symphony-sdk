import { BaseService } from './base';
import { ISymphony } from '../types/symphony';
import { ToolLifecycleState } from '../types/lifecycle';

export interface MessageHandler {
    handle(message: any): Promise<void>;
}

export class ServiceBus extends BaseService {
    private handlers: Map<string, MessageHandler> = new Map();
    private retainedMessages: Map<string, any> = new Map();

    constructor() {
        super({} as ISymphony, 'ServiceBus');
        this._dependencies = [];
    }

    async publish(message: any, options?: { priority?: number; retain?: boolean }): Promise<void> {
        return this.withErrorHandling('publish', async () => {
            this.assertInitialized();
            
            const messageType = message.type || 'default';
            const handler = this.handlers.get(messageType);

            if (options?.retain) {
                this.retainedMessages.set(messageType, message);
            }

            if (handler) {
                await handler.handle(message);
            }
        });
    }

    subscribe(messageType: string, handler: MessageHandler): void {
        this.handlers.set(messageType, handler);

        // Send retained message if exists
        const retainedMessage = this.retainedMessages.get(messageType);
        if (retainedMessage) {
            handler.handle(retainedMessage).catch(error => {
                this.logError(`Error handling retained message: ${error instanceof Error ? error.message : String(error)}`);
            });
        }
    }

    unsubscribe(messageType: string): void {
        this.handlers.delete(messageType);
    }

    protected async initializeInternal(): Promise<void> {
        this.logInfo('Initializing service bus');
        this._state = ToolLifecycleState.READY;
    }
} 