import { TeamResult } from '../teams';

// Core pipeline types and interfaces
export interface PipelineResult<T = any> {
  result: T;
  success: boolean;
  error?: Error;
  metrics?: {
    duration: number;
    stageMetrics: Record<string, TeamResult>;
    throughput: number;
  };
}

export interface PipelineContext {
  pipelineId: string;
  projectId: string;
  parentId?: string;
  metadata: Record<string, any>;
  globalState?: Record<string, any>;
}

export interface PipelineStage {
  name: string;
  description: string;
  team: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  conditions?: Record<string, any>;
}

export interface PipelineExecutor {
  execute<T = any>(input: Record<string, any>, context?: PipelineContext): Promise<PipelineResult<T>>;
  addStage(stage: PipelineStage): void;
  removeStage(stageName: string): void;
  getStages(): PipelineStage[];
}