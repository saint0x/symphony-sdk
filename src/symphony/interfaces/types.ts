import { ToolConfig, AgentConfig, TeamConfig, PipelineConfig } from '../../types/sdk';
import { globalMetrics } from '../../utils/metrics';
import { logger } from '../../utils/logger';
import { validateConfig } from '../../utils/validation';

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

export interface SymphonyUtils {
    metrics: typeof globalMetrics;
    logger: typeof logger;
    validation: {
        validateConfig: typeof validateConfig;
        validateInput: typeof validateConfig;
        validateOutput: typeof validateConfig;
    };
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

export interface ISymphony {
    metrics: typeof globalMetrics;
    startTime: number;
    utils: SymphonyUtils;
    getRegistry(): Promise<any>;
    getConfig(): SymphonyConfig;
    updateConfig(config: Partial<SymphonyConfig>): void;
    tools: {
        create<P = any, R = any>(config: {
            name: string;
            description: string;
            inputs: string[];
            handler: (params: P) => Promise<ToolResult<R>>;
        }): Tool<P, R>;
    };
    agent: {
        create(config: {
            name: string;
            description: string;
            task: string;
            tools: Tool[];
            llm: {
                provider: string;
                model: string;
                temperature?: number;
                maxTokens?: number;
            };
            maxCalls?: number;
            requireApproval?: boolean;
            timeout?: number;
        }): Agent;
    };
    team: {
        create: (config: TeamConfig) => Promise<any>;
    };
    pipeline: {
        create: (config: PipelineConfig) => Promise<any>;
    };
} 