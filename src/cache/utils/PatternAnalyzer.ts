import { Pattern as CommandMapPattern } from '../map-processor';

/**
 * Pattern analysis utilities for ContextAPI
 */
export class PatternAnalyzer {
    
    /**
     * Calculate match strength between task and pattern
     */
    static calculateMatchStrength(task: string, pattern: CommandMapPattern): number {
        const taskLower = task.toLowerCase();
        const triggerLower = pattern.trigger.toLowerCase();
        const toolLower = pattern.toolName.toLowerCase();
        
        // Exact matches get highest score
        if (taskLower === triggerLower) return 1.0;
        if (taskLower.includes(toolLower)) return 0.8;
        
        // Partial matches
        const triggerWords = triggerLower.split(' ');
        const taskWords = taskLower.split(' ');
        
        const matchingWords = triggerWords.filter(word => 
            taskWords.some(taskWord => taskWord.includes(word) || word.includes(taskWord))
        );
        
        return Math.min(0.9, matchingWords.length / Math.max(triggerWords.length, taskWords.length));
    }

    /**
     * Calculate pattern success rate
     */
    static calculatePatternSuccessRate(pattern: CommandMapPattern): number {
        const total = pattern.usageStats.successCount + pattern.usageStats.failureCount;
        return total > 0 ? Math.round((pattern.usageStats.successCount / total) * 100) : 0;
    }

    /**
     * Identify issues with a pattern
     */
    static identifyPatternIssues(pattern: CommandMapPattern): string[] {
        const issues: string[] = [];
        
        if (pattern.confidence < 0.3) {
            issues.push('Very low confidence');
        }
        
        const successRate = this.calculatePatternSuccessRate(pattern);
        if (successRate < 30) {
            issues.push('Low success rate');
        }
        
        const totalUsage = pattern.usageStats.successCount + pattern.usageStats.failureCount;
        if (totalUsage < 3) {
            issues.push('Insufficient usage data');
        }
        
        const daysSinceLastUsed = pattern.usageStats.lastUsed ? 
            (Date.now() - new Date(pattern.usageStats.lastUsed).getTime()) / (1000 * 60 * 60 * 24) : 
            999;
        
        if (daysSinceLastUsed > 30) {
            issues.push('Not used recently');
        }
        
        return issues;
    }

    /**
     * Analyze pattern trends
     */
    static analyzePatternTrends(patterns: CommandMapPattern[]): any {
        if (patterns.length === 0) return {};
        
        const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
        const highPerformers = patterns.filter(p => this.calculatePatternSuccessRate(p) > 80).length;
        const lowPerformers = patterns.filter(p => this.calculatePatternSuccessRate(p) < 40).length;
        
        return {
            averageConfidence: Math.round(avgConfidence * 100) / 100,
            highPerformers,
            lowPerformers,
            totalPatterns: patterns.length,
            utilizationRate: patterns.filter(p => 
                (p.usageStats.successCount + p.usageStats.failureCount) > 0
            ).length / patterns.length
        };
    }

    /**
     * Generate pattern recommendations
     */
    static generatePatternRecommendations(patterns: CommandMapPattern[]): string[] {
        const recommendations: string[] = [];
        
        const lowConfidencePatterns = patterns.filter(p => p.confidence < 0.5);
        if (lowConfidencePatterns.length > 0) {
            recommendations.push(`Review ${lowConfidencePatterns.length} low-confidence patterns`);
        }
        
        const unusedPatterns = patterns.filter(p => 
            (p.usageStats.successCount + p.usageStats.failureCount) === 0
        );
        if (unusedPatterns.length > 0) {
            recommendations.push(`Consider removing ${unusedPatterns.length} unused patterns`);
        }
        
        const highPerformers = patterns.filter(p => this.calculatePatternSuccessRate(p) > 90);
        if (highPerformers.length > 0) {
            recommendations.push(`Leverage insights from ${highPerformers.length} high-performing patterns`);
        }
        
        return recommendations;
    }
} 