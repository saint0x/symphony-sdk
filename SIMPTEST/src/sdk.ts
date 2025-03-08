// Import from local package during development
import { symphony as originalSymphony, ISymphony } from 'symphonic';
import type { Agent, Tool, Team } from 'symphonic';

// Create a Symphony instance with proper typing
const symphony: ISymphony = originalSymphony;

// Define interfaces
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

export interface AgentResult {
    success: boolean;
    result: any;
    error?: Error;
    metrics?: {
        duration: number;
        startTime: number;
        endTime: number;
        toolCalls: number;
        [key: string]: any;
    };
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

export interface ToolConfig {
    name: string;
    description: string;
    inputs: string[];
    outputs?: string[];
    handler: (input: any) => Promise<ToolResult<any>>;
    validation?: ValidationConfig;
}

export interface Pipeline {
    run(input: any, options?: PipelineOptions): Promise<PipelineResult>;
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

export interface PipelineOptions {
    onStepComplete?: (step: PipelineStep, result: any) => void;
    onMetrics?: (metrics: { [key: string]: any }) => void;
    timeout?: number;
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

export interface RetryConfig {
    enabled: boolean;
    maxAttempts?: number;
    delay?: number;
    backoffFactor?: number;
    retryableErrors?: string[];
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
    custom?: (input: any) => Promise<boolean>;
    required?: string[];
}

export interface TeamConfig {
    name: string;
    description: string;
    agents: string[];
    config?: {
        type: 'parallel' | 'sequential';
        maxConcurrent?: number;
        retryAttempts?: number;
    };
}

export interface AgentConfig {
    name: string;
    description: string;
    task: string;
    tools: any[];
    llm: LLMConfig;
    maxCalls?: number;
    requireApproval?: boolean;
    timeout?: number;
}

export interface LLMConfig {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
}

export interface ValidationResult {
    success: boolean;
    lastValidated?: number;
    error?: string;
}

export interface DependencyInfo {
    name: string;
    status: string;
}

export interface ComponentStatusDetails {
    status: string;
    initAttempts: number;
    lastAttemptTime?: number;
    error?: Error;
    dependencies: DependencyInfo[];
    validationResult?: ValidationResult;
}

// Export imported types
export type { Agent, Tool, Team };

// Define our capability builder
const CapabilityBuilder = {
    team: (capability: string) => `team.${capability}`,
    agent: (capability: string) => `agent.${capability}`,
    numeric: (capability: string) => `numeric.${capability}`,
    processing: (capability: string) => `processing.${capability}`
};

// Define common capabilities
const CommonCapabilities = {
    TOOL_USE: 'tool.use',
    COORDINATION: 'coordination',
    PARALLEL: 'parallel',
    ADD: 'add'
};

// Define default LLM config
const DEFAULT_LLM_CONFIG: LLMConfig = {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000
};

// Export the Symphony instance
export { symphony };

// Export values
export {
    CapabilityBuilder,
    CommonCapabilities,
    DEFAULT_LLM_CONFIG
}; 
