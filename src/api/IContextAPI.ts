import { ToolResult } from '../types/sdk';

// ==========================================
// MAGIC INTENT TYPES
// ==========================================

export interface ValidateCommandParams {
    nlpPattern?: string;
    toolName?: string;
    operation?: 'add' | 'update' | 'delete';
    confidence?: number;
}

export interface LearningUpdateRequest {
    toolName: string;
    parameters: Record<string, any>;
    result: any;
    success: boolean;
    userFeedback?: 'positive' | 'negative' | 'neutral';
    contextData?: Record<string, any>;
}

export interface ContextPruningRequest {
    sessionId?: string;
    maxAge?: number;
    minConfidence?: number;
    keepRecentCount?: number;
}

export interface PatternUpdateRequest {
    nlpPattern: string;
    toolName: string;
    success: boolean;
    executionTime?: number;
    metadata?: Record<string, any>;
}

export interface SuggestToolsParams {
    task: string;
    context?: any;
    agentName?: string;
    previousAttempts?: string[];
}

export interface GetInsightsParams {
    sessionId?: string;
    toolName?: string;
    timeframe?: number; // milliseconds
    includeFailures?: boolean;
}

export interface LearnFromExecutionParams {
    toolName: string;
    success: boolean;
    executionTime: number;
    userFeedback?: 'positive' | 'negative' | 'neutral';
    context?: any;
    errorDetails?: string;
}

export interface ValidateContextTreeParams {
    sessionId?: string;
    maxNodes?: number;
    operation?: 'build' | 'update' | 'prune';
}

export interface AnalyzePatternsParams {
    toolName?: string;
    timeframe?: number;
    includeFailures?: boolean;
    minConfidence?: number;
}

export interface OptimizePerformanceParams {
    targetTool?: string;
    performanceThreshold?: number;
    includeRecommendations?: boolean;
}

// ==========================================
// MAGIC INTERFACE - TYPE SAFE
// ==========================================

/**
 * Type-safe Context API interface with magic method overloads
 */
export interface IContextAPI {
    /**
     * Validate command map update
     */
    useMagic(intent: 'validate_command_update', params: ValidateCommandParams): Promise<ToolResult>;
    
    /**
     * Execute intelligent context pruning
     */
    useMagic(intent: 'prune_context', params: ContextPruningRequest): Promise<ToolResult>;
    
    /**
     * Update pattern usage statistics
     */
    useMagic(intent: 'update_pattern_stats', params: PatternUpdateRequest): Promise<ToolResult>;
    
    /**
     * Validate context tree structure
     */
    useMagic(intent: 'validate_context_tree', params: ValidateContextTreeParams): Promise<ToolResult>;
    
    /**
     * Get tool suggestions for a task
     */
    useMagic(intent: 'suggest_tools', params: SuggestToolsParams): Promise<ToolResult>;
    
    /**
     * Get execution insights and analytics
     */
    useMagic(intent: 'get_insights', params: GetInsightsParams): Promise<ToolResult>;
    
    /**
     * Learn from execution results and update patterns
     */
    useMagic(intent: 'learn_from_execution', params: LearnFromExecutionParams): Promise<ToolResult>;
    
    /**
     * Analyze patterns and performance trends
     */
    useMagic(intent: 'analyze_patterns', params: AnalyzePatternsParams): Promise<ToolResult>;
    
    /**
     * Get performance optimization recommendations
     */
    useMagic(intent: 'optimize_performance', params: OptimizePerformanceParams): Promise<ToolResult>;

    /**
     * Register NLP pattern mapping (legacy compatibility)
     */
    registerToolNlpMapping(mapping: { toolName: string; nlpPattern: string; source?: string }): Promise<void>;

    /**
     * Health check for the Context API
     */
    healthCheck(): Promise<boolean>;
}

// ==========================================
// MAGIC INTENT UNION TYPE
// ==========================================

export type MagicIntent = 
    | 'validate_command_update'
    | 'prune_context'
    | 'update_pattern_stats'
    | 'validate_context_tree'
    | 'suggest_tools'
    | 'get_insights'
    | 'learn_from_execution'
    | 'analyze_patterns'
    | 'optimize_performance';

// ==========================================
// MAGIC REQUEST DISCRIMINATED UNION
// ==========================================

export type MagicRequest = 
    | { intent: 'validate_command_update'; params: ValidateCommandParams }
    | { intent: 'prune_context'; params: ContextPruningRequest }
    | { intent: 'update_pattern_stats'; params: PatternUpdateRequest }
    | { intent: 'validate_context_tree'; params: ValidateContextTreeParams }
    | { intent: 'suggest_tools'; params: SuggestToolsParams }
    | { intent: 'get_insights'; params: GetInsightsParams }
    | { intent: 'learn_from_execution'; params: LearnFromExecutionParams }
    | { intent: 'analyze_patterns'; params: AnalyzePatternsParams }
    | { intent: 'optimize_performance'; params: OptimizePerformanceParams }; 