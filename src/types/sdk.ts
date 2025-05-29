// Service base configuration
export interface ServiceBaseConfig {
    name: string;
    description: string;
    version?: string;
    enabled?: boolean;
    executeStream?: (input: { task: string } & Record<string, any>) => AsyncGenerator<any>;
}

// Tool types
export interface ToolConfig {
    name: string;
    description?: string;
    type: string;
    apiKey?: string;
    timeout?: number;
    retryCount?: number;
    maxSize?: number;
    config: Record<string, any>;
    inputs?: string[];
    outputs?: string[];
    capabilities?: string[];
    handler?: (params: any) => Promise<ToolResult<any>>;
}

export interface ToolResult<T = any> {
    success: boolean;
    result?: T;
    error?: string;
    metrics?: {
        duration: number;
        startTime: number;
        endTime: number;
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
export type LLMConfig = {
    model: string;
    apiKey?: string;
    provider?: string;
} | string;

export interface AgentConfig {
    name: string;
    description: string;
    systemPrompt?: string;
    task: string;
    tools: string[];
    capabilities?: string[];
    llm: LLMConfig;
    thresholds?: {
        fastPath?: number;
        confidence?: number;
        performance?: number;
    };
    maxCalls?: number;
    requireApproval?: boolean;
    timeout?: number;
    handler?: (params: any) => Promise<ToolResult<any>>;
    memory?: MemoryConfig;
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
export interface TeamConfig {
    name: string;
    description: string;
    agents: Array<string | AgentConfig>;
    capabilities?: string[];
    manager?: boolean;
    strategy?: TeamStrategy;
    delegationStrategy?: DelegationStrategy;
    log?: {
        inputs?: boolean;
        outputs?: boolean;
        metrics?: boolean;
    };
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
    ERROR = 'error',
    NORMAL = 'info',    // Alias for INFO
    VERBOSE = 'debug'   // Alias for DEBUG
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
export interface PipelineConfig {
    name: string;
    description?: string;
    steps: PipelineStep[];
    onError?: (error: Error, context: { step: PipelineStep; input: any; results: Map<string, any> }) => Promise<{ retry: boolean; delay?: number }>;
    errorStrategy?: {
        type: 'stop' | 'continue' | 'retry';
        maxAttempts?: number;
        delay?: number;
    };
    metrics?: {
        enabled: boolean;
        detailed: boolean;
        trackMemory: boolean;
    };
}

export interface PipelineStep {
    name: string;
    type: 'tool' | 'agent' | 'team';
    tool?: string | ToolConfig;
    agent?: string;
    team?: string;
    input?: { step: string; field: string }[];
    config?: Record<string, any>;
    retryConfig?: {
        maxAttempts: number;
        delay: number;
    };
    retry?: RetryConfig;
    chained?: number;
    expects?: Record<string, string>;
    outputs?: Record<string, string>;
    conditions?: {
        requiredFields?: string[];
        validateOutput?: (output: any) => boolean;
        customValidation?: (context: any) => Promise<boolean>;
    };
    inputMap?: ((input: any) => Promise<any>) | Record<string, any>;
    handler?: (params: any) => Promise<ToolResult<any>>;
}

// Component types
export interface Agent {
    name: string;
    description: string;
    systemPrompt?: string;
    tools: string[];
    state: ToolLifecycleState;
    run(task: string): Promise<AgentResult>;
}

export interface Tool<P = any, R = any> {
    name: string;
    description: string;
    state: ToolLifecycleState;
    run(params: P): Promise<ToolResult<R>>;
}

export interface Team {
    name: string;
    description: string;
    state: ToolLifecycleState;
    agents: string[];
    run(input: any): Promise<any>;
}

export interface Pipeline {
    name: string;
    description: string;
    state: ToolLifecycleState;
    steps: PipelineStep[];
    run(input: any): Promise<any>;
}

// Result types
export interface AgentResult<T = any> {
    success: boolean;
    result?: T;
    error?: string;
    metrics?: {
        duration: number;
        startTime: number;
        endTime: number;
        toolCalls: number;
        confidence?: number;
        performance?: number;
        llmUsage?: {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
            model: string;
        };
    };
}

export interface TeamResult<T = any> {
    success: boolean;
    result?: T;
    error?: string;
    metrics?: {
        duration: number;
        startTime: number;
        endTime: number;
        agentCalls: number;
    };
}

export interface PipelineStepResult {
    stepId: string;
    success: boolean;
    result?: any;
    error?: string;
    outputs?: Record<string, any>;
    startTime: number;
    endTime: number;
    duration: number;
    retryCount: number;
    failureAnalysis?: {
        errorCategory: 'transient' | 'persistent' | 'critical' | 'resource' | 'timeout';
        severity: 'low' | 'medium' | 'high' | 'critical';
        isRetryable: boolean;
        suggestedAction: 'retry' | 'skip' | 'fallback' | 'abort';
        confidence: number;
        reasoning: string;
    };
    circuitBreakerTripped?: boolean;
}

export interface PipelineResult<T = any> {
    success: boolean;
    result?: T;
    error?: string;
    metrics?: {
        duration: number;
        startTime: number;
        endTime: number;
        stepResults: Record<string, any>;
        intelligence?: {
            bottlenecksIdentified: number;
            optimizationRecommendations: number;
            estimatedImprovement: number;
        };
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

export enum ToolLifecycleState {
    PENDING = 'PENDING',
    INITIALIZING = 'INITIALIZING',
    READY = 'READY',
    ERROR = 'ERROR',
    DEGRADED = 'DEGRADED'
}

export interface HealthStatus {
    status: ToolLifecycleState;
    message?: string;
    details?: Record<string, any>;
    timestamp: number;
    degraded: boolean;
    dependencies: {
        name: string;
        status: ToolLifecycleState;
        required: boolean;
    }[];
}

export interface ToolLifecycle {
    id: string;
    state: ToolLifecycleState;
    dependencies: string[];
    capabilities: string[];
    healthCheck(): Promise<HealthStatus>;
    validateDependencies(): Promise<boolean>;
    initialize(): Promise<void>;
}

export interface ToolStateEvent {
    toolId: string;
    previousState: ToolLifecycleState;
    newState: ToolLifecycleState;
    timestamp: number;
    metadata?: Record<string, any>;
}

export interface ToolEventHandler {
    (event: ToolStateEvent): Promise<void> | void;
}

// Tool chaining types
export interface ToolChainStep {
    id: string;
    tool: string;
    semantic_number: string; // e.g., "1", "2.1", "2.2", "3"
    input_mapping?: Record<string, string>; // Maps input params to previous step outputs
    static_params?: Record<string, any>; // Static parameters for this step
    condition?: (context: ChainContext) => boolean; // Optional conditional execution
    parallel_group?: string; // Group ID for parallel execution
    depends_on?: string[]; // List of step IDs this step depends on
}

export interface ToolChain {
    id: string;
    name: string;
    description: string;
    steps: ToolChainStep[];
    input_schema?: Record<string, any>; // Expected input parameters
    output_mapping?: Record<string, string>; // Maps final outputs
}

export interface ChainContext {
    input: Record<string, any>; // Initial chain input
    stepResults: Map<string, ToolResult>; // Results from each step
    chainId: string;
    executionId: string;
    startTime: number;
    currentStep?: ToolChainStep;
}

export interface ChainExecutionResult {
    success: boolean;
    result?: any;
    error?: string;
    context: ChainContext;
    metrics: {
        totalDuration: number;
        stepCount: number;
        parallelGroups: number;
        failedSteps: string[];
        completedSteps: string[];
        stepTimings: Record<string, number>;
    };
}

export interface ChainExecutorConfig {
    maxParallelSteps: number;
    stepTimeoutMs: number;
    retryFailedSteps: boolean;
    continueOnStepFailure: boolean;
    logLevel: 'minimal' | 'detailed' | 'verbose';
} 