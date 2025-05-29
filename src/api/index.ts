/**
 * Symphony SDK Public API Definitions
 * 
 * This is the main entry point for all Symphony SDK TypeScript definitions.
 * Import from here to get complete type safety for all Symphony features.
 * 
 * @example
 * ```typescript
 * import { 
 *   Symphony, 
 *   SymphonyConfig, 
 *   AgentConfig, 
 *   TeamConfig,
 *   IntelligenceResult 
 * } from 'symphony-sdk/api';
 * ```
 */

// Export everything from core API
export * from './api';

// Export everything from cache/memory/database API  
export * from './utils';

// ===== COMPREHENSIVE TYPE MAPPINGS =====

/**
 * All available tool names in Symphony SDK
 */
export type AllToolNames = 
  | 'readFile'
  | 'writeFile' 
  | 'webSearch'
  | 'parseDocument'
  | 'writeCode'
  | 'createPlan'
  | 'ponder';

/**
 * All available LLM providers
 */
export type LLMProvider = 'openai' | 'anthropic' | 'groq';

/**
 * All available database adapters
 */
export type DatabaseAdapter = 'sqlite' | 'postgres' | 'mysql';

/**
 * All possible lifecycle states
 */
export type LifecycleState = 'PENDING' | 'INITIALIZING' | 'READY' | 'ERROR' | 'DEGRADED';

/**
 * All team execution strategies
 */
export type ExecutionStrategy = 'parallel' | 'sequential' | 'pipeline' | 'collaborative' | 'role_based';

/**
 * All memory types
 */
export type MemoryType = 'short_term' | 'long_term' | 'episodic';

/**
 * All streaming types
 */
export type StreamType = 'agent' | 'team' | 'pipeline' | 'tool' | 'chain';

/**
 * All cache intelligence recommendations
 */
export type CacheRecommendation = 'fast_path' | 'standard_path' | 'enhanced_context' | 'no_match';

// ===== UTILITY TYPES =====

/**
 * Configuration for initializing Symphony
 */
export interface CompleteSymphonyConfig {
  // Core LLM configuration
  llm: {
    provider: LLMProvider;
    model: string;
    apiKey?: string;
    temperature?: number;
    maxTokens?: number;
  };
  
  // Database configuration
  db?: {
    enabled: boolean;
    adapter: DatabaseAdapter;
    path?: string;
    connectionString?: string;
  };
  
  // Logging configuration
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  
  // Cache intelligence configuration
  cache?: {
    xmlPatternPath?: string;
    contextTemplatePath?: string;
    enablePatternMatching?: boolean;
    enableContextTrees?: boolean;
    fastPathThreshold?: number;
    contextMaxNodes?: number;
  };
  
  // Memory system configuration
  memory?: {
    shortTerm?: {
      defaultTTL?: number;
      maxSize?: number;
      cleanupInterval?: number;
    };
    longTerm?: {
      defaultTTL?: number;
      maxSize?: number; 
      cleanupInterval?: number;
    };
  };
  
  // Streaming configuration
  streaming?: {
    maxConcurrentStreams?: number;
    defaultBufferSize?: number;
    defaultUpdateInterval?: number;
    cleanupInterval?: number;
  };
}

/**
 * Complete result type for any Symphony operation
 */
export interface SymphonyOperationResult<T = any> {
  success: boolean;
  result?: T;
  error?: string;
  metrics?: {
    duration: number;
    startTime: number;
    endTime: number;
    [key: string]: any;
  };
}

/**
 * Health status for any Symphony service
 */
export interface ServiceHealthStatus {
  status: 'healthy' | 'degraded' | 'critical';
  services: Record<string, boolean>;
  performance: Record<string, number>;
  issues?: string[];
  recommendations?: string[];
}

/**
 * Generic query interface for search operations
 */
export interface SearchQuery {
  text?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

/**
 * Generic analytics interface
 */
export interface Analytics {
  total: number;
  successful: number;
  failed: number;
  averageDuration: number;
  trends: Record<string, number>;
  insights: string[];
}

// ===== CONVENIENCE TYPES =====

/**
 * Simplified agent configuration for quick setup
 */
export interface SimpleAgentConfig {
  name: string;
  task: string;
  tools: AllToolNames[];
  model?: string;
  capabilities?: string[];
}

/**
 * Simplified team configuration for quick setup
 */
export interface SimpleTeamConfig {
  name: string;
  agents: (string | SimpleAgentConfig)[];
  strategy?: ExecutionStrategy;
}

/**
 * Simplified pipeline configuration for quick setup
 */
export interface SimplePipelineConfig {
  name: string;
  steps: Array<{
    name: string;
    tool: AllToolNames;
    inputs?: Record<string, any>;
  }>;
}

// ===== VERSION AND METADATA =====

/**
 * Symphony SDK version information
 */
export interface SymphonyVersion {
  major: number;
  minor: number;
  patch: number;
  version: string;
  buildDate: string;
  features: string[];
}

/**
 * Symphony SDK metadata
 */
export interface SymphonyMetadata {
  name: string;
  version: SymphonyVersion;
  description: string;
  author: string;
  license: string;
  repository: string;
  documentation: string;
  support: string;
} 