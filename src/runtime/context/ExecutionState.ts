import { AgentConfig, ToolResult } from '../../types/sdk';
import { ExecutionPlan, Insight, RuntimeError, ConversationJSON } from '../RuntimeTypes';

/**
 * Represents a clean, serializable snapshot of the entire execution state.
 * This can be used for logging, debugging, and for the Context API to learn from.
 */
export interface ExecutionState {
  readonly sessionId: string;
  readonly agentConfig: AgentConfig;
  readonly plan: ExecutionPlan | null;
  readonly history: ReadonlyArray<ExecutionStateStep>;
  readonly insights: ReadonlyArray<Insight>;
  readonly errors: ReadonlyArray<RuntimeError>;
  readonly conversation: ConversationJSON;
  readonly workingMemory: Record<string, any>;
  readonly status: 'running' | 'succeeded' | 'failed' | 'aborted';
}

/**
 * Represents a single, completed step within the execution history.
 * It is an immutable record of what happened.
 */
export interface ExecutionStateStep {
  readonly stepId: string;
  readonly description: string;
  readonly toolUsed: string | null;
  readonly input: Record<string, any>;
  readonly output: ToolResult;
  readonly success: boolean;
  readonly reflection?: string; // Reasoning from the reflection engine
} 