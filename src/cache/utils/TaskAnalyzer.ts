import { Pattern as CommandMapPattern } from '../map-processor';
import { LearnFromExecutionParams } from '../../api/IContextAPI';

/**
 * Task analysis utilities for ContextAPI
 */
export class TaskAnalyzer {
    
    /**
     * Generate task-specific recommendations
     */
    static generateTaskRecommendations(task: string, suggestions: any[]): string[] {
        const recommendations: string[] = [];
        
        if (suggestions.length === 0) {
            recommendations.push('No existing patterns found for this task - execution will create new learning data');
            recommendations.push('Consider breaking down complex tasks into smaller components');
            return recommendations;
        }
        
        const highConfidenceSuggestions = suggestions.filter(s => s.confidence > 0.8);
        if (highConfidenceSuggestions.length > 0) {
            recommendations.push(`High confidence tools available: ${highConfidenceSuggestions.map(s => s.toolName).join(', ')}`);
        }
        
        const lowSuccessRateTools = suggestions.filter(s => s.successRate < 70);
        if (lowSuccessRateTools.length > 0) {
            recommendations.push(`Be cautious with: ${lowSuccessRateTools.map(s => s.toolName).join(', ')} (low success rate)`);
        }
        
        // Task-specific analysis
        const taskLower = task.toLowerCase();
        if (taskLower.includes('email') || taskLower.includes('message')) {
            recommendations.push('For communication tasks, consider user context and tone');
        }
        
        if (taskLower.includes('search') || taskLower.includes('find')) {
            recommendations.push('For search tasks, try specific keywords before broad queries');
        }
        
        if (taskLower.includes('analyze') || taskLower.includes('report')) {
            recommendations.push('For analysis tasks, gather data first then synthesize insights');
        }
        
        return recommendations;
    }

    /**
     * Generate learning insights from execution
     */
    static generateLearningInsights(params: LearnFromExecutionParams, pattern?: CommandMapPattern): any {
        const insights: any = {
            executionResult: params.success ? 'successful' : 'failed',
            toolName: params.toolName,
            executionTime: params.executionTime,
            learningValue: 'medium'
        };
        
        // Pattern-based insights
        if (pattern) {
            insights.patternInfo = {
                exists: true,
                confidence: pattern.confidence,
                totalUsage: pattern.usageStats.successCount + pattern.usageStats.failureCount,
                successRate: pattern.usageStats.successCount / 
                    Math.max(1, pattern.usageStats.successCount + pattern.usageStats.failureCount) * 100
            };
            
            if (params.success && pattern.confidence < 0.8) {
                insights.learningValue = 'high';
                insights.note = 'Successful execution will boost pattern confidence';
            }
            
            if (!params.success && pattern.confidence > 0.7) {
                insights.learningValue = 'high';
                insights.note = 'Unexpected failure for high-confidence pattern - investigation needed';
            }
        } else {
            insights.patternInfo = {
                exists: false,
                note: 'New tool usage - will create learning data for future reference'
            };
            insights.learningValue = 'high';
        }
        
        // Execution time insights
        if (params.executionTime > 10000) {
            insights.performanceNote = 'Slow execution - consider optimization';
        } else if (params.executionTime < 100) {
            insights.performanceNote = 'Very fast execution - good tool choice';
        }
        
        // User feedback insights
        if (params.userFeedback) {
            insights.userFeedback = {
                received: params.userFeedback,
                impact: params.userFeedback === 'positive' ? 'confidence_boost' :
                       params.userFeedback === 'negative' ? 'confidence_reduction' : 'neutral'
            };
        }
        
        // Context insights
        if (params.context) {
            insights.contextAvailable = true;
            insights.contextSize = JSON.stringify(params.context).length;
        }
        
        return insights;
    }

    /**
     * Analyze task complexity
     */
    static analyzeTaskComplexity(task: string): any {
        const words = task.toLowerCase().split(' ');
        const complexity = {
            wordCount: words.length,
            level: 'simple',
            factors: [] as string[],
            recommendations: [] as string[]
        };
        
        // Word count analysis
        if (words.length > 20) {
            complexity.level = 'complex';
            complexity.factors.push('Long description');
            complexity.recommendations.push('Consider breaking into smaller tasks');
        } else if (words.length > 10) {
            complexity.level = 'moderate';
            complexity.factors.push('Moderate length');
        }
        
        // Action word analysis
        const actionWords = ['create', 'analyze', 'generate', 'process', 'transform', 'calculate'];
        const foundActions = actionWords.filter(action => task.toLowerCase().includes(action));
        
        if (foundActions.length > 2) {
            complexity.level = 'complex';
            complexity.factors.push('Multiple actions required');
            complexity.recommendations.push('Sequence actions logically');
        }
        
        // Entity analysis
        const entityIndicators = ['file', 'data', 'email', 'report', 'document', 'image'];
        const foundEntities = entityIndicators.filter(entity => task.toLowerCase().includes(entity));
        
        if (foundEntities.length > 2) {
            complexity.factors.push('Multiple entity types');
            if (complexity.level === 'simple') complexity.level = 'moderate';
        }
        
        return complexity;
    }

    /**
     * Suggest task decomposition
     */
    static suggestTaskDecomposition(task: string): any {
        const complexity = this.analyzeTaskComplexity(task);
        
        if (complexity.level === 'simple') {
            return {
                needsDecomposition: false,
                reason: 'Task is simple enough for single execution'
            };
        }
        
        const decomposition = {
            needsDecomposition: true,
            suggestedSteps: [] as string[],
            reasoning: [] as string[]
        };
        
        const taskLower = task.toLowerCase();
        
        // Common patterns
        if (taskLower.includes('analyze') && taskLower.includes('report')) {
            decomposition.suggestedSteps = [
                'Gather and prepare data',
                'Perform analysis',
                'Generate insights',
                'Create report format',
                'Compile final report'
            ];
            decomposition.reasoning.push('Analysis and reporting require sequential steps');
        }
        
        if (taskLower.includes('email') && (taskLower.includes('send') || taskLower.includes('reply'))) {
            decomposition.suggestedSteps = [
                'Understand context and requirements',
                'Draft email content',
                'Review and refine message',
                'Send email'
            ];
            decomposition.reasoning.push('Email tasks benefit from careful composition');
        }
        
        if (taskLower.includes('search') || taskLower.includes('find')) {
            decomposition.suggestedSteps = [
                'Define search criteria',
                'Execute initial search',
                'Refine search if needed',
                'Analyze and filter results'
            ];
            decomposition.reasoning.push('Search tasks often require iteration');
        }
        
        // Generic decomposition if no specific pattern found
        if (decomposition.suggestedSteps.length === 0) {
            decomposition.suggestedSteps = [
                'Break down requirements',
                'Identify necessary tools',
                'Execute primary action',
                'Verify and refine results'
            ];
            decomposition.reasoning.push('Complex tasks benefit from systematic approach');
        }
        
        return decomposition;
    }

    /**
     * Analyze task success patterns
     */
    static analyzeTaskSuccessPatterns(task: string, patterns: CommandMapPattern[]): any {
        const taskWords = task.toLowerCase().split(' ');
        const relevantPatterns = patterns.filter(pattern => {
            const patternWords = pattern.trigger.toLowerCase().split(' ');
            return patternWords.some(word => taskWords.includes(word));
        });
        
        if (relevantPatterns.length === 0) {
            return {
                hasPatterns: false,
                recommendation: 'No similar patterns found - this will be a learning opportunity'
            };
        }
        
        const successRates = relevantPatterns.map(p => {
            const total = p.usageStats.successCount + p.usageStats.failureCount;
            return total > 0 ? p.usageStats.successCount / total : 0;
        });
        
        const avgSuccessRate = successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length;
        const highPerformers = relevantPatterns.filter(p => {
            const total = p.usageStats.successCount + p.usageStats.failureCount;
            return total > 0 && (p.usageStats.successCount / total) > 0.8;
        });
        
        return {
            hasPatterns: true,
            totalRelevantPatterns: relevantPatterns.length,
            averageSuccessRate: Math.round(avgSuccessRate * 100),
            highPerformers: highPerformers.length,
            recommendation: avgSuccessRate > 0.7 ? 
                'Good success patterns exist for similar tasks' :
                'Mixed results for similar tasks - proceed with caution',
            suggestedTools: highPerformers.slice(0, 3).map(p => p.toolName)
        };
    }
} 