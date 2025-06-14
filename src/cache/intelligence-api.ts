import { CommandMapProcessor, Pattern as CommandMapPattern, RuntimeToolCallDetails } from './map-processor';
import { ContextTreeBuilder, ContextQuery } from './tree-builder';
import { Logger } from '../utils/logger';
import { IDatabaseService } from '../db/types';
import { ToolResult } from '../types/sdk';
import { IContextIntelligenceAPI as IContextIntelligenceAPIInterface } from '../api/IContextIntelligenceAPI';

export interface ContextIntelligenceConfig {
    sessionId?: string;
    enableLearning?: boolean;
    confidenceThreshold?: number;
}

export interface PatternUpdateRequest {
    nlpPattern: string;
    toolName: string;
    success: boolean;
    executionTime?: number;
    metadata?: Record<string, any>;
}

export interface ContextPruningRequest {
    sessionId?: string;
    maxAge?: number;
    minConfidence?: number;
    keepRecentCount?: number;
}

export interface LearningUpdateRequest {
    toolName: string;
    parameters: Record<string, any>;
    result: any;
    success: boolean;
    userFeedback?: 'positive' | 'negative' | 'neutral';
    contextData?: Record<string, any>;
}

/**
 * Context Intelligence API - Provides tool-compatible interface to cache intelligence
 * This class exposes the map-processor and tree-builder logic as callable functions
 * that can be registered as tools and used by agents through the registry.
 */
export class ContextIntelligenceAPI implements Pick<IContextIntelligenceAPIInterface, 'registerToolNlpMapping'> {
    private mapProcessor: CommandMapProcessor;
    private treeBuilder: ContextTreeBuilder;
    private logger: Logger;
    private database: IDatabaseService;
    private config: ContextIntelligenceConfig;

    constructor(database: IDatabaseService, config: ContextIntelligenceConfig = {}) {
        this.database = database;
        this.config = {
            enableLearning: true,
            confidenceThreshold: 0.7,
            ...config
        };
        this.logger = Logger.getInstance('ContextIntelligenceAPI');
        this.mapProcessor = CommandMapProcessor.getInstance(database);
        this.treeBuilder = ContextTreeBuilder.getInstance(database);
    }

    /**
     * Validate Command Map Update - Tool Interface
     * Validates whether a command map update is safe and consistent
     */
    async validateCommandMapUpdate(params: {
        nlpPattern?: string;
        toolName?: string;
        operation?: 'add' | 'update' | 'delete';
        confidence?: number;
    }): Promise<ToolResult> {
        try {
            this.logger.info('ContextIntelligenceAPI', 'Validating command map update', params);

            const { nlpPattern, toolName, operation = 'add', confidence = 0.5 } = params;

            if (!nlpPattern || !toolName) {
                return {
                    success: false,
                    error: 'Missing required parameters: nlpPattern and toolName'
                };
            }

            // Check for pattern conflicts
            const existingPatterns = this.mapProcessor.getPatterns();
            const hasConflict = existingPatterns.some(pattern => 
                pattern.trigger === nlpPattern && pattern.toolName !== toolName
            );

            if (hasConflict && operation === 'add') {
                return {
                    success: false,
                    error: `Pattern conflict: "${nlpPattern}" already mapped to different tool`,
                    result: { hasPatternConflicts: true }
                };
            }

            // Validate confidence threshold
            if (confidence < 0.1 || confidence > 1.0) {
                return {
                    success: false,
                    error: 'Confidence must be between 0.1 and 1.0'
                };
            }

            return {
                success: true,
                result: {
                    isValid: true,
                    hasPatternConflicts: false,
                    operation,
                    recommendedConfidence: Math.max(confidence, this.config.confidenceThreshold || 0.7)
                }
            };

        } catch (error) {
            this.logger.error('ContextIntelligenceAPI', 'Command map validation failed', { error, params });
            return {
                success: false,
                error: `Validation failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Update Learning Context - Tool Interface  
     * Updates the learning context based on execution results and user feedback
     */
    async updateLearningContext(params: LearningUpdateRequest): Promise<ToolResult> {
        try {
            this.logger.info('ContextIntelligenceAPI', 'Updating learning context', {
                toolName: params.toolName,
                success: params.success,
                hasFeedback: !!params.userFeedback
            });

            const { toolName, parameters, result, success, userFeedback, contextData } = params;

            if (!this.config.enableLearning) {
                return {
                    success: true,
                    result: { learningDisabled: true, message: 'Learning updates disabled' }
                };
            }

            // Record execution in database for context building
            await this.database.recordToolExecution({
                execution_id: `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                tool_name: toolName,
                parameters: JSON.stringify(parameters),
                result: JSON.stringify(result),
                success,
                execution_time_ms: 0,
                session_id: this.config.sessionId || 'default',
                error_details: success ? null : (result?.error || 'Execution failed'),
                user_feedback: userFeedback ? this.mapUserFeedbackToInteger(userFeedback) : undefined,
                pattern_id: undefined // No specific pattern for learning context updates
            });

            // Update pattern confidence if applicable
            const patterns = this.mapProcessor.getPatterns();
            const relatedPattern = patterns.find(p => p.toolName === toolName);
            
            if (relatedPattern) {
                const confidenceAdjustment = this.calculateConfidenceAdjustment(success, userFeedback);
                await this.mapProcessor.updatePatternConfidence(
                    relatedPattern.id, 
                    success, 
                    0 // No execution time for learning updates
                );

                this.logger.info('ContextIntelligenceAPI', 'Updated pattern confidence', {
                    patternId: relatedPattern.id,
                    adjustment: confidenceAdjustment,
                    newConfidence: relatedPattern.confidence + confidenceAdjustment
                });
            }

            return {
                success: true,
                result: {
                    learningUpdated: true,
                    patternUpdated: !!relatedPattern,
                    contextData: contextData || {},
                    recommendations: this.generateLearningRecommendations(toolName, success, userFeedback)
                }
            };

        } catch (error) {
            this.logger.error('ContextIntelligenceAPI', 'Learning context update failed', { error, params });
            return {
                success: false,
                error: `Learning update failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Execute Context Pruning - Tool Interface
     * Prunes old or low-confidence context entries to maintain performance
     */
    async executeContextPruning(params: ContextPruningRequest): Promise<ToolResult> {
        try {
            this.logger.info('ContextIntelligenceAPI', 'Executing context pruning', params);

            const {
                maxAge = 24 * 60 * 60 * 1000, // 24 hours default
                minConfidence = 0.3,
                keepRecentCount = 50
            } = params;

            let totalPruned = 0;

            // 1. Prune context tree cache (existing functionality)
            this.treeBuilder.clearCache();

            // 2. Intelligent Database Pruning - Remove old tool execution records
            
            // Get old records that are candidates for pruning
            const allExecutions = await this.database.table('tool_executions').find();
            
            // Group executions by tool to analyze usage patterns
            const toolUsageMap = new Map<string, any[]>();
            allExecutions.forEach((exec: any) => {
                const toolName = exec.tool_name;
                if (!toolUsageMap.has(toolName)) {
                    toolUsageMap.set(toolName, []);
                }
                toolUsageMap.get(toolName)!.push(exec);
            });

            // Intelligent pruning logic
            const recordsToPrune: string[] = [];
            
            this.logger.info('ContextIntelligenceAPI', 'Starting intelligent pruning analysis', {
                totalTools: toolUsageMap.size,
                totalExecutions: allExecutions.length,
                maxAge,
                minConfidence,
                keepRecentCount
            });
            
            for (const [toolName, executions] of toolUsageMap) {
                // Calculate tool performance metrics
                const successCount = executions.filter((e: any) => e.success).length;
                const totalCount = executions.length;
                const successRate = totalCount > 0 ? successCount / totalCount : 0;
                
                this.logger.info('ContextIntelligenceAPI', 'Analyzing tool', {
                    toolName,
                    totalExecutions: totalCount,
                    successCount,
                    successRate: Math.round(successRate * 100) + '%'
                });
                
                // Sort executions by age (oldest first)
                const sortedExecutions = executions.sort((a: any, b: any) => 
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );

                let toolPruneCount = 0;
                let toolPreserveCount = 0;

                // Pruning criteria based on intelligence
                for (const execution of sortedExecutions) {
                    const executionAge = Date.now() - new Date(execution.created_at).getTime();
                    const isOld = executionAge > maxAge;
                    const isLowPerformance = successRate < minConfidence;
                    const isObsolete = !execution.success && executionAge > (maxAge / 2); // Failed and old
                    
                    // Keep recent high-value executions
                    const isRecentCritical = executionAge < (maxAge / 4) && execution.success;
                    const isHighFrequencyRecent = totalCount > 20 && successRate > 0.9 && executionAge < (maxAge / 2);
                    
                    // Age-based pruning is primary - only preserve if critically important
                    if (isOld && !isRecentCritical && !isHighFrequencyRecent) {
                        recordsToPrune.push(execution.execution_id);
                        toolPruneCount++;
                    } else if (isLowPerformance || isObsolete) {
                        recordsToPrune.push(execution.execution_id);
                        toolPruneCount++;
                    } else {
                        toolPreserveCount++;
                    }
                }
                
                this.logger.info('ContextIntelligenceAPI', 'Tool analysis complete', {
                    toolName,
                    markedForPruning: toolPruneCount,
                    preserved: toolPreserveCount,
                    totalForTool: totalCount
                });
            }
            
            this.logger.info('ContextIntelligenceAPI', 'Pre-preservation pruning list', {
                totalMarkedForPruning: recordsToPrune.length,
                toolsAnalyzed: toolUsageMap.size
            });

            // Execute database pruning
            for (const executionId of recordsToPrune) {
                try {
                    await this.database.table('tool_executions')
                        .delete({ execution_id: executionId });
                    totalPruned++;
                } catch (error) {
                    this.logger.warn('ContextIntelligenceAPI', 'Failed to prune execution record', { 
                        executionId, 
                        error 
                    });
                }
            }

            // 3. Prune in-memory patterns (existing logic enhanced)
            const patterns = this.mapProcessor.getPatterns();
            const lowConfidencePatterns = patterns.filter(p => p.confidence < minConfidence);
            const oldPatterns = patterns.filter(p => {
                const lastUsed = new Date(p.usageStats.lastUsed || 0);
                return Date.now() - lastUsed.getTime() > maxAge;
            });

            const prunedPatterns = [...new Set([...lowConfidencePatterns, ...oldPatterns])];
            
            // Sort by confidence and keep only the worst performers
            const patternsToPrune = prunedPatterns
                .sort((a, b) => a.confidence - b.confidence)
                .slice(0, Math.max(0, prunedPatterns.length - keepRecentCount));

            let prunedPatternCount = 0;
            for (const pattern of patternsToPrune) {
                try {
                    // For now, just mark as low priority (could implement actual removal)
                    pattern.confidence = Math.max(0.1, pattern.confidence - 0.1);
                    prunedPatternCount++;
                } catch (error) {
                    this.logger.warn('ContextIntelligenceAPI', 'Failed to prune pattern', { 
                        patternId: pattern.id, 
                        error 
                    });
                }
            }

            return {
                success: true,
                result: {
                    pruningCompleted: true,
                    prunedEntries: totalPruned, // Database records pruned
                    prunedPatterns: prunedPatternCount, // In-memory patterns adjusted
                    totalExecutions: allExecutions.length,
                    remainingExecutions: allExecutions.length - totalPruned,
                    criteria: { maxAge, minConfidence, keepRecentCount },
                    intelligentDecisions: {
                        toolsAnalyzed: toolUsageMap.size,
                        usageBasedPreservation: true,
                        performanceBasedPruning: true,
                        ageBasedRemoval: true
                    }
                }
            };

        } catch (error) {
            this.logger.error('ContextIntelligenceAPI', 'Context pruning failed', { error, params });
            return {
                success: false,
                error: `Context pruning failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Update Pattern Stats - Tool Interface
     * Updates pattern usage statistics and performance metrics
     */
    async updatePatternStats(params: PatternUpdateRequest): Promise<ToolResult> {
        try {
            this.logger.info('ContextIntelligenceAPI', 'Updating pattern stats', {
                toolName: params.toolName,
                success: params.success
            });

            const { nlpPattern, toolName, success, executionTime = 0, metadata = {} } = params;

            // Find the pattern
            const patterns = this.mapProcessor.getPatterns();
            const pattern = patterns.find(p => 
                p.trigger === nlpPattern || p.toolName === toolName
            );

            if (!pattern) {
                return {
                    success: false,
                    error: `Pattern not found for tool: ${toolName} or pattern: ${nlpPattern}`
                };
            }

            // Update pattern confidence and stats
            await this.mapProcessor.updatePatternConfidence(pattern.id, success, executionTime);

            // Update usage statistics
            if (success) {
                pattern.usageStats.successCount++;
            } else {
                pattern.usageStats.failureCount++;
            }
            pattern.usageStats.lastUsed = new Date();

            // Calculate success rate
            const totalAttempts = pattern.usageStats.successCount + pattern.usageStats.failureCount;
            const successRate = totalAttempts > 0 ? pattern.usageStats.successCount / totalAttempts : 0;

            return {
                success: true,
                result: {
                    patternId: pattern.id,
                    updatedStats: {
                        successCount: pattern.usageStats.successCount,
                        failureCount: pattern.usageStats.failureCount,
                        successRate: successRate,
                        lastUsed: pattern.usageStats.lastUsed,
                        confidence: pattern.confidence
                    },
                    metadata
                }
            };

        } catch (error) {
            this.logger.error('ContextIntelligenceAPI', 'Pattern stats update failed', { error, params });
            return {
                success: false,
                error: `Pattern stats update failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Validate Context Tree Update - Tool Interface
     * Validates context tree consistency and structure
     */
    async validateContextTreeUpdate(params: {
        sessionId?: string;
        maxNodes?: number;
        operation?: 'build' | 'update' | 'prune';
    }): Promise<ToolResult> {
        try {
            this.logger.info('ContextIntelligenceAPI', 'Validating context tree update', params);

            const {
                sessionId = this.config.sessionId || 'default',
                maxNodes = 50,
                operation = 'build'
            } = params;

            // Build current context tree for validation
            const contextQuery: ContextQuery = {
                sessionId,
                limit: maxNodes
            };

            const contextTree = await this.treeBuilder.buildContextTree(sessionId, contextQuery);

            // Validate tree structure
            const isConsistent = this.validateTreeConsistency(contextTree);
            const isWithinLimits = contextTree.totalNodes <= maxNodes;
            const hasValidBindings = this.validateTypeBindings(contextTree);

            return {
                success: true,
                result: {
                    isValid: isConsistent && isWithinLimits && hasValidBindings,
                    contextConsistent: isConsistent,
                    withinNodeLimits: isWithinLimits,
                    validTypeBindings: hasValidBindings,
                    currentNodes: contextTree.totalNodes,
                    maxNodes,
                    operation,
                    metrics: {
                        totalNodes: contextTree.totalNodes,
                        toolExecutions: contextTree.metadata.totalToolExecutions,
                        avgConfidence: contextTree.metadata.learningAdaptations
                    }
                }
            };

        } catch (error) {
            this.logger.error('ContextIntelligenceAPI', 'Context tree validation failed', { error, params });
            return {
                success: false,
                error: `Context tree validation failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * RENAMED: Old method that registered and persisted.
     * Registers a tool's NLP pattern, adds it to the runtime command map, AND persists it.
     * Prefer using NlpService for controlled persistence.
     */
    async registerAndPersistToolNLPMapping(
        toolName: string, 
        nlpPattern: string, 
        metadata: Record<string, any> = {}
    ): Promise<CommandMapPattern | null> {
        try {
            this.logger.info('ContextIntelligenceAPI', 'Registering and Persisting tool NLP mapping', {
                toolName,
                nlpPattern: nlpPattern.substring(0, 50) + '...',
                source: metadata?.source || 'direct_persist_call'
            });

            const toolCallDetails: RuntimeToolCallDetails = {
                name: toolName,
                parameters: metadata.parameters || {}, // Assuming parameters might be in metadata
                confidence: metadata.confidence || 0.7,
                source: metadata.source || 'context_api_persist'
            };
            
            // Calls the method in mapProcessor that handles both memory and DB
            const persistedPattern = await this.mapProcessor.addAndPersistRuntimePattern(nlpPattern, toolCallDetails);

            if (persistedPattern) {
                this.logger.info('ContextIntelligenceAPI', 'Tool NLP mapping registered and persisted successfully', {
                    toolName,
                    patternId: persistedPattern.id
                });
            } else {
                this.logger.warn('ContextIntelligenceAPI', 'Failed to register and persist tool NLP mapping', {toolName});
            }
            return persistedPattern;

        } catch (error) {
            this.logger.error('ContextIntelligenceAPI', 'Failed to register and persist tool NLP mapping', {
                error,
                toolName,
                nlpPattern
            });
            return null;
        }
    }

    /**
     * NEW METHOD: As per IContextIntelligenceAPI for NlpService.
     * Registers an NLP pattern mapping for a tool in the IN-MEMORY command map for runtime use.
     * This does NOT persist the pattern to the database.
     * @param mapping An object containing the tool name, its NLP pattern, and optionally a source.
     */
    async registerToolNlpMapping(
        mapping: { toolName: string; nlpPattern: string; source?: string }
    ): Promise<void> {
        try {
            this.logger.info('ContextIntelligenceAPI', 'Registering tool NLP mapping (in-memory ONLY)', {
                toolName: mapping.toolName,
                nlpPattern: mapping.nlpPattern.substring(0, 50) + '...',
                source: mapping.source
            });

            const toolCallDetails: RuntimeToolCallDetails = {
                name: mapping.toolName,
                parameters: {}, // Defaulting, as this is primarily for runtime command recognition
                confidence: 0.75, // Default confidence for in-memory load
                source: mapping.source || 'nlp_service_runtime_load'
            };

            const patternInMemory = this.mapProcessor.addRuntimePatternToMemory(mapping.nlpPattern, toolCallDetails);

            if (patternInMemory) {
                this.logger.info('ContextIntelligenceAPI', 'Tool NLP mapping registered in-memory successfully', {
                    toolName: mapping.toolName,
                    patternId: patternInMemory.id
                });
            } else {
                 this.logger.warn('ContextIntelligenceAPI', 'Failed to register tool NLP mapping in-memory', {toolName: mapping.toolName});
            }
        } catch (error) {
            this.logger.error('ContextIntelligenceAPI', 'Failed to register tool NLP mapping in-memory', {
                error,
                toolName: mapping.toolName,
                nlpPattern: mapping.nlpPattern
            });
            // Decide if this should throw an error to NlpService
        }
    }

    // Helper methods
    private calculateConfidenceAdjustment(success: boolean, feedback?: string): number {
        if (feedback === 'positive') return 0.05;
        if (feedback === 'negative') return -0.1;
        if (success) return 0.02;
        return -0.05;
    }

    private generateLearningRecommendations(
        toolName: string, 
        success: boolean, 
        feedback?: string
    ): string[] {
        const recommendations: string[] = [];
        
        if (!success) {
            recommendations.push(`Consider parameter adjustment for ${toolName}`);
            recommendations.push('Review tool documentation and usage patterns');
        }
        
        if (feedback === 'negative') {
            recommendations.push('Tool may not be suitable for this use case');
            recommendations.push('Consider alternative tools for similar tasks');
        }
        
        if (feedback === 'positive') {
            recommendations.push(`${toolName} is well-suited for this task type`);
            recommendations.push('Consider adding similar patterns for efficiency');
        }
        
        return recommendations;
    }

    private validateTreeConsistency(contextTree: any): boolean {
        // Basic consistency checks
        return contextTree && 
               contextTree.totalNodes >= 0 && 
               Array.isArray(contextTree.nodes) &&
               contextTree.nodes.length <= contextTree.totalNodes;
    }

    private validateTypeBindings(contextTree: any): boolean {
        // Validate that type bindings are consistent
        return contextTree && 
               contextTree.metadata &&
               typeof contextTree.metadata.learningAdaptations === 'number';
    }

    private mapUserFeedbackToInteger(feedback: string): number {
        switch (feedback) {
            case 'positive':
                return 1;
            case 'negative':
                return -1;
            case 'neutral':
                return 0;
            default:
                throw new Error('Invalid user feedback format');
        }
    }
} 