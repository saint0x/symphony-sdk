import { LLMConfig, ValidationConfig, RetryConfig } from '../../types/sdk';
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
    type: 'agent';
    task: string;
    tools: string[];
    llm: LLMConfig | string;
}

export interface ToolPattern extends InferencePattern {
    type: 'tool';
    inputs: string[];
    outputs?: string[];
    validation?: ValidationConfig;
}

export interface TeamPattern extends InferencePattern {
    type: 'team';
    agents: string[];
    strategy?: string;
}

export interface PipelinePattern extends InferencePattern {
    type: 'pipeline';
    steps: string[];
    validation?: ValidationConfig;
}

/**
 * Smart configuration options
 */
export interface SmartConfig<T extends InferencePattern> {
    base: Partial<T>;
    advanced?: {
        retry?: RetryConfig;
        validation?: ValidationConfig;
        metrics?: {
            enabled: boolean;
            detailed?: boolean;
            custom?: Record<string, any>;
        };
    };
}

/**
 * Type inference helpers
 */
export type InferredConfig<T> = T extends string
    ? DefaultPatternConfig<T>
    : T extends Partial<infer R>
    ? CompleteConfig<R>
    : never;

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

/**
 * Runtime optimization types
 */
export interface OptimizationStrategy {
    priority: number;
    condition: (config: Partial<InferencePattern>) => boolean;
    enhance: (config: Partial<InferencePattern>) => InferencePattern;
}

export interface RuntimeOptimization {
    caching?: boolean;
    lazy?: boolean;
    priority?: number;
    strategy?: OptimizationStrategy;
} 