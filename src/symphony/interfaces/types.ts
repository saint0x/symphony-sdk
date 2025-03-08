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
        level: 'debug' | 'info' | 'warn' | 'error';
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

export interface TeamConfig {
    name: string;
    description: string;
    agents: string[];
}

export interface PipelineConfig {
    name: string;
    description: string;
    steps: PipelineStep[];
}

export interface PipelineStep {
    id: string;
    name: string;
    description: string;
    inputs: any;
    handler: (params: any) => Promise<any>;
}

export interface ToolResult<T = any> {
    success: boolean;
    result?: T;
    error?: Error;
    metrics?: {
        duration: number;
        startTime: number;
        endTime: number;
        [key: string]: any;
    };
}

export interface Tool<P = any, R = any> {
    name: string;
    description: string;
    run(params: P): Promise<ToolResult<R>>;
}

export interface AgentOptions {
    onProgress?: (update: { status: string; result?: any }) => void;
    onMetrics?: (metrics: { [key: string]: any }) => void;
}

export interface AgentResult<T = any> {
    success: boolean;
    result?: T;
    error?: Error;
    metrics?: {
        duration: number;
        startTime: number;
        endTime: number;
        toolCalls: number;
        [key: string]: any;
    };
}

export interface Agent {
    name: string;
    description: string;
    run(task: string, options?: AgentOptions): Promise<AgentResult>;
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
    readonly tools: IToolService;
    readonly agent: IAgentService;
    readonly team: ITeamService;
    readonly pipeline: IPipelineService;
    readonly components: ComponentManager;
    readonly validation: IValidationManager;
    readonly componentManager: ComponentManager;
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

    getConfig(): SymphonyConfig;
    updateConfig(config: Partial<SymphonyConfig>): void;
    initialize(options?: { logLevel?: LogLevel }): Promise<void>;
    getRegistry(): Promise<Registry | null>;
    getServiceBus(): ServiceBus;
    isInitialized(): boolean;
    startMetric(id: string, metadata?: Record<string, any>): void;
    endMetric(id: string, metadata?: Record<string, any>): void;
    getMetric(id: string): Record<string, any> | undefined;
} 