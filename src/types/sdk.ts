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
    handler: (params: any) => Promise<ToolResult<any>>;
    timeout?: number;
    retry?: RetryConfig;
    cache?: CacheConfig;
    validation?: ValidationConfig;
    monitoring?: MonitoringConfig;
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
    capabilities: string[];
    handler: (params: any) => Promise<ToolResult<any>>;
}

export interface LLMConfig {
    provider: 'openai' | 'anthropic' | 'google';
    apiKey: string;
    model: string;
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
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
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
    validation?: ValidationConfig;
    metrics: {
        enabled: boolean;
        detailed: boolean;
        trackMemory: boolean;
    };
}

export interface PipelineStep {
    id: string;
    name: string;
    description: string;
    tool: string | ToolConfig;
    inputs: any;
    handler: (params: any) => Promise<ToolResult<any>>;
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

// Component types
export interface Agent {
    id: string;
    name: string;
    description: string;
    task: string;
    tools: Array<string | ToolConfig>;
    run(task: string, options?: AgentOptions): Promise<AgentResult>;
}

export interface Tool {
    id: string;
    name: string;
    description: string;
    run(params: any): Promise<ToolResult<any>>;
}

export interface Team {
    id: string;
    name: string;
    description: string;
    agents: Array<string | AgentConfig>;
    run(task: string, options?: TeamOptions): Promise<TeamResult>;
}

export interface Pipeline {
    id: string;
    name: string;
    description: string;
    steps: PipelineStep[];
    run(input: any, options?: PipelineOptions): Promise<PipelineResult>;
}

// Result types
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

export interface TeamResult {
    success: boolean;
    result: any;
    error?: Error;
    metrics?: {
        duration: number;
        startTime: number;
        endTime: number;
        agentCalls: number;
        [key: string]: any;
    };
}

export interface PipelineResult {
    success: boolean;
    result: any;
    error?: Error;
    metrics?: {
        duration: number;
        startTime: number;
        endTime: number;
        stepResults: {
            [key: string]: any;
        };
        [key: string]: any;
    };
}

// Option types
export interface AgentOptions {
    onProgress?: (update: { status: string; result?: any }) => void;
    onMetrics?: (metrics: { [key: string]: any }) => void;
    timeout?: number;
}

export interface TeamOptions {
    onProgress?: (update: { status: string; agent?: string; result?: any }) => void;
    onMetrics?: (metrics: { [key: string]: any }) => void;
    timeout?: number;
}

export interface PipelineOptions {
    onStepComplete?: (step: PipelineStep, result: any) => void;
    onMetrics?: (metrics: { [key: string]: any }) => void;
    timeout?: number;
} 