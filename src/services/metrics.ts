import { logger, LogCategory } from '../utils/logger';

export interface MetricData {
    startTime?: number;
    endTime?: number;
    duration?: number;
    success?: boolean;
    error?: string;
    [key: string]: any;
}

export class MetricsService {
    private metrics: Map<string, MetricData>;

    constructor() {
        this.metrics = new Map();
    }

    start(metricId: string, metadata?: Record<string, any>): void {
        this.metrics.set(metricId, {
            startTime: Date.now(),
            ...metadata
        });

        logger.debug(LogCategory.METRICS, `Started metric: ${metricId}`, {
            metadata: {
                metricId,
                ...metadata
            }
        });
    }

    end(metricId: string, metadata?: Record<string, any>): void {
        const metric = this.metrics.get(metricId);
        if (!metric) {
            logger.warn(LogCategory.METRICS, `Attempted to end non-existent metric: ${metricId}`);
            return;
        }

        const endTime = Date.now();
        const duration = metric.startTime ? endTime - metric.startTime : 0;

        this.metrics.set(metricId, {
            ...metric,
            ...metadata,
            endTime,
            duration
        });

        logger.debug(LogCategory.METRICS, `Ended metric: ${metricId}`, {
            metadata: {
                metricId,
                duration,
                ...metadata
            }
        });
    }

    get(metricId: string): MetricData | undefined {
        return this.metrics.get(metricId);
    }

    clear(metricId: string): void {
        this.metrics.delete(metricId);
    }

    clearAll(): void {
        this.metrics.clear();
    }

    getMetrics(): Record<string, MetricData> {
        return Object.fromEntries(this.metrics);
    }
} 