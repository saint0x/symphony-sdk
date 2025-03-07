import { AgentResult } from '../agents';

// Core team types and interfaces
export interface TeamResult<T = any> {
  result: T;
  success: boolean;
  error?: Error;
  metrics?: {
    duration: number;
    agentMetrics: Record<string, AgentResult>;
    collaborationScore: number;
  };
}

export interface TeamContext {
  teamId: string;
  projectId: string;
  parentId?: string;
  metadata: Record<string, any>;
  sharedMemory?: Record<string, any>;
}

export interface TeamStrategy {
  name: string;
  description: string;
  assignmentLogic: (task: string, agents: string[]) => Promise<string[]>;
  coordinationRules: Record<string, any>;
}

export interface TeamExecutor {
  execute<T = any>(task: string, context?: TeamContext): Promise<TeamResult<T>>;
  addAgent(agentId: string): void;
  removeAgent(agentId: string): void;
  setStrategy(strategy: TeamStrategy): void;
}