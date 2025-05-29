import { ToolLifecycleState, LogLevel } from './sdk';
import { LLMHandler } from '../llm/handler';
import { Logger } from '../utils/logger';

export interface SymphonyConfig {
    serviceRegistry: {
        enabled: boolean;
        maxRetries: number;
        retryDelay: number;
    };
    logging: {
        level: LogLevel;
        format: 'json' | 'text';
    };
    metrics: {
        enabled: boolean;
        detailed: boolean;
    };
}

export interface IMetricsAPI {
    readonly startTime: number;
    start(id: string, metadata?: Record<string, any>): void;
    end(id: string, metadata?: Record<string, any>): void;
    get(id: string): any;
    update(id: string, metadata: Record<string, any>): void;
    getAll(): Record<string, any>;
}

// Simplified ISymphony interface for what we actually implement
export interface ISymphony {
    readonly name: string;
    readonly initialized: boolean;
    readonly isInitialized: boolean;
    readonly state: ToolLifecycleState;
    readonly llm: LLMHandler;
    readonly logger: Logger;
    readonly metrics: IMetricsAPI;
    readonly types: {
        CapabilityBuilder: {
            team(capability: string): string;
            agent(capability: string): string;
            numeric(capability: string): string;
            processing(capability: string): string;
        };
        CommonCapabilities: {
            readonly TOOL_USE: string;
            readonly COORDINATION: string;
            readonly PARALLEL: string;
            readonly ADD: string;
        };
    };

    getState(): ToolLifecycleState;
    getDependencies(): string[];
    getConfig(): SymphonyConfig;
    updateConfig(config: Partial<SymphonyConfig>): void;
    startMetric(id: string, metadata?: Record<string, any>): void;
    endMetric(id: string, metadata?: Record<string, any>): void;
    getMetric(id: string): any;
    initialize(): Promise<void>;
    getService(name: string): Promise<any>;
} 