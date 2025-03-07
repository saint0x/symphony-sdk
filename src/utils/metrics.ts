import { ExecutionMetrics } from '../types/sdk';

export interface MetricsTracker {
    start: number;
    stages: Record<string, number>;
    operations: Record<string, number>;
    modelVersions: Record<string, string>;
    resourceUsage: {
        memory: NodeJS.MemoryUsage;
        modelLoads: Record<string, boolean>;
    };
    end: () => ExecutionMetrics;
    trackStage: (stage: string) => void;
    trackOperation: (operation: string) => void;
    trackModel: (name: string, version: string) => void;
    trackModelLoad: (model: string) => void;
}

export function createMetricsTracker(): MetricsTracker {
    const startTime = Date.now();
    const stages: Record<string, number> = {};
    const operations: Record<string, number> = {};
    const modelVersions: Record<string, string> = {};
    const modelLoads: Record<string, boolean> = {};
    let currentStage: string | null = null;
    let currentOperation: string | null = null;

    const getMemoryUsage = (): NodeJS.MemoryUsage => {
        const usage = process.memoryUsage();
        return {
            heapTotal: usage.heapTotal,
            heapUsed: usage.heapUsed,
            external: usage.external,
            arrayBuffers: usage.arrayBuffers,
            rss: usage.rss
        };
    };

    return {
        start: startTime,
        stages,
        operations,
        modelVersions,
        resourceUsage: {
            memory: getMemoryUsage(),
            modelLoads
        },
        trackStage: (stage: string) => {
            if (currentStage) {
                stages[currentStage] = Date.now() - (stages[currentStage] || startTime);
            }
            stages[stage] = Date.now();
            currentStage = stage;
        },
        trackOperation: (operation: string) => {
            if (currentOperation) {
                operations[currentOperation] = Date.now() - (operations[currentOperation] || startTime);
            }
            operations[operation] = Date.now();
            currentOperation = operation;
        },
        trackModel: (name: string, version: string) => {
            modelVersions[name] = version;
        },
        trackModelLoad: (model: string) => {
            modelLoads[model] = true;
        },
        end: () => {
            // Finalize current stage/operation if any
            if (currentStage) {
                stages[currentStage] = Date.now() - (stages[currentStage] || startTime);
            }
            if (currentOperation) {
                operations[currentOperation] = Date.now() - (operations[currentOperation] || startTime);
            }

            return {
                duration: Date.now() - startTime,
                startTime,
                endTime: Date.now(),
                stages: Object.keys(stages).length > 0 ? stages : undefined,
                operations: Object.keys(operations).length > 0 ? operations : undefined,
                modelVersions: Object.keys(modelVersions).length > 0 ? modelVersions : undefined,
                resourceUsage: {
                    memory: getMemoryUsage(),
                    modelLoads: Object.keys(modelLoads).length > 0 ? modelLoads : undefined
                }
            };
        }
    };
}

// Global metrics singleton for SDK-wide tracking
class GlobalMetrics {
    private static instance: GlobalMetrics;
    private metrics: Map<string, any> = new Map();
    private startTime: number = Date.now();

    private constructor() {}

    static getInstance(): GlobalMetrics {
        if (!GlobalMetrics.instance) {
            GlobalMetrics.instance = new GlobalMetrics();
        }
        return GlobalMetrics.instance;
    }

    start(category: string, initialData: Record<string, any> = {}) {
        this.metrics.set(category, {
            ...initialData,
            startTime: this.startTime,
            timestamp: Date.now(),
            stages: {},
            operations: {},
            modelVersions: {},
            resourceUsage: {
                memory: process.memoryUsage(),
                modelLoads: {}
            }
        });
    }

    update(category: string, data: Record<string, any>) {
        const existing = this.metrics.get(category) || {};
        this.metrics.set(category, {
            ...existing,
            ...data,
            lastUpdated: Date.now(),
            resourceUsage: {
                ...existing.resourceUsage,
                memory: process.memoryUsage()
            }
        });
    }

    end(category: string, data: Record<string, any> = {}) {
        const existing = this.metrics.get(category);
        if (existing) {
            this.metrics.set(category, {
                ...existing,
                ...data,
                endTime: Date.now(),
                duration: Date.now() - existing.startTime,
                finalResourceUsage: {
                    memory: process.memoryUsage(),
                    modelLoads: existing.resourceUsage?.modelLoads
                }
            });
        }
    }

    get(category: string) {
        return this.metrics.get(category);
    }

    getAll() {
        return Object.fromEntries(this.metrics);
    }

    clear() {
        this.metrics.clear();
    }
}

export const globalMetrics = GlobalMetrics.getInstance(); 