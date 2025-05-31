import { CommandMapProcessor, CacheResult, PatternMatch } from './map-processor';
import { ContextTreeBuilder, ContextTree, ContextQuery } from './tree-builder';
import { Logger } from '../utils/logger';
import { IDatabaseService } from '../db/types';

export interface IntelligenceOptions {
    enablePatternMatching?: boolean;
    enableContextTrees?: boolean;
    fastPathThreshold?: number;
    contextMaxNodes?: number;
    includeLowPriorityContext?: boolean;
    sessionId?: string;
    xmlPatternPath?: string;
    contextTemplatePath?: string;
}

export interface IntelligenceResult {
    // Pattern matching results
    patternMatch?: {
        found: boolean;
        confidence: number;
        shouldUseFastPath: boolean;
        executionTime: number;
        match?: PatternMatch;
    };
    
    // Context tree results  
    contextTree?: ContextTree;
    contextPrompt?: string;
    
    // Combined intelligence
    recommendation: {
        action: 'fast_path' | 'standard_path' | 'enhanced_context' | 'no_match';
        confidence: number;
        reasoning: string;
        suggestedTools?: string[];
        contextPriority: 'high' | 'medium' | 'low';
    };
    
    // Performance metrics
    performance: {
        totalTime: number;
        patternMatchTime: number;
        contextBuildTime: number;
        cacheHits: number;
        cacheMisses: number;
    };
    
    // Metadata
    metadata: {
        sessionId?: string;
        timestamp: Date;
        serviceVersion: string;
        featuresUsed: string[];
    };
}

export interface SessionIntelligence {
    sessionId: string;
    totalQueries: number;
    fastPathUsage: number;
    averageConfidence: number;
    topPatterns: string[];
    contextComplexity: number;
    learningProgress: number;
}

export class CacheIntelligenceService {
    private static instance: CacheIntelligenceService;
    private commandMapProcessor: CommandMapProcessor;
    private contextTreeBuilder: ContextTreeBuilder;
    private logger: Logger;
    private database: IDatabaseService;
    private initialized: boolean = false;
    
    // Session tracking
    private sessionStats = new Map<string, SessionIntelligence>();
    private globalStats = {
        totalQueries: 0,
        fastPathQueries: 0,
        patternMatches: 0,
        contextTreeBuilds: 0,
        cacheHits: 0,
        cacheMisses: 0
    };

    private constructor(database: IDatabaseService) {
        this.logger = Logger.getInstance('CacheIntelligenceService');
        this.database = database;
        this.commandMapProcessor = CommandMapProcessor.getInstance(database);
        this.contextTreeBuilder = ContextTreeBuilder.getInstance(database);
    }

    static getInstance(database: IDatabaseService): CacheIntelligenceService {
        if (!CacheIntelligenceService.instance) {
            CacheIntelligenceService.instance = new CacheIntelligenceService(database);
        } else if (CacheIntelligenceService.instance.database !== database) {
            // If a different database is provided, update all references
            CacheIntelligenceService.instance.logger.info('CacheIntelligenceService', 'Updating database reference');
            CacheIntelligenceService.instance.database = database;
            // Update sub-services with new database
            CacheIntelligenceService.instance.commandMapProcessor = CommandMapProcessor.getInstance(database);
            CacheIntelligenceService.instance.contextTreeBuilder = ContextTreeBuilder.getInstance(database);
            CacheIntelligenceService.instance.initialized = false; // Force re-initialization
        }
        return CacheIntelligenceService.instance;
    }

    async initialize(options: IntelligenceOptions = {}): Promise<void> {
        if (this.initialized) return;

        this.logger.info('CacheIntelligenceService', 'Initializing cache intelligence service');

        try {
            // Initialize sub-services
            if (options.enablePatternMatching !== false) {
                await this.commandMapProcessor.initialize(options.xmlPatternPath);
                
                if (options.fastPathThreshold) {
                    this.commandMapProcessor.setFastPathThreshold(options.fastPathThreshold);
                }
            }

            if (options.enableContextTrees !== false) {
                await this.contextTreeBuilder.initialize(options.contextTemplatePath);
            }

            this.initialized = true;
            this.logger.info('CacheIntelligenceService', 'Cache intelligence service initialized successfully');
        } catch (error) {
            this.logger.error('CacheIntelligenceService', 'Failed to initialize', { error });
            throw error;
        }
    }

    async getIntelligence(
        userInput: string, 
        options: IntelligenceOptions = {}
    ): Promise<IntelligenceResult> {
        const startTime = Date.now();
        const sessionId = options.sessionId || 'default';
        
        this.logger.info('CacheIntelligenceService', 'Getting intelligence for user input', {
            input: userInput.substring(0, 100),
            sessionId
        });

        try {
            const featuresUsed: string[] = [];
            let patternResult: CacheResult | undefined;
            let contextTree: ContextTree | undefined;
            let contextPrompt: string | undefined;
            
            const patternStartTime = Date.now();
            
            // 1. Pattern Matching (if enabled)
            if (options.enablePatternMatching !== false) {
                featuresUsed.push('pattern_matching');
                patternResult = await this.commandMapProcessor.processUserInput(userInput, sessionId);
                this.globalStats.patternMatches++;
                
                if (patternResult.matched) {
                    this.logger.info('CacheIntelligenceService', 'Pattern match found', {
                        confidence: patternResult.confidence?.toFixed(3),
                        pattern: patternResult.patternMatch?.pattern.id,
                        fastPath: patternResult.shouldUseFastPath
                    });
                }
            }
            
            const patternTime = Date.now() - patternStartTime;
            const contextStartTime = Date.now();
            
            // 2. Context Tree Building (if enabled and beneficial)
            if (options.enableContextTrees !== false) {
                const shouldBuildContext = this.shouldBuildContext(patternResult, userInput);
                
                if (shouldBuildContext) {
                    featuresUsed.push('context_trees');
                    
                    const contextQuery: ContextQuery = {
                        sessionId,
                        limit: options.contextMaxNodes || 50
                    };
                    
                    contextTree = await this.contextTreeBuilder.buildContextTree(sessionId, contextQuery);
                    this.globalStats.contextTreeBuilds++;
                    
                    // Generate context prompt
                    contextPrompt = await this.contextTreeBuilder.getContextForPrompt(sessionId, {
                        maxNodes: options.contextMaxNodes || 50,
                        includeLowPriority: options.includeLowPriorityContext || false
                    });
                }
            }
            
            const contextTime = Date.now() - contextStartTime;
            
            // 3. Generate combined recommendation
            const recommendation = this.generateRecommendation(patternResult, contextTree, userInput);
            
            // 4. Update statistics
            this.updateSessionStats(sessionId, patternResult, recommendation);
            this.globalStats.totalQueries++;
            if (recommendation.action === 'fast_path') {
                this.globalStats.fastPathQueries++;
            }
            
            const totalTime = Date.now() - startTime;
            
            return {
                patternMatch: patternResult ? {
                    found: patternResult.matched,
                    confidence: patternResult.confidence,
                    shouldUseFastPath: patternResult.shouldUseFastPath,
                    executionTime: patternResult.executionTime,
                    match: patternResult.patternMatch
                } : undefined,
                
                contextTree,
                contextPrompt,
                recommendation,
                
                performance: {
                    totalTime,
                    patternMatchTime: patternTime,
                    contextBuildTime: contextTime,
                    cacheHits: this.globalStats.cacheHits,
                    cacheMisses: this.globalStats.cacheMisses
                },
                
                metadata: {
                    sessionId,
                    timestamp: new Date(),
                    serviceVersion: '1.0.0',
                    featuresUsed
                }
            };
        } catch (error) {
            this.logger.error('CacheIntelligenceService', 'Failed to get intelligence', { error, userInput });
            
            // Return fallback result
            return this.createFallbackResult(userInput, sessionId, Date.now() - startTime);
        }
    }

    private shouldBuildContext(patternResult?: CacheResult, userInput?: string): boolean {
        // Always build context if no pattern match
        if (!patternResult || !patternResult.matched) {
            return true;
        }
        
        // Build context if pattern confidence is low-medium
        if (patternResult.confidence < 0.75) {
            return true;
        }
        
        // Build context for complex queries (long input, questions, analysis requests)
        if (userInput && (
            userInput.length > 100 ||
            userInput.includes('?') ||
            /analyze|explain|understand|context|why|how/.test(userInput.toLowerCase())
        )) {
            return true;
        }
        
        return false;
    }

    private generateRecommendation(
        patternResult?: CacheResult, 
        contextTree?: ContextTree, 
        _userInput?: string
    ) {
        // High confidence pattern match -> Fast path
        if (patternResult?.matched && patternResult.shouldUseFastPath) {
            return {
                action: 'fast_path' as const,
                confidence: patternResult.confidence,
                reasoning: `High confidence pattern match (${(patternResult.confidence * 100).toFixed(1)}%) for "${patternResult.patternMatch?.pattern.id}"`,
                suggestedTools: patternResult.patternMatch ? [patternResult.patternMatch.toolCall.name] : undefined,
                contextPriority: 'low' as const
            };
        }
        
        // Medium confidence pattern + rich context -> Enhanced context
        if (patternResult?.matched && contextTree && contextTree.totalNodes > 10) {
            return {
                action: 'enhanced_context' as const,
                confidence: Math.min(0.85, patternResult.confidence + 0.1),
                reasoning: `Pattern match with rich session context (${contextTree.totalNodes} context nodes)`,
                suggestedTools: patternResult.patternMatch ? [patternResult.patternMatch.toolCall.name] : undefined,
                contextPriority: 'high' as const
            };
        }
        
        // Low confidence pattern or no pattern + context -> Standard path with context
        if (contextTree && contextTree.totalNodes > 5) {
            const confidence = patternResult?.confidence || 0.3;
            return {
                action: 'standard_path' as const,
                confidence,
                reasoning: `Using standard path with session context (${contextTree.totalNodes} nodes, ${contextTree.metadata.totalToolExecutions} tool executions)`,
                contextPriority: 'medium' as const
            };
        }
        
        // Fallback
        return {
            action: 'no_match' as const,
            confidence: 0.1,
            reasoning: 'No pattern match and minimal context available',
            contextPriority: 'low' as const
        };
    }

    private updateSessionStats(sessionId: string, patternResult?: CacheResult, recommendation?: any): void {
        if (!this.sessionStats.has(sessionId)) {
            this.sessionStats.set(sessionId, {
                sessionId,
                totalQueries: 0,
                fastPathUsage: 0,
                averageConfidence: 0,
                topPatterns: [],
                contextComplexity: 0,
                learningProgress: 0
            });
        }
        
        const stats = this.sessionStats.get(sessionId)!;
        stats.totalQueries++;
        
        if (recommendation?.action === 'fast_path') {
            stats.fastPathUsage++;
        }
        
        if (patternResult?.confidence) {
            stats.averageConfidence = (stats.averageConfidence + patternResult.confidence) / 2;
        }
        
        // Track top patterns
        if (patternResult?.patternMatch?.pattern.id) {
            const patternId = patternResult.patternMatch.pattern.id;
            if (!stats.topPatterns.includes(patternId)) {
                stats.topPatterns.push(patternId);
                if (stats.topPatterns.length > 10) {
                    stats.topPatterns = stats.topPatterns.slice(-10);
                }
            }
        }
    }

    private createFallbackResult(_userInput: string, sessionId: string, executionTime: number): IntelligenceResult {
        return {
            recommendation: {
                action: 'standard_path',
                confidence: 0.1,
                reasoning: 'Fallback to standard path due to intelligence service error',
                contextPriority: 'low'
            },
            performance: {
                totalTime: executionTime,
                patternMatchTime: 0,
                contextBuildTime: 0,
                cacheHits: 0,
                cacheMisses: 1
            },
            metadata: {
                sessionId,
                timestamp: new Date(),
                serviceVersion: '1.0.0',
                featuresUsed: ['fallback']
            }
        };
    }

    // Tool execution feedback methods
    async recordToolExecution(
        sessionId: string,
        toolName: string,
        parameters: Record<string, any>,
        result: any,
        success: boolean,
        executionTime: number,
        patternId?: string
    ): Promise<void> {
        try {
            // Update pattern confidence if this was a pattern-matched execution
            if (patternId) {
                await this.commandMapProcessor.updatePatternConfidence(patternId, success, executionTime);
            }
            
            // Record in database for context building
            await this.database.recordToolExecution({
                execution_id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                tool_name: toolName,
                parameters: JSON.stringify(parameters),
                result: JSON.stringify(result),
                success,
                execution_time_ms: executionTime,
                session_id: sessionId,
                error_message: success ? null : (result?.error || 'Unknown error')
            });
            
            this.logger.info('CacheIntelligenceService', 'Recorded tool execution', {
                sessionId,
                toolName,
                success,
                executionTime,
                patternId
            });
        } catch (error) {
            this.logger.error('CacheIntelligenceService', 'Failed to record tool execution', { 
                error, sessionId, toolName 
            });
        }
    }

    async adaptPattern(patternId: string, userFeedback: 'positive' | 'negative', _context?: any): Promise<void> {
        try {
            const pattern = this.commandMapProcessor.getPattern(patternId);
            if (!pattern) {
                this.logger.warn('CacheIntelligenceService', 'Cannot adapt unknown pattern', { patternId });
                return;
            }
            
            // Adjust confidence based on feedback
            const adjustment = userFeedback === 'positive' ? 0.05 : -0.1;
            const newConfidence = Math.max(0.1, Math.min(0.99, pattern.confidence + adjustment));
            
            await this.commandMapProcessor.updatePatternConfidence(
                patternId, 
                userFeedback === 'positive', 
                0 // No execution time for manual feedback
            );
            
            this.logger.info('CacheIntelligenceService', 'Adapted pattern based on user feedback', {
                patternId,
                feedback: userFeedback,
                oldConfidence: pattern.confidence.toFixed(3),
                newConfidence: newConfidence.toFixed(3)
            });
        } catch (error) {
            this.logger.error('CacheIntelligenceService', 'Failed to adapt pattern', { error, patternId });
        }
    }

    // Analytics and monitoring
    getSessionIntelligence(sessionId: string): SessionIntelligence | undefined {
        return this.sessionStats.get(sessionId);
    }

    getGlobalStats() {
        return {
            ...this.globalStats,
            sessions: this.sessionStats.size,
            averageFastPathRate: this.globalStats.totalQueries > 0 ? 
                this.globalStats.fastPathQueries / this.globalStats.totalQueries : 0,
            patternMatchRate: this.globalStats.totalQueries > 0 ?
                this.globalStats.patternMatches / this.globalStats.totalQueries : 0
        };
    }

    async getPatternAnalytics() {
        const patterns = this.commandMapProcessor.getPatterns();
        
        return {
            totalPatterns: patterns.length,
            averageConfidence: patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length,
            topPatterns: patterns
                .sort((a, b) => b.usageStats.successCount - a.usageStats.successCount)
                .slice(0, 10)
                .map(p => ({
                    id: p.id,
                    confidence: p.confidence,
                    successCount: p.usageStats.successCount,
                    failureCount: p.usageStats.failureCount,
                    successRate: p.usageStats.successCount / (p.usageStats.successCount + p.usageStats.failureCount)
                })),
            patternsByTool: patterns.reduce((groups, pattern) => {
                if (!groups[pattern.toolName]) groups[pattern.toolName] = [];
                groups[pattern.toolName].push(pattern.id);
                return groups;
            }, {} as Record<string, string[]>)
        };
    }

    async getContextAnalytics() {
        const stats = this.contextTreeBuilder.getCacheStats();
        
        return {
            cacheStats: stats,
            contextTreeBuilds: this.globalStats.contextTreeBuilds,
            averageTreeComplexity: 0 // Could be calculated from recent builds
        };
    }

    // Utility methods
    clearCaches(): void {
        this.contextTreeBuilder.clearCache();
        this.logger.info('CacheIntelligenceService', 'Cleared all caches');
    }

    async healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        cacheHits: number;
        cacheMisses: number;
        totalPatterns: number;
        activeContexts: number;
        uptime: number;
    }> {
        return {
            status: 'healthy',
            cacheHits: this.globalStats.cacheHits,
            cacheMisses: this.globalStats.cacheMisses,
            totalPatterns: this.commandMapProcessor.getPatterns().length,
            activeContexts: this.sessionStats.size,
            uptime: Date.now() - Date.now() // Simple uptime placeholder
        };
    }

    getCommandMapProcessor(): CommandMapProcessor {
        return this.commandMapProcessor;
    }
} 