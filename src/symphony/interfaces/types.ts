import { LogLevel } from '../../types/sdk';

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
    name: string;
    description: string;
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
    tools: {
        create(config: {
            name: string;
            description: string;
            inputs: string[];
            handler: (params: any) => Promise<any>;
        }): any;
        initialize(): Promise<void>;
    };
    agent: {
        create(config: {
            name: string;
            description: string;
            task: string;
            tools: any[];
            llm: {
                provider: string;
                model: string;
                temperature?: number;
                maxTokens?: number;
            };
            maxCalls?: number;
            requireApproval?: boolean;
            timeout?: number;
        }): any;
        initialize(): Promise<void>;
    };
    team: {
        create: (config: TeamConfig) => Promise<any>;
        initialize(): Promise<void>;
    };
    pipeline: {
        create: (config: PipelineConfig) => Promise<any>;
        initialize(): Promise<void>;
    };
    metrics: GlobalMetrics;
    validation: any;
    components: any;
    utils: SymphonyUtils;
    initialize(options?: { logLevel?: LogLevel }): Promise<void>;
    getRegistry(): Promise<any>;
    isInitialized(): boolean;
    startMetric(id: string, metadata?: Record<string, any>): void;
    endMetric(id: string, metadata?: Record<string, any>): void;
    getMetric(id: string): Record<string, any> | undefined;
} 