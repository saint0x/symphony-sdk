// Core tool types and interfaces
export interface ToolResult<T = any> {
  result: T;
  success: boolean;
  error?: Error;
  metrics?: {
    duration: number;
    startTime: number;
    endTime: number;
  };
}

export interface ToolContext {
  toolId: string;
  runId: string;
  parentId?: string;
  metadata: Record<string, any>;
}

export interface ToolExecutor {
  execute<T = any>(params: Record<string, any>, context?: ToolContext): Promise<ToolResult<T>>;
  validate(params: Record<string, any>): boolean;
  getSchema(): Record<string, any>;
}

// Re-export specific tool implementations
export * from './web-search';
export * from './file-operations';
export * from './data-processing';
export * from './api-integration'; 