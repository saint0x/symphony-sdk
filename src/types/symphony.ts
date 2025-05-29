import { ToolLifecycleState } from './sdk';
import { LLMHandler } from '../llm/handler';
import { Logger } from '../utils/logger';
import { IDatabaseService, DatabaseConfig } from '../db/types';

export interface SymphonyConfig {
    name?: string;
    version?: string;
    environment?: 'development' | 'staging' | 'production';
    logging?: {
        level?: 'debug' | 'info' | 'warn' | 'error';
        format?: 'json' | 'simple';
    };
    llm?: {
        apiKey?: string;
        model?: string;
        baseURL?: string;
    };
    db?: DatabaseConfig;
    serviceRegistry: {
        enabled: boolean;
        maxRetries: number;
        retryDelay: number;
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
    readonly tool: any;
    readonly agent: any;
    readonly team: any;
    readonly pipeline: any;
    readonly db: IDatabaseService;
    readonly validation: any;
    readonly validationManager: any;
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