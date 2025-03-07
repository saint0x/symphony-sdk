import { logger, LogCategory } from '../utils/logger';

export interface MetricValue {
    value: number;
    timestamp: string;
    labels?: Record<string, string>;
}

export interface MetricDefinition {
    name: string;
    description: string;
    type: 'counter' | 'gauge' | 'histogram';
    unit?: string;
}

export interface MetricSeries {
    definition: MetricDefinition;
    values: MetricValue[];
}

export class MetricsCollector {
    private static instance: MetricsCollector;
    private metrics: Map<string, MetricSeries>;
    private retentionPeriod: number; // in milliseconds

    private constructor() {
        this.metrics = new Map();
        this.retentionPeriod = 24 * 60 * 60 * 1000; // 24 hours by default
        this.initializeDefaultMetrics();
        logger.info(LogCategory.SYSTEM, 'MetricsCollector instance created');
    }

    private initializeDefaultMetrics() {
        this.registerMetric({
            name: 'service_calls_total',
            description: 'Total number of service calls',
            type: 'counter'
        });

        this.registerMetric({
            name: 'service_errors_total',
            description: 'Total number of service errors',
            type: 'counter'
        });

        this.registerMetric({
            name: 'service_latency_ms',
            description: 'Service call latency in milliseconds',
            type: 'histogram',
            unit: 'ms'
        });

        this.registerMetric({
            name: 'memory_usage_mb',
            description: 'Memory usage in megabytes',
            type: 'gauge',
            unit: 'MB'
        });

        this.registerMetric({
            name: 'cpu_usage_percent',
            description: 'CPU usage percentage',
            type: 'gauge',
            unit: '%'
        });

        logger.debug(LogCategory.SYSTEM, 'Default metrics initialized');
    }

    public static getInstance(): MetricsCollector {
        if (!MetricsCollector.instance) {
            MetricsCollector.instance = new MetricsCollector();
        }
        return MetricsCollector.instance;
    }

    public registerMetric(definition: MetricDefinition): void {
        if (this.metrics.has(definition.name)) {
            logger.warn(LogCategory.SYSTEM, 'Metric already registered', {
                metadata: {
                    metricName: definition.name
                }
            });
            return;
        }

        this.metrics.set(definition.name, {
            definition,
            values: []
        });

        logger.debug(LogCategory.SYSTEM, 'Metric registered', {
            metadata: {
                metricName: definition.name,
                type: definition.type
            }
        });
    }

    public recordMetric(name: string, value: number, labels?: Record<string, string>): void {
        const series = this.metrics.get(name);
        if (!series) {
            logger.error(LogCategory.SYSTEM, 'Metric not found', {
                metadata: {
                    metricName: name
                }
            });
            return;
        }

        const metricValue: MetricValue = {
            value,
            timestamp: new Date().toISOString(),
            labels
        };

        series.values.push(metricValue);
        this.pruneOldValues(series);

        logger.debug(LogCategory.SYSTEM, 'Metric recorded', {
            metadata: {
                metricName: name,
                value,
                labels
            }
        });
    }

    private pruneOldValues(series: MetricSeries): void {
        const cutoffTime = Date.now() - this.retentionPeriod;
        series.values = series.values.filter(value => 
            new Date(value.timestamp).getTime() > cutoffTime
        );
    }

    public getMetric(name: string): MetricSeries | undefined {
        return this.metrics.get(name);
    }

    public getMetricValue(name: string, labels?: Record<string, string>): number | undefined {
        const series = this.metrics.get(name);
        if (!series || series.values.length === 0) {
            return undefined;
        }

        if (series.definition.type === 'counter') {
            return this.calculateCounterValue(series, labels);
        } else if (series.definition.type === 'gauge') {
            return this.getLatestValue(series, labels);
        } else if (series.definition.type === 'histogram') {
            return this.calculateHistogramAverage(series, labels);
        }

        return undefined;
    }

    private calculateCounterValue(series: MetricSeries, labels?: Record<string, string>): number {
        return series.values
            .filter(v => this.matchLabels(v.labels, labels))
            .reduce((sum, v) => sum + v.value, 0);
    }

    private getLatestValue(series: MetricSeries, labels?: Record<string, string>): number | undefined {
        const matchingValues = series.values
            .filter(v => this.matchLabels(v.labels, labels))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        return matchingValues[0]?.value;
    }

    private calculateHistogramAverage(series: MetricSeries, labels?: Record<string, string>): number | undefined {
        const matchingValues = series.values.filter(v => this.matchLabels(v.labels, labels));
        if (matchingValues.length === 0) {
            return undefined;
        }

        const sum = matchingValues.reduce((acc, v) => acc + v.value, 0);
        return sum / matchingValues.length;
    }

    private matchLabels(valueLabels?: Record<string, string>, queryLabels?: Record<string, string>): boolean {
        if (!queryLabels) {
            return true;
        }
        if (!valueLabels) {
            return false;
        }

        return Object.entries(queryLabels).every(([key, value]) => valueLabels[key] === value);
    }

    public setRetentionPeriod(periodMs: number): void {
        this.retentionPeriod = periodMs;
        logger.debug(LogCategory.SYSTEM, 'Retention period updated', {
            metadata: {
                periodMs
            }
        });

        // Prune all series with new retention period
        for (const series of this.metrics.values()) {
            this.pruneOldValues(series);
        }
    }

    public getMetricsSummary(): Record<string, any> {
        const summary: Record<string, any> = {};

        for (const [name, series] of this.metrics) {
            summary[name] = {
                type: series.definition.type,
                unit: series.definition.unit,
                currentValue: this.getMetricValue(name),
                totalValues: series.values.length,
                oldestValue: series.values[0]?.value,
                newestValue: series.values[series.values.length - 1]?.value
            };
        }

        return summary;
    }
} 