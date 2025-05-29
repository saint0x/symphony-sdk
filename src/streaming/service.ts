import { Logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface StreamingConfig {
    enableRealTimeUpdates?: boolean;
    progressUpdateInterval?: number; // milliseconds (default: 100ms)
    maxConcurrentStreams?: number;   // default: 50
    enableWebSocket?: boolean;
    bufferSize?: number;             // default: 1000 messages
}

export interface ProgressUpdate {
    id: string;
    type: 'agent' | 'team' | 'pipeline' | 'tool' | 'chain';
    status: 'started' | 'progress' | 'completed' | 'error' | 'cancelled';
    progress: {
        current: number;
        total: number;
        percentage: number;
    };
    message?: string;
    data?: any;
    timestamp: Date;
    duration?: number; // milliseconds since start
}

export interface StreamOptions {
    id: string;
    type: 'agent' | 'team' | 'pipeline' | 'tool' | 'chain';
    enableProgress?: boolean;
    progressInterval?: number;
    metadata?: Record<string, any>;
}

export interface StreamingStats {
    activeStreams: number;
    totalStreamsCreated: number;
    messagesSent: number;
    averageStreamDuration: number;
    peakConcurrentStreams: number;
}

export class StreamingService extends EventEmitter {
    private static instance: StreamingService;
    private logger: Logger;
    private config: StreamingConfig;
    private initialized: boolean = false;

    // Stream management
    private activeStreams: Map<string, StreamContext> = new Map();
    private progressTimers: Map<string, NodeJS.Timeout> = new Map();
    private streamBuffer: Map<string, ProgressUpdate[]> = new Map();

    // Performance tracking
    private stats: StreamingStats = {
        activeStreams: 0,
        totalStreamsCreated: 0,
        messagesSent: 0,
        averageStreamDuration: 0,
        peakConcurrentStreams: 0
    };

    private constructor() {
        super();
        this.logger = Logger.getInstance('StreamingService');
        this.config = {
            enableRealTimeUpdates: true,
            progressUpdateInterval: 100,
            maxConcurrentStreams: 50,
            enableWebSocket: false,
            bufferSize: 1000
        };
    }

    static getInstance(): StreamingService {
        if (!StreamingService.instance) {
            StreamingService.instance = new StreamingService();
        }
        return StreamingService.instance;
    }

    async initialize(config?: StreamingConfig): Promise<void> {
        if (this.initialized) return;

        this.logger.info('StreamingService', 'Initializing streaming service');

        try {
            // Update configuration
            if (config) {
                this.config = { ...this.config, ...config };
            }

            // Set up event listeners
            this.setupEventListeners();

            this.initialized = true;
            this.logger.info('StreamingService', 'Streaming service initialized successfully', {
                realTimeUpdates: this.config.enableRealTimeUpdates,
                progressInterval: this.config.progressUpdateInterval,
                maxStreams: this.config.maxConcurrentStreams
            });
        } catch (error) {
            this.logger.error('StreamingService', 'Failed to initialize', { error });
            throw error;
        }
    }

    // === STREAM LIFECYCLE MANAGEMENT ===

    createStream(options: StreamOptions): string {
        if (!this.initialized) {
            throw new Error('StreamingService not initialized');
        }

        if (this.activeStreams.size >= this.config.maxConcurrentStreams!) {
            throw new Error('Maximum concurrent streams limit reached');
        }

        const streamId = options.id;
        const startTime = Date.now();

        const context: StreamContext = {
            id: streamId,
            type: options.type,
            startTime,
            lastUpdate: startTime,
            options,
            subscribers: new Set(),
            status: 'started',
            progress: { current: 0, total: 100, percentage: 0 }
        };

        this.activeStreams.set(streamId, context);
        this.streamBuffer.set(streamId, []);
        this.stats.totalStreamsCreated++;
        this.stats.activeStreams = this.activeStreams.size;

        if (this.stats.activeStreams > this.stats.peakConcurrentStreams) {
            this.stats.peakConcurrentStreams = this.stats.activeStreams;
        }

        // Start progress updates if enabled
        if (options.enableProgress && this.config.enableRealTimeUpdates) {
            this.startProgressUpdates(streamId);
        }

        // Send initial update
        this.sendUpdate(streamId, {
            id: streamId,
            type: options.type,
            status: 'started',
            progress: { current: 0, total: 100, percentage: 0 },
            message: `${options.type} started`,
            timestamp: new Date()
        });

        this.logger.debug('StreamingService', 'Stream created', {
            streamId,
            type: options.type,
            activeStreams: this.stats.activeStreams
        });

        return streamId;
    }

    updateProgress(streamId: string, progress: Partial<ProgressUpdate>): void {
        const context = this.activeStreams.get(streamId);
        if (!context) {
            this.logger.warn('StreamingService', 'Stream not found for progress update', { streamId });
            return;
        }

        const now = Date.now();
        const update: ProgressUpdate = {
            id: streamId,
            type: context.type,
            status: progress.status || 'progress',
            progress: progress.progress || context.progress,
            message: progress.message,
            data: progress.data,
            timestamp: new Date(),
            duration: now - context.startTime
        };

        // Update context
        context.lastUpdate = now;
        context.status = update.status;
        if (update.progress) {
            context.progress = update.progress;
        }

        this.sendUpdate(streamId, update);
    }

    completeStream(streamId: string, finalData?: any): void {
        const context = this.activeStreams.get(streamId);
        if (!context) {
            this.logger.warn('StreamingService', 'Stream not found for completion', { streamId });
            return;
        }

        const now = Date.now();
        const duration = now - context.startTime;

        // Send completion update
        this.sendUpdate(streamId, {
            id: streamId,
            type: context.type,
            status: 'completed',
            progress: { current: 100, total: 100, percentage: 100 },
            message: `${context.type} completed`,
            data: finalData,
            timestamp: new Date(),
            duration
        });

        // Update statistics
        this.updateStreamStats(duration);

        // Cleanup
        this.cleanupStream(streamId);

        this.logger.debug('StreamingService', 'Stream completed', {
            streamId,
            duration: `${duration}ms`
        });
    }

    errorStream(streamId: string, error: Error): void {
        const context = this.activeStreams.get(streamId);
        if (!context) {
            this.logger.warn('StreamingService', 'Stream not found for error', { streamId });
            return;
        }

        const now = Date.now();
        const duration = now - context.startTime;

        // Send error update
        this.sendUpdate(streamId, {
            id: streamId,
            type: context.type,
            status: 'error',
            progress: context.progress,
            message: `Error: ${error.message}`,
            data: { error: error.message },
            timestamp: new Date(),
            duration
        });

        // Update statistics
        this.updateStreamStats(duration);

        // Cleanup
        this.cleanupStream(streamId);

        this.logger.error('StreamingService', 'Stream error', {
            streamId,
            error: error.message,
            duration: `${duration}ms`
        });
    }

    // === SUBSCRIPTION MANAGEMENT ===

    subscribe(streamId: string, callback: (update: ProgressUpdate) => void): () => void {
        const context = this.activeStreams.get(streamId);
        if (!context) {
            throw new Error(`Stream ${streamId} not found`);
        }

        context.subscribers.add(callback);

        // Send buffered updates to new subscriber
        const buffer = this.streamBuffer.get(streamId) || [];
        buffer.forEach(update => callback(update));

        this.logger.debug('StreamingService', 'Subscriber added', {
            streamId,
            totalSubscribers: context.subscribers.size
        });

        // Return unsubscribe function
        return () => {
            context.subscribers.delete(callback);
            this.logger.debug('StreamingService', 'Subscriber removed', {
                streamId,
                totalSubscribers: context.subscribers.size
            });
        };
    }

    // === UTILITY METHODS ===

    getActiveStreams(): string[] {
        return Array.from(this.activeStreams.keys());
    }

    getStreamStatus(streamId: string): StreamContext | null {
        return this.activeStreams.get(streamId) || null;
    }

    getStats(): StreamingStats {
        return { ...this.stats, activeStreams: this.activeStreams.size };
    }

    // === PRIVATE METHODS ===

    private sendUpdate(streamId: string, update: ProgressUpdate): void {
        const context = this.activeStreams.get(streamId);
        if (!context) return;

        // Add to buffer
        const buffer = this.streamBuffer.get(streamId) || [];
        buffer.push(update);
        
        // Trim buffer if needed
        if (buffer.length > this.config.bufferSize!) {
            buffer.shift();
        }
        this.streamBuffer.set(streamId, buffer);

        // Send to subscribers
        context.subscribers.forEach(callback => {
            try {
                callback(update);
            } catch (error) {
                this.logger.error('StreamingService', 'Subscriber callback error', { error, streamId });
            }
        });

        // Emit global event
        this.emit('update', update);

        this.stats.messagesSent++;
    }

    private startProgressUpdates(streamId: string): void {
        const interval = setInterval(() => {
            const context = this.activeStreams.get(streamId);
            if (!context || context.status === 'completed' || context.status === 'error') {
                clearInterval(interval);
                return;
            }

            // Send heartbeat update
            this.sendUpdate(streamId, {
                id: streamId,
                type: context.type,
                status: 'progress',
                progress: context.progress,
                message: 'Processing...',
                timestamp: new Date(),
                duration: Date.now() - context.startTime
            });
        }, this.config.progressUpdateInterval);

        this.progressTimers.set(streamId, interval);
    }

    private cleanupStream(streamId: string): void {
        // Clear progress timer
        const timer = this.progressTimers.get(streamId);
        if (timer) {
            clearInterval(timer);
            this.progressTimers.delete(streamId);
        }

        // Remove from active streams
        this.activeStreams.delete(streamId);
        this.stats.activeStreams = this.activeStreams.size;

        // Clean buffer after delay to allow final reads
        setTimeout(() => {
            this.streamBuffer.delete(streamId);
        }, 5000);
    }

    private updateStreamStats(duration: number): void {
        const totalDuration = this.stats.averageStreamDuration * (this.stats.totalStreamsCreated - 1) + duration;
        this.stats.averageStreamDuration = totalDuration / this.stats.totalStreamsCreated;
    }

    private setupEventListeners(): void {
        // Global error handling
        this.on('error', (error) => {
            this.logger.error('StreamingService', 'Global streaming error', { error });
        });

        // Cleanup on process exit
        process.on('beforeExit', () => {
            this.cleanup();
        });
    }

    private cleanup(): void {
        // Clear all timers
        this.progressTimers.forEach(timer => clearInterval(timer));
        this.progressTimers.clear();

        // Clear streams
        this.activeStreams.clear();
        this.streamBuffer.clear();

        this.logger.info('StreamingService', 'Streaming service cleaned up');
    }

    async healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        activeStreams: number;
        stats: StreamingStats;
        memoryUsage: {
            streamsSize: number;
            bufferSize: number;
        };
    }> {
        try {
            const streamBufferSize = Array.from(this.streamBuffer.values())
                .reduce((total, buffer) => total + buffer.length, 0);

            return {
                status: this.initialized ? 'healthy' : 'unhealthy',
                activeStreams: this.activeStreams.size,
                stats: this.getStats(),
                memoryUsage: {
                    streamsSize: this.activeStreams.size,
                    bufferSize: streamBufferSize
                }
            };
        } catch (error) {
            this.logger.error('StreamingService', 'Health check failed', { error });
            return {
                status: 'unhealthy',
                activeStreams: 0,
                stats: this.stats,
                memoryUsage: { streamsSize: 0, bufferSize: 0 }
            };
        }
    }
}

// Internal interface for stream context
interface StreamContext {
    id: string;
    type: 'agent' | 'team' | 'pipeline' | 'tool' | 'chain';
    startTime: number;
    lastUpdate: number;
    options: StreamOptions;
    subscribers: Set<(update: ProgressUpdate) => void>;
    status: 'started' | 'progress' | 'completed' | 'error' | 'cancelled';
    progress: {
        current: number;
        total: number;
        percentage: number;
    };
} 