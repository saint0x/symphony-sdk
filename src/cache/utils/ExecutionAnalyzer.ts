import { Pattern as CommandMapPattern } from '../map-processor';

interface ToolUsageStats {
    name: string;
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    avgExecutionTime: number;
    totalExecutionTime: number;
    successRate: number;
}

/**
 * Execution analysis utilities for ContextAPI
 */
export class ExecutionAnalyzer {
    
    /**
     * Calculate average execution time
     */
    static calculateAverageExecutionTime(executions: any[]): number {
        if (executions.length === 0) return 0;
        
        const totalTime = executions.reduce((sum, exec) => sum + (exec.execution_time_ms || 0), 0);
        return Math.round(totalTime / executions.length);
    }

    /**
     * Analyze tool usage patterns
     */
    static analyzeToolUsage(executions: any[]): ToolUsageStats[] {
        const toolUsage = new Map<string, any>();
        
        executions.forEach(exec => {
            const toolName = exec.tool_name;
            if (!toolUsage.has(toolName)) {
                toolUsage.set(toolName, {
                    name: toolName,
                    totalCalls: 0,
                    successfulCalls: 0,
                    failedCalls: 0,
                    avgExecutionTime: 0,
                    totalExecutionTime: 0
                });
            }
            
            const stats = toolUsage.get(toolName)!;
            stats.totalCalls++;
            stats.totalExecutionTime += exec.execution_time_ms || 0;
            
            if (exec.success) {
                stats.successfulCalls++;
            } else {
                stats.failedCalls++;
            }
            
            stats.avgExecutionTime = stats.totalExecutionTime / stats.totalCalls;
        });
        
        return Array.from(toolUsage.values())
            .sort((a, b) => b.totalCalls - a.totalCalls)
            .map(tool => ({
                ...tool,
                successRate: Math.round((tool.successfulCalls / tool.totalCalls) * 100),
                avgExecutionTime: Math.round(tool.avgExecutionTime)
            }));
    }

    /**
     * Analyze common failures
     */
    static analyzeCommonFailures(failedExecutions: any[]): any {
        const failureReasons = new Map<string, number>();
        const failuresByTool = new Map<string, number>();
        
        failedExecutions.forEach(exec => {
            // Count failure reasons
            const reason = exec.error_details || 'Unknown error';
            failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
            
            // Count failures by tool
            const toolName = exec.tool_name;
            failuresByTool.set(toolName, (failuresByTool.get(toolName) || 0) + 1);
        });
        
        return {
            totalFailures: failedExecutions.length,
            topFailureReasons: Array.from(failureReasons.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([reason, count]) => ({ reason, count })),
            failuresByTool: Array.from(failuresByTool.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([tool, count]) => ({ tool, count }))
        };
    }

    /**
     * Analyze performance trends
     */
    static analyzePerformanceTrends(executions: any[]): any {
        if (executions.length === 0) return {};
        
        // Sort by timestamp
        const sortedExecutions = executions.sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
        
        const last24h = sortedExecutions.filter(e => 
            new Date(e.created_at).getTime() > oneDayAgo
        );
        const lastWeek = sortedExecutions.filter(e => 
            new Date(e.created_at).getTime() > oneWeekAgo
        );
        
        return {
            totalExecutions: executions.length,
            last24hExecutions: last24h.length,
            lastWeekExecutions: lastWeek.length,
            last24hSuccessRate: last24h.length > 0 ? 
                Math.round((last24h.filter(e => e.success).length / last24h.length) * 100) : 0,
            lastWeekSuccessRate: lastWeek.length > 0 ? 
                Math.round((lastWeek.filter(e => e.success).length / lastWeek.length) * 100) : 0,
            avgExecutionTime24h: this.calculateAverageExecutionTime(last24h),
            avgExecutionTimeWeek: this.calculateAverageExecutionTime(lastWeek),
            trend: this.calculateTrend(last24h, lastWeek)
        };
    }

    /**
     * Generate performance recommendations
     */
    static generatePerformanceRecommendations(executions: any[]): string[] {
        const recommendations: string[] = [];
        
        if (executions.length === 0) {
            recommendations.push('No execution data available for analysis');
            return recommendations;
        }
        
        const successRate = (executions.filter(e => e.success).length / executions.length) * 100;
        const avgTime = this.calculateAverageExecutionTime(executions);
        
        if (successRate < 70) {
            recommendations.push('Success rate is below 70% - review failing tool configurations');
        }
        
        if (avgTime > 5000) {
            recommendations.push('Average execution time is high - consider optimizing tool performance');
        }
        
        const toolUsage = this.analyzeToolUsage(executions);
        const problematicTools = toolUsage.filter((tool: ToolUsageStats) => tool.successRate < 60);
        
        if (problematicTools.length > 0) {
            recommendations.push(`Review tools with low success rates: ${problematicTools.map((t: ToolUsageStats) => t.name).join(', ')}`);
        }
        
        const highUsageTools = toolUsage.filter((tool: ToolUsageStats) => tool.totalCalls > executions.length * 0.3);
        if (highUsageTools.length > 0) {
            recommendations.push(`Consider caching for frequently used tools: ${highUsageTools.map((t: ToolUsageStats) => t.name).join(', ')}`);
        }
        
        return recommendations;
    }

    /**
     * Analyze current performance metrics
     */
    static analyzeCurrentPerformance(executions: any[]): any {
        if (executions.length === 0) {
            return { noData: true };
        }
        
        const successCount = executions.filter(e => e.success).length;
        const totalTime = executions.reduce((sum, e) => sum + (e.execution_time_ms || 0), 0);
        
        return {
            totalExecutions: executions.length,
            successRate: Math.round((successCount / executions.length) * 100),
            averageExecutionTime: Math.round(totalTime / executions.length),
            totalExecutionTime: totalTime,
            performance: successCount / executions.length > 0.8 ? 'good' : 
                        successCount / executions.length > 0.6 ? 'fair' : 'poor'
        };
    }

    /**
     * Identify performance bottlenecks
     */
    static identifyBottlenecks(executions: any[]): any[] {
        const bottlenecks: any[] = [];
        
        const toolUsage = this.analyzeToolUsage(executions);
        const avgTime = this.calculateAverageExecutionTime(executions);
        
        // Slow tools
        const slowTools = toolUsage.filter((tool: ToolUsageStats) => tool.avgExecutionTime > avgTime * 2);
        slowTools.forEach((tool: ToolUsageStats) => {
            bottlenecks.push({
                type: 'slow_execution',
                tool: tool.name,
                impact: 'high',
                description: `${tool.name} takes ${tool.avgExecutionTime}ms on average (${Math.round(tool.avgExecutionTime / avgTime)}x slower than average)`
            });
        });
        
        // Frequently failing tools
        const unreliableTools = toolUsage.filter((tool: ToolUsageStats) => tool.successRate < 70 && tool.totalCalls > 5);
        unreliableTools.forEach((tool: ToolUsageStats) => {
            bottlenecks.push({
                type: 'high_failure_rate',
                tool: tool.name,
                impact: 'medium',
                description: `${tool.name} has ${tool.successRate}% success rate with ${tool.failedCalls} failures`
            });
        });
        
        return bottlenecks;
    }

    /**
     * Identify optimization opportunities
     */
    static identifyOptimizationOpportunities(executions: any[], patterns: CommandMapPattern[]): any[] {
        const opportunities: any[] = [];
        
        const toolUsage = this.analyzeToolUsage(executions);
        
        // High-usage tools that could benefit from caching
        const cachingCandidates = toolUsage.filter((tool: ToolUsageStats) => 
            tool.totalCalls > 10 && tool.successRate > 80
        );
        
        cachingCandidates.forEach((tool: ToolUsageStats) => {
            opportunities.push({
                type: 'caching',
                tool: tool.name,
                potential: 'high',
                description: `${tool.name} used ${tool.totalCalls} times with ${tool.successRate}% success - good caching candidate`
            });
        });
        
        // Patterns with room for improvement
        const improvablePatterns = patterns.filter(p => {
            const usage = p.usageStats.successCount + p.usageStats.failureCount;
            return usage > 5 && p.confidence < 0.8;
        });
        
        improvablePatterns.forEach(pattern => {
            opportunities.push({
                type: 'pattern_optimization',
                tool: pattern.toolName,
                potential: 'medium',
                description: `Pattern "${pattern.trigger}" has ${pattern.confidence} confidence with room for improvement`
            });
        });
        
        return opportunities;
    }

    /**
     * Generate optimization recommendations
     */
    static generateOptimizationRecommendations(executions: any[], patterns: CommandMapPattern[]): string[] {
        const recommendations: string[] = [];
        
        const bottlenecks = this.identifyBottlenecks(executions);
        const opportunities = this.identifyOptimizationOpportunities(executions, patterns);
        
        if (bottlenecks.length > 0) {
            recommendations.push(`Address ${bottlenecks.length} performance bottlenecks`);
        }
        
        if (opportunities.length > 0) {
            const cachingOps = opportunities.filter(o => o.type === 'caching').length;
            if (cachingOps > 0) {
                recommendations.push(`Implement caching for ${cachingOps} high-usage tools`);
            }
            
            const patternOps = opportunities.filter(o => o.type === 'pattern_optimization').length;
            if (patternOps > 0) {
                recommendations.push(`Optimize ${patternOps} underperforming patterns`);
            }
        }
        
        return recommendations;
    }

    /**
     * Estimate optimization impact
     */
    static estimateOptimizationImpact(executions: any[]): any {
        if (executions.length === 0) return {};
        
        const currentPerf = this.analyzeCurrentPerformance(executions);
        const bottlenecks = this.identifyBottlenecks(executions);
        
        // Estimate potential improvements
        let potentialTimeReduction = 0;
        let potentialSuccessIncrease = 0;
        
        bottlenecks.forEach(bottleneck => {
            if (bottleneck.type === 'slow_execution') {
                potentialTimeReduction += 0.3; // 30% improvement estimate
            }
            if (bottleneck.type === 'high_failure_rate') {
                potentialSuccessIncrease += 0.15; // 15% improvement estimate
            }
        });
        
        return {
            currentSuccessRate: currentPerf.successRate,
            currentAvgTime: currentPerf.averageExecutionTime,
            estimatedSuccessRateImprovement: Math.min(95, currentPerf.successRate + (potentialSuccessIncrease * 100)),
            estimatedTimeReduction: Math.round(currentPerf.averageExecutionTime * (1 - potentialTimeReduction)),
            confidenceLevel: bottlenecks.length > 0 ? 'medium' : 'low'
        };
    }

    /**
     * Calculate trend direction
     */
    private static calculateTrend(recent: any[], older: any[]): string {
        if (recent.length === 0 || older.length === 0) return 'insufficient_data';
        
        const recentSuccessRate = recent.filter(e => e.success).length / recent.length;
        const olderSuccessRate = older.filter(e => e.success).length / older.length;
        
        if (recentSuccessRate > olderSuccessRate + 0.1) return 'improving';
        if (recentSuccessRate < olderSuccessRate - 0.1) return 'declining';
        return 'stable';
    }
} 