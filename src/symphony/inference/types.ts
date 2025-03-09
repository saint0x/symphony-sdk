import { LLMConfig, PipelineConfig, PipelineStep } from '../../types/sdk';
import { ComponentMetadata } from '../../types/metadata';

/**
 * Base configuration pattern for type inference
 */
export interface InferencePattern {
    name: string;
    type: 'agent' | 'tool' | 'team' | 'pipeline';
    capabilities: string[];
    metadata: ComponentMetadata;
}

/**
 * Configuration patterns for different component types
 */
export interface AgentPattern extends InferencePattern {
    readonly type: 'agent';
    description?: string;
    systemPrompt?: string;
    task: string;
    tools: string[];
    capabilities: string[];
    llm: LLMConfig;
    thresholds?: {
        fastPath?: number;
        confidence?: number;
        performance?: number;
    };
    maxCalls?: number;
    requireApproval?: boolean;
}

export interface ToolPattern extends InferencePattern {
    readonly type: 'tool';
    description?: string;
    inputs: string[];
    outputs: string[];
    apiKey?: string;
    timeout?: number;
    retryCount?: number;
    maxSize?: number;
    config: Record<string, any>;
    validation?: InferenceValidationConfig;
}

export interface TeamPattern extends InferencePattern {
    readonly type: 'team';
    description?: string;
    agents: string[];
    capabilities: string[];
    config: Record<string, any>;
    strategy?: 'collaborative' | 'parallel' | 'load-balanced';
}

export interface PipelinePattern extends InferencePattern {
    readonly type: 'pipeline';
    description?: string;
    steps: PipelineStep[];
    onError?: PipelineConfig['onError'];
    errorStrategy?: PipelineConfig['errorStrategy'];
    metrics?: {
        enabled: boolean;
        detailed: boolean;
        trackMemory: boolean;
    };
    config: Record<string, any>;
    validation?: InferenceValidationConfig;
}

/**
 * Smart configuration type with optimization metadata
 */
export interface SmartConfig<T extends InferencePattern> {
    base: Partial<T>;
    optimizations?: OptimizationStrategy[];
    metrics?: {
        latency?: number;
        throughput?: number;
        cost?: number;
    };
    advanced?: {
        customValidation?: boolean;
        debugMode?: boolean;
        timeoutMs?: number;
    };
}

/**
 * Optimization strategy for configuration enhancement
 */
export interface OptimizationStrategy {
    priority: number;
    condition: (config: Partial<InferencePattern>) => boolean;
    enhance: (config: Partial<InferencePattern>) => InferencePattern;
}

/**
 * Runtime optimization metadata
 */
export interface RuntimeOptimization {
    strategy: OptimizationStrategy;
    caching: boolean;
    priority: number;
}

/**
 * Type inference helpers
 */
export type InferredConfig<T> = T extends string
    ? DefaultPatternConfig<T>
    : T extends Partial<infer R>
    ? CompleteConfig<R>
    : never;

/**
 * Base configuration map for component types
 */
export interface BaseConfigMap {
    agent: AgentPattern;
    tool: ToolPattern;
    team: TeamPattern;
    pipeline: PipelinePattern;
}

export type DefaultPatternConfig<T extends string> = {
    [K in keyof BaseConfigMap]: BaseConfigMap[K];
} & {
    name: T;
    _metadata: { inferredFrom: 'pattern' };
};

export type CompleteConfig<T> = Required<Pick<T, RequiredKeys<T>>> &
    Partial<Pick<T, OptionalKeys<T>>> & {
    _metadata: { inferredFrom: 'partial' | 'complete' };
};

type RequiredKeys<T> = {
    [K in keyof T]: undefined extends T[K] ? never : K;
}[keyof T];

type OptionalKeys<T> = {
    [K in keyof T]: undefined extends T[K] ? K : never;
}[keyof T];

/**
 * Pattern registry types
 */
export interface PatternRegistry<T extends InferencePattern> {
    patterns: Map<string, T>;
    capabilities: Map<string, Set<string>>;
    defaults: Map<string, Partial<T>>;
}

/**
 * Capability inference types
 */
export interface CapabilitySet {
    required: string[];
    optional: string[];
    metadata?: Record<string, any>;
}

export interface ToolSet {
    capabilities: string[];
    requirements?: string[];
    compatibility?: string[];
}

export interface InferenceValidationConfig {
    schema: {
        input?: {
            type: string;
            required: boolean;
        };
        output?: {
            type: string;
            required: boolean;
        };
        flow?: {
            type: string;
            required: boolean;
        };
    };
}

export type InferredPattern<T extends InferencePattern> = {
    base: T;
    optimizations?: any[];
    metrics?: {
        latency?: number;
        throughput?: number;
        cost?: number;
    };
}; 