import { ToolLifecycleState } from './lifecycle';
import { IAgentService, IToolService, ITeamService, IPipelineService } from '../services/interfaces';
import { ServiceRegistry } from '../proto/symphonic/core/types';
import { LLMHandler } from '../llm/handler';
import { ContextManager } from '../proto/symphonic/core/cache/context';
import { ServiceBus } from '../services/bus';
import { ComponentManager } from '../symphony/components/component-manager';
import { Logger } from '../utils/logger';
import { IValidationManager } from '../managers/validation';
import { LogLevel } from '../types/sdk';

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

export interface ISymphony {
    readonly name: string;
    readonly initialized: boolean;
    readonly isInitialized: boolean;
    readonly state: ToolLifecycleState;
    readonly llm: LLMHandler;
    readonly contextManager: ContextManager;
    readonly logger: Logger;
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
    readonly bus: ServiceBus;
    readonly components: ComponentManager;
    readonly componentManager: ComponentManager;
    readonly tool: IToolService;
    readonly agent: IAgentService;
    readonly team: ITeamService;
    readonly pipeline: IPipelineService;
    readonly validation: IValidationManager;
    readonly validationManager: IValidationManager;
    readonly metrics: IMetricsAPI;
    readonly serviceRegistry: ServiceRegistry;

    getState(): ToolLifecycleState;
    getDependencies(): string[];
    getConfig(): SymphonyConfig;
    updateConfig(config: Partial<SymphonyConfig>): void;
    getRegistry(): Promise<ServiceRegistry>;
    getServiceBus(): ServiceBus;
    startMetric(id: string, metadata?: Record<string, any>): void;
    endMetric(id: string, metadata?: Record<string, any>): void;
    getMetric(id: string): any;
    initialize(options?: { logLevel?: LogLevel }): Promise<void>;
    getService(name: string): Promise<any>;
} 