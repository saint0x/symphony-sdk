import { Logger, LogCategory } from '../utils/logger';

interface Message {
    type: string;
    service: string;
    payload: any;
    correlationId?: string;
    timestamp: number;
}

interface MessageHandler {
    handle(message: Message): Promise<void>;
}

export class ServiceBus {
    private handlers = new Map<string, Set<MessageHandler>>();
    private pending = new Map<string, (value: any) => void>();
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance({ serviceContext: 'ServiceBus' });
    }

    async publish(message: Message): Promise<void> {
        const handlers = this.handlers.get(message.type) || new Set();
        
        try {
            await Promise.all(
                Array.from(handlers).map(handler => 
                    handler.handle(message)
                )
            );
            
            this.logger.debug(LogCategory.SYSTEM, `Message published: ${message.type}`, {
                metadata: {
                    service: message.service,
                    correlationId: message.correlationId
                }
            });
        } catch (error) {
            this.logger.error(LogCategory.ERROR, `Message handling failed: ${message.type}`, {
                error,
                metadata: {
                    service: message.service,
                    correlationId: message.correlationId
                }
            });
            throw error;
        }
    }

    subscribe(messageType: string, handler: MessageHandler): void {
        if (!this.handlers.has(messageType)) {
            this.handlers.set(messageType, new Set());
        }
        this.handlers.get(messageType)!.add(handler);
        
        this.logger.debug(LogCategory.SYSTEM, `Handler subscribed: ${messageType}`);
    }

    async request<T>(message: Message): Promise<T> {
        return new Promise((resolve, reject) => {
            const correlationId = message.correlationId || `${Date.now()}-${Math.random()}`;
            this.pending.set(correlationId, resolve);
            
            this.publish({
                ...message,
                correlationId
            }).catch(reject);
            
            // Cleanup after timeout
            setTimeout(() => {
                if (this.pending.has(correlationId)) {
                    this.pending.delete(correlationId);
                    reject(new Error(`Request timeout: ${message.type}`));
                }
            }, 30000); // 30s timeout
        });
    }

    handleResponse(correlationId: string, response: any): void {
        const resolver = this.pending.get(correlationId);
        if (resolver) {
            resolver(response);
            this.pending.delete(correlationId);
        }
    }
} 