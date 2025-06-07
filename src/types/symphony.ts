import { ToolLifecycleState } from './sdk';
import { LLMHandler } from '../llm/handler';
import { Logger } from '../utils/logger';
import { IDatabaseService, DatabaseConfig } from '../db/types';
import { LLMConfig as RichLLMConfig } from '../llm/types';
import { IToolService, IAgentService, ITeamService, IPipelineService, IValidationManager } from './interfaces';
import { IntelligenceOptions } from '../cache/service';
import { MemoryConfig as InternalMemoryConfig } from '../memory/service';
import { StreamingConfig } from '../streaming/service';
import { RuntimeConfiguration } from '../runtime/RuntimeTypes';

export interface SymphonyConfig {
    name?: string;
    version?: string;
    environment?: 'development' | 'staging' | 'production';
    logging?: {
        level?: 'debug' | 'info' | 'warn' | 'error';
        format?: 'json' | 'simple';
    };
    llm?: RichLLMConfig;
    db?: DatabaseConfig;
    cache?: IntelligenceOptions;
    memory?: InternalMemoryConfig;
    streaming?: StreamingConfig;
    runtime?: Partial<RuntimeConfiguration>;
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
    readonly tool: IToolService;
    readonly agent: IAgentService;
    readonly team: ITeamService;
    readonly pipeline: IPipelineService;
    readonly db: IDatabaseService;
    readonly validation: IValidationManager;
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