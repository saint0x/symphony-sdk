// Core agent types and interfaces
export interface AgentResult<T = any> {
  result: T;
  success: boolean;
  error?: Error;
  metrics?: {
    duration: number;
    tokenUsage: {
      prompt: number;
      completion: number;
      total: number;
    };
    toolCalls: number;
  };
}

export interface AgentContext {
  agentId: string;
  sessionId: string;
  parentId?: string;
  metadata: Record<string, any>;
  memory?: Record<string, any>;
}

export interface AgentCapability {
  name: string;
  description: string;
  tools: string[];
  requiredSkills: string[];
  constraints?: Record<string, any>;
}

export interface AgentExecutor {
  execute<T = any>(task: string, context?: AgentContext): Promise<AgentResult<T>>;
  getCapabilities(): AgentCapability[];
  addTool(toolName: string): void;
  removeTool(toolName: string): void;
}