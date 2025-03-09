import { BaseManager } from '../managers/base';
import { ISymphony } from '../types/symphony';
import { LRUCache } from 'lru-cache';

export interface MessageHandler {
    (message: any): Promise<void> | void;
}

export interface MessageOptions {
    priority?: number;
    retain?: boolean;
    expireInMs?: number;
}

export class ServiceBus extends BaseManager {
    private handlers = new Map<string, Set<MessageHandler>>();
    private retainedMessages = new Map<string, any>();
    private priorityQueue = new Map<number, Set<string>>();
    private messageCache: LRUCache<string, any>;
    protected initialized = false;
    protected dependencies: BaseManager[] = [];

    constructor(symphony: ISymphony) {
        super(symphony, 'ServiceBus');
        
        // Initialize LRU cache for message deduplication and quick access
        this.messageCache = new LRUCache({
            max: 1000,  // Store last 1000 messages
            ttl: 1000 * 60 * 5  // Messages expire after 5 minutes
        });

        // Initialize priority levels (1-5, 1 being highest)
        for (let i = 1; i <= 5; i++) {
            this.priorityQueue.set(i, new Set());
        }
    }

    // Implement BaseManager's abstract methods
    protected async initializeInternal(): Promise<void> {
        // Start periodic priority queue processing
        setInterval(() => {
            this.processPriorityQueue().catch(error => {
                this.logError('Error processing priority queue', {
                    error: error instanceof Error ? error.message : String(error)
                });
            });
        }, 100); // Process every 100ms

        this.initialized = true;
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    addDependency(manager: BaseManager): void {
        this.dependencies.push(manager);
    }

    getDependencies(): BaseManager[] {
        return this.dependencies;
    }

    subscribeToMessage(messageType: string, handler: MessageHandler): void {
        if (!this.handlers.has(messageType)) {
            this.handlers.set(messageType, new Set());
        }
        this.handlers.get(messageType)!.add(handler);
    }

    unsubscribeFromMessage(messageType: string, handler: MessageHandler): void {
        const handlers = this.handlers.get(messageType);
        if (handlers) {
            handlers.delete(handler);
        }
    }

    // Override BaseManager's publish method
    async publish(message: any): Promise<void>;
    async publish(topic: string, message: any, options?: MessageOptions): Promise<void>;
    async publish(topicOrMessage: string | any, message?: any, options: MessageOptions = {}): Promise<void> {
        this.assertInitialized();

        // If only one argument, treat it as a message with default topic
        const topic = typeof topicOrMessage === 'string' ? topicOrMessage : 'default';
        const actualMessage = typeof topicOrMessage === 'string' ? message : topicOrMessage;

        // Handle retained messages
        if (options.retain) {
            this.retainedMessages.set(topic, actualMessage);
        }

        // Add to message cache
        const messageId = `${topic}-${Date.now()}`;
        this.messageCache.set(messageId, actualMessage);

        // Add to priority queue
        const priority = options.priority || 3; // Default priority is 3
        this.priorityQueue.get(priority)?.add(messageId);

        // Process immediately if high priority (1-2)
        if (priority <= 2) {
            await this.processMessageInternal(topic, actualMessage);
        }

        this.logInfo('Message published', {
            topic,
            messageId,
            priority,
            options
        });
    }

    getRetainedMessage(topic: string): any {
        return this.retainedMessages.get(topic);
    }

    private async processPriorityQueue(): Promise<void> {
        // Process messages in priority order (1 to 5)
        for (let priority = 1; priority <= 5; priority++) {
            const messages = this.priorityQueue.get(priority);
            if (!messages || messages.size === 0) continue;

            for (const messageId of messages) {
                const message = this.messageCache.get(messageId);
                if (!message) {
                    messages.delete(messageId);
                    continue;
                }

                const [topic] = messageId.split('-');
                await this.processMessageInternal(topic, message);
                messages.delete(messageId);

                this.logInfo('Message processed', {
                    messageId,
                    priority
                });
            }
        }
    }

    protected async processMessage(message: any): Promise<void> {
        await this.processMessageInternal('default', message);
    }

    private async processMessageInternal(topic: string, message: any): Promise<void> {
        const handlers = this.handlers.get(topic);
        if (!handlers) return;

        const promises = Array.from(handlers).map(handler => {
            try {
                return Promise.resolve(handler(message));
            } catch (error) {
                this.logError('Error in message handler', {
                    topic,
                    error: error instanceof Error ? error.message : String(error)
                });
                return Promise.reject(error);
            }
        });

        await Promise.allSettled(promises);
    }

    clearRetainedMessages(): void {
        this.retainedMessages.clear();
    }
} 