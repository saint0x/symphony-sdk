import { AgentConfig, ToolResult } from '../types/sdk';
import { IContextAPI } from '../api/IContextAPI';
import { LLMHandler } from '../llm/handler';
import { ToolRegistry } from '../tools/standard/registry';
import { Logger } from '../utils/logger';

// ==========================================
// CORE RUNTIME TYPES
// ==========================================

export interface RuntimeResult {
  success: boolean;
  mode: RuntimeExecutionMode;
  conversation?: ConversationJSON;
  executionDetails: ExecutionDetails;
  plan?: ExecutionPlan;
  reflections?: Reflection[];
  error?: string;
  metrics: RuntimeMetrics;
}

export type RuntimeExecutionMode = 
  | 'legacy'
  | 'legacy_with_conversation' 
  | 'enhanced_planning'
  | 'adaptive_reflection';

export interface RuntimeMetrics {
  totalDuration: number;
  startTime: number;
  endTime: number;
  stepCount: number;
  toolCalls: number;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  reflectionCount: number;
  adaptationCount: number;
}

// ==========================================
// EXECUTION CONTEXT & STATE
// ==========================================

export interface RuntimeContext {
  readonly sessionId: string;
  readonly agentConfig: AgentConfig;
  readonly createdAt: number;
  
  // Execution state
  currentPlan?: ExecutionPlan;
  executionHistory: ExecutionStep[];
  workingMemory: Map<string, any>;
  insights: Insight[];
  errorHistory: RuntimeError[];
  
  // Context management
  currentStep: number;
  totalSteps: number;
  remainingSteps?: PlannedStep[];
  
  // Methods
  setExecutionPlan(plan: ExecutionPlan): void;
  updateExecutionPlan(plan: ExecutionPlan): void;
  addExecutionStep(step: Omit<ExecutionStep, 'stepId' | 'startTime' | 'endTime' | 'duration'>): ExecutionStep;
  addInsight(insight: Insight): void;
  addReflection(reflection: Reflection): void;
  getReflections(): Reflection[];
  toSnapshot(): RuntimeSnapshot;
}

export interface RuntimeSnapshot {
  sessionId: string;
  currentStep: number;
  totalSteps: number;
  executionHistory: ExecutionStep[];
  insights: Insight[];
  timestamp: number;
}

// ==========================================
// PLANNING & EXECUTION
// ==========================================

export interface ExecutionPlan {
  readonly id: string;
  readonly taskDescription: string;
  readonly steps: PlannedStep[];
  readonly confidence: number;
}

export interface PlannedStep {
  readonly id: string;
  readonly description: string;
  readonly toolName: string;
  readonly parameters: Record<string, any>;
  readonly successCriteria: string;
}

export interface ExecutionStep {
  readonly stepId: string;
  readonly description: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly duration: number;
  readonly success: boolean;
  readonly toolUsed?: string;
  readonly parameters?: Record<string, any>;
  readonly result?: any;
  readonly error?: string;
  readonly reflection?: Reflection;
  
  summary: string;
}

export interface TaskAnalysis {
  complexity: TaskComplexity;
  requiresPlanning: boolean;
  reasoning: string;
}

export type TaskComplexity = 'simple' | 'multi_step' | 'complex';

// ==========================================
// ACTION & INTENT SYSTEM
// ==========================================

export interface ActionIntent {
  readonly id: string;
  readonly description: string;
  readonly type: ActionType;
  readonly priority: number;
  readonly startTime: number;
  readonly context: Record<string, any>;
}

export type ActionType = 
  | 'search' 
  | 'analyze' 
  | 'create' 
  | 'transform' 
  | 'communicate'
  | 'validate'
  | 'other';

export interface ActionResult {
  readonly id: string;
  readonly actionIntent: ActionIntent;
  readonly success: boolean;
  readonly duration: number;
  readonly toolUsed?: string;
  readonly parameters?: Record<string, any>;
  readonly data?: any;
  readonly error?: string;
  readonly confidence: number;
  readonly startTime: number;
  readonly endTime: number;
}

// ==========================================
// CONVERSATION SYSTEM
// ==========================================

export interface Conversation {
  readonly id: string;
  readonly originalTask: string;
  readonly sessionId: string;
  readonly createdAt: number;
  
  turns: ConversationTurn[];
  currentState: ConversationState;
  
  addTurn(role: 'user' | 'assistant', content: string, metadata?: ConversationMetadata): ConversationTurn;
  getRecentTurns(count: number): ConversationTurn[];
  getFinalResponse(): string | undefined;
  getReasoningChain(): string[];
  getFlowSummary(): string;
  getCurrentState(): ConversationState;
  toJSON(): ConversationJSON;
}

export interface ConversationTurn {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly timestamp: number;
  readonly metadata?: ConversationMetadata;
}

export interface ConversationMetadata {
  stepId?: string;
  toolUsed?: string;
  actionType?: ActionType;
  confidence?: number;
  reflection?: boolean;
}

export type ConversationState = 
  | 'initiated'
  | 'working' 
  | 'reflecting'
  | 'adapting'
  | 'concluding'
  | 'completed'
  | 'error';

export interface ConversationJSON {
  id: string;
  originalTask: string;
  turns: ConversationTurn[];
  finalResponse: string;
  reasoningChain: string[];
  duration: number;
  state: ConversationState;
}

// ==========================================
// REFLECTION & ADAPTATION
// ==========================================

export interface Reflection {
  readonly id: string;
  readonly stepId: string;
  readonly assessment: ReflectionAssessment;
  readonly suggestedAction: 'continue' | 'retry' | 'abort' | 'modify_plan';
  readonly reasoning: string;
  readonly confidence: number;
  readonly timestamp: number;
}

export interface ReflectionAssessment {
  performance: 'excellent' | 'good' | 'acceptable' | 'poor';
  quality: 'optimal' | 'good' | 'suboptimal' | 'wrong';
  suggestedImprovements?: string[];
}

export interface ExecutionAdaptation {
  readonly type: AdaptationType;
  readonly specificChanges: string[];
  readonly planModifications: string[];
  readonly conversationAdjustments: string[];
  readonly confidenceBoostActions: string[];
  readonly estimatedImpact: 'positive' | 'neutral' | 'risky';
  readonly requiresReplanning: boolean;
}

export type AdaptationType = 
  | 'continue'
  | 'modify_approach' 
  | 'change_tools' 
  | 'replanning_needed';

export interface Insight {
  readonly id: string;
  readonly type: InsightType;
  readonly description: string;
  readonly confidence: number;
  readonly source: string;
  readonly timestamp: number;
  readonly actionable: boolean;
}

export type InsightType = 
  | 'pattern_recognition'
  | 'performance_optimization'
  | 'error_prevention'
  | 'strategy_improvement'
  | 'context_learning';

// ==========================================
// ERROR HANDLING
// ==========================================

export interface RuntimeError {
  readonly id: string;
  readonly type: RuntimeErrorType;
  readonly message: string;
  readonly stepId?: string;
  readonly toolName?: string;
  readonly timestamp: number;
  readonly context: Record<string, any>;
  readonly recoverable: boolean;
}

export type RuntimeErrorType = 
  | 'tool_execution'
  | 'planning_failure'
  | 'conversation_error'
  | 'reflection_error'
  | 'context_error'
  | 'system_error';

export interface FallbackStrategy {
  readonly id: string;
  readonly description: string;
  readonly triggerCondition: string;
  readonly actions: string[];
  readonly confidence: number;
}

// ==========================================
// ENGINE INTERFACES
// ==========================================

export interface RuntimeEngine {
  initialize(): Promise<void>;
  getDependencies(): string[];
  getState(): string;
  healthCheck(): Promise<boolean>;
}

export interface ExecutionEngineInterface extends RuntimeEngine {
  execute(task: string, context: RuntimeContext): Promise<ToolResult>;
}

export interface ConversationEngineInterface extends RuntimeEngine {
  initiate(task: string, context: RuntimeContext): Promise<Conversation>;
  run(conversation: Conversation, context: RuntimeContext): Promise<Conversation>;
  conclude(conversation: Conversation, context: RuntimeContext): Promise<Conversation>;
}

export interface PlanningEngineInterface extends RuntimeEngine {
  analyzeTask(task: string, context: RuntimeContext): Promise<TaskAnalysis>;
  createExecutionPlan(task: string, context: RuntimeContext): Promise<ExecutionPlan>;
}

export interface ReflectionEngineInterface extends RuntimeEngine {
  reflect(stepResult: ExecutionStep, context: RuntimeContext, conversation: Conversation): Promise<Reflection>;
}

// ==========================================
// RUNTIME CONFIGURATION
// ==========================================

export interface RuntimeConfiguration {
  enhancedRuntime: boolean;
  planningThreshold: TaskComplexity;
  reflectionEnabled: boolean;
  maxStepsPerPlan: number;
  timeoutMs: number;
  retryAttempts: number;
  debugMode: boolean;
}

export interface RuntimeDependencies {
  toolRegistry: ToolRegistry;
  contextAPI: IContextAPI;
  llmHandler: LLMHandler;
  logger: Logger;
}

// ==========================================
// UTILITY TYPES
// ==========================================

export interface ExecutionDetails {
  mode: RuntimeExecutionMode;
  stepResults: ExecutionStep[];
  participatingAgents?: string[];
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  adaptations: ExecutionAdaptation[];
}

export type RuntimeStatus = 'initializing' | 'ready' | 'executing' | 'error' | 'shutdown';

// ==========================================
// FACTORY TYPES
// ==========================================

export interface RuntimeFactory {
  createRuntime(dependencies: RuntimeDependencies, config?: Partial<RuntimeConfiguration>): Promise<SymphonyRuntimeInterface>;
  createContext(agentConfig: AgentConfig, sessionId?: string): Promise<RuntimeContext>;
}

export interface SymphonyRuntimeInterface {
  initialize(): Promise<void>;
  execute(task: string, agentConfig: AgentConfig): Promise<RuntimeResult>;
  shutdown(): Promise<void>;
  getStatus(): RuntimeStatus;
  getMetrics(): RuntimeMetrics;
  healthCheck(): Promise<boolean>;
} 