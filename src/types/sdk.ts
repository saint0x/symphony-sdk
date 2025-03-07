// Tool types
export interface ToolConfig {
    name: string;
    description: string;
    inputs: string[];
    outputs?: string[];
    chained?: number;
    target?: string;
    handler: (params: any) => Promise<{ result: any; success: boolean }>;
    timeout?: number;
    retry?: {
        enabled: boolean;
        maxAttempts?: number;
        delay?: number;
    };
}

export interface ToolResult {
    success: boolean;
    result?: any;
    error?: string;
    metrics?: ExecutionMetrics;
}

// Agent types
export interface AgentConfig {
    name: string;
    description: string;
    task: string;
    tools: string[];
    llm: string;
    logLevel?: LogLevel;
}

export interface AgentResult {
    success: boolean;
    data?: any;
    error?: string;
    metrics?: ExecutionMetrics;
}

// Team types
export interface TeamConfig {
    name: string;
    description?: string;
    agents: string[];
    hierarchy?: TeamHierarchy;
    delegationStrategy?: DelegationStrategy;
    logLevel?: LogLevel;
}

export interface TeamHierarchy {
    leader: string;
    subordinates: {
        [key: string]: string[];
    };
}

export interface DelegationStrategy {
    type: 'round-robin' | 'capability-based' | 'load-balanced';
    rules: DelegationRule[];
}

export interface DelegationRule {
    condition: string;
    assignTo: string[];
}

// Pipeline types
export interface PipelineConfig {
    name: string;
    description?: string;
    steps: PipelineStep[];
    errorStrategy?: ErrorStrategy;
    metadata?: PipelineMetadata;
    logLevel?: LogLevel;
}

export interface PipelineStep {
    name: string;
    tool: string;
    inputMap: (prevOutput: any) => any;
    condition?: (prevOutput: any) => boolean;
    retryStrategy?: RetryConfig;
    logConfig?: LogConfig;
}

export interface ErrorStrategy {
    type: 'stop' | 'skip' | 'retry';
    maxRetries?: number;
    fallback?: PipelineStep;
}

// Execution metrics
export interface ExecutionMetrics {
    duration: number;
    startTime: number;
    endTime: number;
    retries?: number;
    cacheHits?: number;
    tokenUsage?: {
        input: number;
        output: number;
        total: number;
    };
}

// Logging types
export enum LogLevel {
    SILENT = 0,
    NORMAL = 1,
    VERBOSE = 2,
    DEBUG = 3
}

export interface LogConfig {
    inputs?: boolean;
    outputs?: boolean;
    performance?: boolean;
    verbose?: boolean;
}

// Service types
export interface ServiceResult {
    success: boolean;
    data?: any;
    error?: string;
    metrics?: ExecutionMetrics;
}

export interface RetryConfig {
    enabled: boolean;
    maxAttempts?: number;
    delay?: number;
}

export interface PipelineMetadata {
    version?: string;
    owner?: string;
    tags?: string[];
    customData?: Record<string, any>;
} 