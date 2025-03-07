// Service base configuration
export interface ServiceBaseConfig {
    name: string;
    description: string;
    executeStream?: (input: { task: string } & Record<string, any>) => AsyncGenerator<any>;
}

// Tool types
export interface ToolConfig extends ServiceBaseConfig {
    inputs: string[];
    outputs?: string[];
    chained?: number;
    handler: (params: any) => Promise<ToolResult>;
    timeout?: number;
    retry?: RetryConfig;
    cache?: CacheConfig;
    validation?: ValidationConfig;
    monitoring?: MonitoringConfig;
}

export interface ToolResult {
    success: boolean;
    result?: any;
    error?: Error;
    metrics?: ExecutionMetrics;
}

export interface RetryConfig {
    enabled: boolean;
    maxAttempts?: number;
    delay?: number;
    backoffFactor?: number;
    retryableErrors?: string[];
}

export interface CacheConfig {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    keyGenerator?: (params: any) => string;
}

export interface ValidationConfig {
    schema: {
        [key: string]: {
            type: string;
            required?: boolean;
            enum?: any[];
            maxLength?: number;
            properties?: Record<string, any>;
        };
    };
}

export interface MonitoringConfig {
    collectMetrics: boolean;
    logLevel: 'silent' | 'info' | 'debug' | 'error';
    alertOnFailure: boolean;
    performanceThresholds?: {
        duration?: number;
        memoryUsage?: number;
    };
}

// Agent types
export interface AgentConfig extends ServiceBaseConfig {
    task: string;
    tools: Array<string | ToolConfig>;
    llm: LLMConfig;
    maxCalls?: number;
    requireApproval?: boolean;
    timeout?: number;
    memory?: MemoryConfig;
}

export interface LLMConfig {
    provider: 'openai' | 'anthropic' | 'google';
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}

export interface BaseMemoryConfig {
    type: 'short_term' | 'long_term' | 'episodic';
    capacity?: number;
    ttl?: number;
}

export interface MemoryConfig {
    shortTerm?: BaseMemoryConfig;
    longTerm?: BaseMemoryConfig;
    episodic?: BaseMemoryConfig;
}

// Team types
export interface TeamConfig extends ServiceBaseConfig {
    agents: Array<string | AgentConfig>;
    manager?: boolean;
    strategy?: TeamStrategy;
    delegationStrategy?: DelegationStrategy;
    log?: LogConfig;
    sharedMemory?: MemoryConfig;
}

export interface TeamStrategy {
    name?: string;
    description?: string;
    assignmentLogic?: (task: string, agents: string[]) => Promise<string[]>;
    coordinationRules?: {
        maxParallelTasks?: number;
        taskTimeout?: number;
    };
}

export interface DelegationStrategy {
    type: 'custom' | 'rule-based';
    customLogic?: (task: string, agents: string[]) => Promise<string[]>;
    rules?: Array<{
        condition: string;
        assignTo: string[];
    }>;
}

// Execution metrics
export interface ExecutionMetrics {
    duration: number;
    startTime: number;
    endTime: number;
    stages?: Record<string, number>;
    operations?: Record<string, number>;
    modelVersions?: Record<string, string>;
    tokenUsage?: {
        input: number;
        output: number;
        total: number;
    };
    resourceUsage?: {
        memory: NodeJS.MemoryUsage;
        modelLoads?: Record<string, boolean>;
    };
    failurePoint?: string;
    failureStage?: string;
    errorContext?: Record<string, any>;
}

// Logging types
export enum LogLevel {
    SILENT = 0,
    NORMAL = 1,
    VERBOSE = 2,
    DEBUG = 3,
    ERROR = 4
}

export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    category: string;
    message: string;
    data?: any;
    error?: Error | unknown;
    trace?: string;
    service?: string;
    request_id?: string;
    metadata?: Record<string, any>;
}

export interface LogConfig {
    inputs?: boolean;
    outputs?: boolean;
    performance?: boolean;
    verbose?: boolean;
    metrics?: boolean;
}

// Service types
export interface ServiceResult {
    success: boolean;
    data?: any;
    error?: string;
    metrics?: ExecutionMetrics;
}

export interface PipelineMetadata {
    version?: string;
    owner?: string;
    tags?: string[];
    customData?: Record<string, any>;
}

export interface ErrorStrategy {
    type: 'stop' | 'skip' | 'retry';
    maxRetries?: number;
    fallback?: PipelineStep;
}

// Pipeline types
export interface PipelineConfig extends ServiceBaseConfig {
    steps: PipelineStep[];
    onError?: (error: Error, context: any) => Promise<{ retry: boolean; delay?: number }>;
    errorStrategy?: ErrorStrategy;
    metrics?: {
        enabled: boolean;
        detailed: boolean;
        trackMemory: boolean;
    };
}

export interface PipelineStep {
    name: string;
    tool: string | ToolConfig;
    description: string;
    chained: number;
    expects: Record<string, string>;
    outputs: Record<string, string>;
    inputMap?: ((input: any) => Promise<any>) | Record<string, any>;
    retry?: RetryConfig;
    conditions?: {
        requiredFields?: string[];
        validateOutput?: (output: any) => boolean;
        customValidation?: (context: any) => Promise<boolean>;
    };
} 