/**
 * Symphony SDK Core API Definitions
 * 
 * This file contains the complete public API definitions for Symphony's core orchestration
 * capabilities including Tools, Agents, Teams, and Pipelines.
 */

// ===== CORE SYMPHONY CLASS =====

export interface SymphonyConfig {
  llm: {
    provider: 'openai' | 'anthropic' | 'groq';
    model: string;
    apiKey?: string;
    temperature?: number;
    maxTokens?: number;
  };
  db?: {
    enabled: boolean;
    adapter: 'sqlite' | 'postgres' | 'mysql';
    path?: string;
    connectionString?: string;
  };
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface ISymphony {
  // Core services
  readonly tool: IToolService;
  readonly agent: IAgentService;
  readonly team: ITeamService;
  readonly pipeline: IPipelineService;
  readonly cache: any; // ICacheService - imported from cache-memory-api
  readonly memory: any; // IMemoryService - imported from cache-memory-api
  readonly streaming: IStreamingService;
  readonly db: any; // IDatabaseService - imported from cache-memory-api
  readonly metrics: IMetricsAPI;
  readonly logger: ILogger;

  // Lifecycle
  initialize(): Promise<void>;
  getState(): ToolLifecycleState;
  getDependencies(): string[];
  getConfig(): SymphonyConfig;
  updateConfig(config: Partial<SymphonyConfig>): void;
}

export enum ToolLifecycleState {
  PENDING = 'PENDING',
  INITIALIZING = 'INITIALIZING', 
  READY = 'READY',
  ERROR = 'ERROR',
  DEGRADED = 'DEGRADED'
}

// ===== TOOLS API =====

export interface IToolService {
  create(config: ToolConfig): Promise<Tool>;
  initialize(): Promise<void>;
}

export interface ToolConfig {
  name: string;
  description: string;
  inputs: string[];
  outputs?: string[];
  handler: (params: any) => Promise<ToolResult>;
  
  // Advanced configuration
  timeout?: number;
  retry?: RetryConfig;
  cache?: CacheConfig;
  validation?: ValidationConfig;
  monitoring?: MonitoringConfig;
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

export interface Tool {
  name: string;
  description: string;
  state: ToolLifecycleState;
  run(params: any): Promise<ToolResult>;
}

export interface ToolResult<T = any> {
  success: boolean;
  result?: T;
  error?: string;
  metrics?: ExecutionMetrics;
}

export interface ExecutionMetrics {
  duration: number;
  startTime: number;
  endTime: number;
  stages?: Record<string, number>;
  operations?: Record<string, number>;
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
}

// Standard tool names available in Symphony
export type StandardToolName = 
  | 'readFile'
  | 'writeFile'
  | 'webSearch'
  | 'parseDocument'
  | 'writeCode'
  | 'createPlan'
  | 'ponder';

export interface IToolRegistry {
  getInstance(): IToolRegistry;
  getAvailableTools(): string[];
  getToolInfo(toolName: string): ToolConfig | null;
  executeTool(toolName: string, params: any): Promise<ToolResult>;
  registerTool(name: string, tool: ToolConfig): void;
}

// ===== AGENTS API =====

export interface IAgentService {
  create(config: AgentConfig): Promise<Agent>;
  initialize(): Promise<void>;
}

export interface AgentConfig {
  name: string;
  description: string;
  task: string;
  tools: (StandardToolName | string)[];
  llm: LLMConfig;
  
  // Optional configuration
  directives?: string;
  maxCalls?: number;
  requireApproval?: boolean;
  timeout?: number;
  capabilities?: string[];
  systemPrompt?: string;
  thresholds?: {
    fastPath?: number;
    confidence?: number;
    performance?: number;
  };
  memory?: any; // MemoryConfig - imported from cache-memory-api
}

export type LLMConfig = {
  provider: 'openai' | 'anthropic' | 'groq';
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
} | string; // Can be just model name

export interface Agent {
  name: string;
  description: string;
  systemPrompt?: string;
  tools: string[];
  state: ToolLifecycleState;
  
  // Core methods
  run(task: string, options?: AgentOptions): Promise<AgentResult>;
  selectTool?(task: string): Promise<ToolSelectionResult>;
  
  // Advanced access
  executor?: any; // AgentExecutor for advanced usage
}

export interface AgentOptions {
  onProgress?: (update: { status: string; result?: any }) => void;
  onMetrics?: (metrics: Record<string, any>) => void;
  timeout?: number;
}

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

export interface ToolSelectionResult {
  toolName: string;
  confidence: number;
  reasoning: string;
}

// ===== TEAMS API =====

export interface ITeamService {
  create(config: TeamConfig): Promise<Team>;
  initialize(): Promise<void>;
}

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

export enum TeamExecutionStrategy {
  PARALLEL = 'parallel',
  SEQUENTIAL = 'sequential',
  PIPELINE = 'pipeline',
  COLLABORATIVE = 'collaborative',
  ROLE_BASED = 'role_based'
}

export interface Team {
  name: string;
  description: string;
  state: ToolLifecycleState;
  agents: string[];
  
  // Core methods
  run(task: string, options?: TeamOptions): Promise<TeamResult>;
  getStatus(): TeamStatus;
  getContext(): TeamContext;
  
  // Advanced access
  coordinator?: any; // TeamCoordinator for advanced usage
}

export interface TeamOptions {
  strategy?: TeamExecutionStrategy;
  priority?: number;
  timeout?: number;
  requiredCapabilities?: string[];
  onProgress?: (update: { status: string; agent?: string; result?: any }) => void;
  onMetrics?: (metrics: Record<string, any>) => void;
}

export interface TeamResult {
  success: boolean;
  result?: {
    task: string;
    strategy: string;
    executionDetails: any;
    sharedContext: any;
    participatingAgents: string[];
  };
  error?: string;
  metrics?: {
    duration: number;
    startTime: number;
    endTime: number;
    agentCalls: number;
  };
}

export interface TeamStatus {
  teamId: string;
  name: string;
  memberCount: number;
  activeMembers: number;
  taskQueue: number;
  activeExecutions: number;
  lastActivity: number;
  coordinationStrategy: string;
}

export interface TeamContext {
  // Team identification
  teamId: string;
  teamName: string;
  
  // Current state
  currentTask?: string;
  executionPhase: 'idle' | 'planning' | 'executing' | 'coordinating' | 'completing';
  activeStrategy?: TeamExecutionStrategy;
  
  // Member intelligence
  members: {
    available: Array<{
      name: string;
      capabilities: string[];
      status: 'idle' | 'busy' | 'error';
      currentLoad: number;
      efficiency: number;
    }>;
    optimal: {
      name: string;
      reason: string;
    } | null;
    workload: {
      balanced: boolean;
      distribution: Record<string, number>;
    };
  };
  
  // Task intelligence
  tasks: {
    active: number;
    queued: number;
    completed: number;
    recentHistory: Array<{
      task: string;
      strategy: string;
      duration: number;
      success: boolean;
      participatingAgents: string[];
    }>;
  };
  
  // Shared knowledge
  workspace: {
    sharedData: Record<string, any>;
    recentCommunications: Array<{
      from: string;
      message: string;
      timestamp: number;
      type: string;
    }>;
    knowledgeBase: string[];
  };
  
  // Intelligence insights
  insights: {
    recommendedStrategy: TeamExecutionStrategy;
    strategyReason: string;
    teamEfficiency: number;
    suggestedOptimizations: string[];
    riskFactors: string[];
  };
  
  // Context metadata
  lastUpdated: number;
  contextVersion: string;
}

// ===== PIPELINES API =====

export interface IPipelineService {
  create(config: PipelineConfig): Promise<Pipeline>;
  initialize(): Promise<void>;
}

export interface PipelineConfig {
  name: string;
  description?: string;
  version?: string;
  steps: PipelineStepDefinition[];
  variables?: Record<string, any>;
  errorHandling?: PipelineErrorHandling;
  concurrency?: PipelineConcurrency;
  onError?: (error: Error, context: PipelineContext) => Promise<{ retry: boolean; delay?: number }>;
  metrics?: {
    enabled: boolean;
    detailed: boolean;
    trackMemory: boolean;
  };
}

export interface PipelineStepDefinition {
  id: string;
  name: string;
  type: 'tool' | 'chain' | 'condition' | 'transform' | 'parallel' | 'wait';
  
  // Tool step
  tool?: string;
  
  // Chain step
  chain?: ToolChain;
  
  // Condition step
  condition?: {
    expression: string;
    ifTrue: string;
    ifFalse?: string;
  };
  
  // Transform step
  transform?: {
    input: string;
    output: string;
    transformation: string;
  };
  
  // Parallel step
  parallel?: {
    steps: string[];
    waitForAll: boolean;
  };
  
  // Wait step
  wait?: {
    duration: number;
    condition?: string;
  };
  
  // Common properties
  inputs?: Record<string, string>;
  outputs?: Record<string, string>;
  dependencies?: string[];
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
    retryOn: string[];
  };
  timeout?: number;
  continueOnError?: boolean;
}

export interface PipelineErrorHandling {
  strategy: 'stop' | 'continue' | 'retry' | 'fallback';
  fallbackPipeline?: string;
  maxGlobalRetries: number;
}

export interface PipelineConcurrency {
  maxParallelSteps: number;
  resourceLimits: Record<string, number>;
}

export interface Pipeline {
  name: string;
  description: string;
  state: ToolLifecycleState;
  steps: PipelineStepDefinition[];
  
  // Core methods
  run(input?: any): Promise<PipelineResult>;
  getStatus(): PipelineStatus;
  
  // Advanced access
  executor?: IPipelineExecutor;
}

export interface PipelineResult {
  success: boolean;
  result?: {
    pipelineId: string;
    executionId: string;
    status: string;
    steps: PipelineStepResult[];
    output: any;
    context: any;
    performanceProfile?: PipelinePerformanceProfile;
  };
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
  failureAnalysis?: FailureAnalysis;
  circuitBreakerTripped?: boolean;
}

export interface FailureAnalysis {
  stepId: string;
  errorCategory: 'transient' | 'persistent' | 'critical' | 'resource' | 'timeout';
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRetryable: boolean;
  suggestedAction: 'retry' | 'skip' | 'fallback' | 'abort';
  confidence: number;
  reasoning: string;
}

export interface PipelineStatus {
  pipelineId: string;
  name: string;
  status: string;
  progress: {
    currentStep: number;
    totalSteps: number;
    percentage: number;
  };
  stepResults: PipelineStepResult[];
  errorHistory: Array<{
    step: string;
    error: string;
    timestamp: number;
    retryAttempt: number;
  }>;
  activeSteps: number;
  intelligence?: {
    performanceProfile?: {
      totalDuration: number;
      bottleneckCount: number;
      trends: any;
      estimatedImprovement: number;
    };
    optimizationRecommendations: OptimizationRecommendation[];
    health: any;
    circuitBreakers: Array<{
      stepId: string;
      status: any;
    }>;
  };
}

export interface IPipelineExecutor {
  getPerformanceProfile(): PipelinePerformanceProfile | undefined;
  getOptimizationRecommendations(): OptimizationRecommendation[];
  getCircuitBreakerStatus(stepId: string): any;
  resetCircuitBreaker(stepId: string): void;
  getIntelligenceHealth(): any;
  getPipelineStatus(): PipelineStatus;
}

export interface PipelinePerformanceProfile {
  pipelineId: string;
  totalDuration: number;
  stepMetrics: PerformanceMetrics[];
  bottlenecks: Array<{
    stepId: string;
    type: 'cpu' | 'memory' | 'network' | 'disk' | 'dependency' | 'coordination';
    severity: number;
    impact: number;
    recommendation: string;
  }>;
  optimization: {
    parallelizationOpportunities: string[];
    resourceOptimizations: string[];
    architecturalRecommendations: string[];
    estimatedImprovement: number;
  };
  trends: {
    averageDuration: number;
    successRate: number;
    errorPatterns: Record<string, number>;
    performanceTrend: 'improving' | 'degrading' | 'stable';
  };
}

export interface PerformanceMetrics {
  stepId: string;
  duration: number;
  memoryUsage?: number;
  cpuUsage?: number;
  networkIO?: number;
  diskIO?: number;
  resourceUtilization: Record<string, number>;
  bottleneckFactors: string[];
}

export interface OptimizationRecommendation {
  category: 'parallelization' | 'resource' | 'architecture' | 'configuration';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  implementation: string;
  estimatedImprovement: number;
  effort: 'minimal' | 'moderate' | 'significant';
  impact: 'performance' | 'reliability' | 'cost' | 'scalability';
}

export interface PipelineContext {
  pipelineId: string;
  executionId: string;
  variables: Map<string, any>;
  stepResults: Map<string, PipelineStepResult>;
  globalState: Record<string, any>;
  metadata: {
    startTime: number;
    currentStep: number;
    totalSteps: number;
    retryCount: number;
    errorHistory: Array<{
      step: string;
      error: string;
      timestamp: number;
      retryAttempt: number;
    }>;
  };
}

// ===== TOOL CHAINING API =====

export interface ToolChain {
  id: string;
  name: string;
  description: string;
  steps: ToolChainStep[];
  input_schema?: Record<string, any>;
  output_mapping?: Record<string, string>;
}

export interface ToolChainStep {
  id: string;
  tool: string;
  semantic_number: string; // e.g., "1", "2.1", "2.2", "3"
  input_mapping?: Record<string, string>;
  static_params?: Record<string, any>;
  condition?: (context: ChainContext) => boolean;
  parallel_group?: string;
  depends_on?: string[];
}

export interface ChainContext {
  input: Record<string, any>;
  stepResults: Map<string, ToolResult>;
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

export interface IChainExecutor {
  getInstance(): IChainExecutor;
  executeChain(chain: ToolChain, input?: Record<string, any>): Promise<ChainExecutionResult>;
  updateConfig(config: Partial<ChainExecutorConfig>): void;
}

export interface ChainExecutorConfig {
  maxParallelSteps: number;
  stepTimeoutMs: number;
  retryFailedSteps: boolean;
  continueOnStepFailure: boolean;
  logLevel: 'minimal' | 'detailed' | 'verbose';
}

// ===== STREAMING API =====

export interface IStreamingService {
  // Stream lifecycle management
  createStream(options: StreamOptions): string;
  updateProgress(streamId: string, progress: Partial<ProgressUpdate>): void;
  completeStream(streamId: string, finalData?: any): void;
  errorStream(streamId: string, error: Error): void;
  
  // Subscription management
  subscribe(streamId: string, callback: (update: ProgressUpdate) => void): () => void;
  
  // Utility methods
  getActiveStreams(): string[];
  getStreamStatus(streamId: string): any;
  getStats(): StreamingStats;
  healthCheck(): Promise<any>;
  initialize(config?: StreamingConfig): Promise<void>;
}

export interface StreamOptions {
  type: 'agent' | 'team' | 'pipeline' | 'tool' | 'chain';
  context: {
    id: string;
    name: string;
    description?: string;
  };
  options?: {
    bufferSize?: number;
    updateInterval?: number;
  };
}

export interface ProgressUpdate {
  streamId: string;
  type: 'progress' | 'status' | 'data' | 'complete' | 'error';
  timestamp: number;
  progress?: number; // 0-100
  status?: string;
  data?: any;
  error?: Error;
  context?: any;
}

export interface StreamingStats {
  totalStreams: number;
  activeStreams: number;
  completedStreams: number;
  errorStreams: number;
  totalMessages: number;
  averageDuration: number;
  peakConcurrency: number;
  memoryUsage: number;
}

export interface StreamingConfig {
  maxConcurrentStreams?: number;
  defaultBufferSize?: number;
  defaultUpdateInterval?: number;
  cleanupInterval?: number;
}

// ===== SHARED INTERFACES =====

export interface IMetricsAPI {
  readonly startTime: number;
  start(id: string, metadata?: Record<string, any>): void;
  end(id: string, metadata?: Record<string, any>): void;
  get(id: string): any;
  update(id: string, metadata: Record<string, any>): void;
  getAll(): Record<string, any>;
}

export interface ILogger {
  info(category: string, message: string, data?: any): void;
  warn(category: string, message: string, data?: any): void;
  error(category: string, message: string, data?: any): void;
  debug(category: string, message: string, data?: any): void;
}

// ===== MAIN SYMPHONY CLASS =====

export declare class Symphony implements ISymphony {
  readonly tool: IToolService;
  readonly agent: IAgentService;
  readonly team: ITeamService;
  readonly pipeline: IPipelineService;
  readonly cache: any; // ICacheService - imported from cache-memory-api
  readonly memory: any; // IMemoryService - imported from cache-memory-api
  readonly streaming: IStreamingService;
  readonly db: any; // IDatabaseService - imported from cache-memory-api
  readonly metrics: IMetricsAPI;
  readonly logger: ILogger;

  constructor(config: SymphonyConfig);

  initialize(): Promise<void>;
  getState(): ToolLifecycleState;
  getDependencies(): string[];
  getConfig(): SymphonyConfig;
  updateConfig(config: Partial<SymphonyConfig>): void;
} 