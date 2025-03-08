import { ComponentInstance, ComponentMetadata, Component, ComponentPath } from '../../types/metadata';
import { IToolService, IAgentService, ITeamService, IPipelineService } from '../../services/interfaces';
import { IValidationManager } from '../../managers/validation';
import { ServiceBus } from '../../core/servicebus';
import { ComponentManager } from '../../managers/component';
import { Registry } from '../registry';
import { LogLevel } from '../../types/sdk';

export interface IComponentManager {
    register(metadata: ComponentMetadata, instance: Component): Promise<void>;
    findComponents(capability: string): ComponentInstance[];
    findOptimalPath(inputCapability: string, outputCapability: string): ComponentPath | null;
    getComponent(id: string): ComponentInstance | undefined;
    initialize(): Promise<void>;
}

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

export interface GlobalMetrics {
    startTime: number;
    start(id: string, metadata?: Record<string, any>): void;
    end(id: string, metadata?: Record<string, any>): void;
    get(id: string): Record<string, any> | undefined;
    update(id: string, metadata: Record<string, any>): void;
    getAll(): Record<string, any>;
}

export interface SymphonyUtils {
    validation: {
        validate(data: any, schema: string): Promise<{ isValid: boolean; errors: string[] }>;
    };
    metrics: {
        start(id: string, metadata?: Record<string, any>): void;
        end(id: string, metadata?: Record<string, any>): void;
        get(id: string): Record<string, any> | undefined;
    };
}

export interface ISymphony {
    readonly agent: IAgentService;
    readonly tool: IToolService;
    readonly team: ITeamService;
    readonly pipeline: IPipelineService;
    readonly componentManager: ComponentManager;
    readonly validation: IValidationManager;
    readonly types: {
        CapabilityBuilder: {
            team(capability: string): string;
            agent(capability: string): string;
            numeric(capability: string): string;
            processing(capability: string): string;
        };
        CommonCapabilities: {
            TOOL_USE: string;
            COORDINATION: string;
            PARALLEL: string;
            ADD: string;
        };
        DEFAULT_LLM_CONFIG: {
            provider: string;
            model: string;
            temperature: number;
            maxTokens: number;
        };
    };
    readonly metrics: {
        startTime: number;
        start(id: string, metadata?: Record<string, any>): void;
        end(id: string, metadata?: Record<string, any>): void;
        get(id: string): Record<string, any> | undefined;
        update(id: string, metadata: Record<string, any>): void;
        getAll(): Record<string, any>;
    };
    readonly logger: {
        debug(category: string, message: string, data?: any): void;
        info(category: string, message: string, data?: any): void;
        warn(category: string, message: string, data?: any): void;
        error(category: string, message: string, data?: any): void;
    };

    initialize(options?: { logLevel?: LogLevel }): Promise<void>;
    isInitialized(): boolean;
    getConfig(): SymphonyConfig;
    updateConfig(config: Partial<SymphonyConfig>): void;
    getRegistry(): Promise<Registry | null>;
    getServiceBus(): ServiceBus;
    startMetric(id: string, metadata?: Record<string, any>): void;
    endMetric(id: string, metadata?: Record<string, any>): void;
    getMetric(id: string): Record<string, any> | undefined;
} 