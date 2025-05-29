/**
 * Pipeline Intelligence Service
 * 
 * Provides enhanced error recovery strategies and comprehensive performance monitoring
 * for pipeline execution with intelligent optimization recommendations.
 */

import { Logger } from '../utils/logger';
import { PipelineStepDefinition, PipelineContext, PipelineStepResult } from './executor';

// === ERROR RECOVERY INTERFACES ===

export interface BackoffStrategy {
  type: 'linear' | 'exponential' | 'jittery' | 'fixed' | 'custom';
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier?: number;
  jitterRatio?: number;
  customCalculator?: (attempt: number, baseDelay: number) => number;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  recoveryTimeoutMs: number;
  halfOpenRetryCount: number;
}

export interface EnhancedRetryPolicy {
  maxRetries: number;
  retryOn: string[];
  backoffStrategy: BackoffStrategy;
  circuitBreaker?: CircuitBreakerConfig;
  timeoutMs?: number;
  retryableErrorPatterns: RegExp[];
  criticalErrorPatterns: RegExp[];
}

export interface FailureAnalysis {
  stepId: string;
  errorCategory: 'transient' | 'persistent' | 'critical' | 'resource' | 'timeout';
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRetryable: boolean;
  suggestedAction: 'retry' | 'skip' | 'fallback' | 'abort';
  confidence: number;
  reasoning: string;
}

// === PERFORMANCE MONITORING INTERFACES ===

export interface PerformanceMetrics {
  stepId: string;
  duration: number;
  memoryUsage?: number;
  cpuUsage?: number;
  networkIO?: number;
  diskIO?: number;
  resourceUtilization: Record<string, number>;
  bottleneckFactors: string[];
}

export interface PipelinePerformanceProfile {
  pipelineId: string;
  totalDuration: number;
  stepMetrics: PerformanceMetrics[];
  bottlenecks: Array<{
    stepId: string;
    type: 'cpu' | 'memory' | 'network' | 'disk' | 'dependency' | 'coordination';
    severity: number;
    impact: number;
    recommendation: string;
  }>;
  optimization: {
    parallelizationOpportunities: string[];
    resourceOptimizations: string[];
    architecturalRecommendations: string[];
    estimatedImprovement: number;
  };
  trends: {
    averageDuration: number;
    successRate: number;
    errorPatterns: Record<string, number>;
    performanceTrend: 'improving' | 'degrading' | 'stable';
  };
}

export interface OptimizationRecommendation {
  category: 'parallelization' | 'resource' | 'architecture' | 'configuration';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  implementation: string;
  estimatedImprovement: number;
  effort: 'minimal' | 'moderate' | 'significant';
  impact: 'performance' | 'reliability' | 'cost' | 'scalability';
}

// === CIRCUIT BREAKER STATE ===

enum CircuitBreakerState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Blocking calls
  HALF_OPEN = 'half_open' // Testing recovery
}

interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  halfOpenAttempts: number;
}

// === MAIN PIPELINE INTELLIGENCE SERVICE ===

export class PipelineIntelligence {
  private logger: Logger;
  private circuitBreakers: Map<string, CircuitBreakerStatus>;
  private performanceHistory: Map<string, PerformanceMetrics[]>;
  private errorPatterns: Map<string, Array<{ error: string; timestamp: number; stepId: string }>>;
  private executionProfiles: Map<string, PipelinePerformanceProfile>;

  constructor() {
    this.logger = Logger.getInstance('PipelineIntelligence');
    this.circuitBreakers = new Map();
    this.performanceHistory = new Map();
    this.errorPatterns = new Map();
    this.executionProfiles = new Map();
  }

  // === ENHANCED ERROR RECOVERY ===

  async executeStepWithEnhancedRecovery(
    step: PipelineStepDefinition,
    context: PipelineContext,
    executeStepFn: (step: PipelineStepDefinition) => Promise<PipelineStepResult>
  ): Promise<PipelineStepResult> {
    const retryPolicy = this.buildEnhancedRetryPolicy(step);
    const stepKey = `${context.pipelineId}_${step.id}`;

    this.logger.info('PipelineIntelligence', `Executing step with enhanced recovery: ${step.id}`, {
      retryPolicy: {
        maxRetries: retryPolicy.maxRetries,
        backoffType: retryPolicy.backoffStrategy.type,
        circuitBreakerEnabled: retryPolicy.circuitBreaker?.enabled
      }
    });

    // Check circuit breaker
    if (retryPolicy.circuitBreaker?.enabled && this.isCircuitOpen(stepKey, retryPolicy.circuitBreaker)) {
      return this.createCircuitBreakerResult(step.id);
    }

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= retryPolicy.maxRetries) {
      try {
        const startTime = Date.now();
        
        // Execute step with timeout
        const result = await this.executeWithTimeout(
          executeStepFn(step),
          retryPolicy.timeoutMs || 300000 // 5 minute default
        );

        // Record success for circuit breaker
        if (retryPolicy.circuitBreaker?.enabled) {
          this.recordCircuitBreakerSuccess(stepKey);
        }

        // Analyze performance
        await this.recordPerformanceMetrics(step.id, Date.now() - startTime, context);

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        // Analyze failure
        const failureAnalysis = await this.analyzeFailure(step.id, lastError, attempt);
        
        this.logger.warn('PipelineIntelligence', `Step execution failed: ${step.id}`, {
          attempt,
          maxRetries: retryPolicy.maxRetries,
          error: lastError.message,
          analysis: failureAnalysis
        });

        // Record error pattern
        this.recordErrorPattern(context.pipelineId, step.id, lastError.message);

        // Check if should retry
        if (attempt > retryPolicy.maxRetries || !failureAnalysis.isRetryable) {
          // Record circuit breaker failure
          if (retryPolicy.circuitBreaker?.enabled) {
            this.recordCircuitBreakerFailure(stepKey, retryPolicy.circuitBreaker);
          }
          break;
        }

        // Apply backoff strategy
        const delay = this.calculateBackoffDelay(retryPolicy.backoffStrategy, attempt);
        
        this.logger.info('PipelineIntelligence', `Retrying step after backoff: ${step.id}`, {
          attempt: attempt + 1,
          delay,
          strategy: retryPolicy.backoffStrategy.type
        });

        await this.wait(delay);
      }
    }

    // All retries exhausted
    return {
      stepId: step.id,
      success: false,
      error: lastError?.message || 'Unknown error after all retries',
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      retryCount: attempt,
      failureAnalysis: await this.analyzeFailure(step.id, lastError!, attempt)
    };
  }

  private buildEnhancedRetryPolicy(step: PipelineStepDefinition): EnhancedRetryPolicy {
    const basePolicy = step.retryPolicy;
    
    return {
      maxRetries: basePolicy?.maxRetries || 3,
      retryOn: basePolicy?.retryOn || ['timeout', 'network', 'temporary'],
      backoffStrategy: {
        type: 'exponential',
        baseDelayMs: basePolicy?.backoffMs || 1000,
        maxDelayMs: 30000,
        multiplier: 2,
        jitterRatio: 0.1
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        recoveryTimeoutMs: 60000,
        halfOpenRetryCount: 3
      },
      timeoutMs: step.timeout || 300000,
      retryableErrorPatterns: [
        /timeout/i,
        /network/i,
        /temporary/i,
        /rate.?limit/i,
        /service.?unavailable/i,
        /connection/i
      ],
      criticalErrorPatterns: [
        /authentication/i,
        /authorization/i,
        /permission/i,
        /not.?found/i,
        /invalid.?input/i
      ]
    };
  }

  private async analyzeFailure(stepId: string, error: Error, attempt: number): Promise<FailureAnalysis> {
    const errorMessage = error.message.toLowerCase();
    
    // Categorize error
    let errorCategory: FailureAnalysis['errorCategory'] = 'persistent';
    let severity: FailureAnalysis['severity'] = 'medium';
    let isRetryable = true;
    let suggestedAction: FailureAnalysis['suggestedAction'] = 'retry';

    if (/timeout|network|connection/.test(errorMessage)) {
      errorCategory = 'transient';
      severity = 'low';
      isRetryable = true;
      suggestedAction = 'retry';
    } else if (/memory|cpu|resource/.test(errorMessage)) {
      errorCategory = 'resource';
      severity = 'high';
      isRetryable = attempt <= 2; // Limited retries for resource issues
      suggestedAction = isRetryable ? 'retry' : 'fallback';
    } else if (/authentication|authorization|permission/.test(errorMessage)) {
      errorCategory = 'critical';
      severity = 'critical';
      isRetryable = false;
      suggestedAction = 'abort';
    } else if (/not.?found|invalid/.test(errorMessage)) {
      errorCategory = 'persistent';
      severity = 'high';
      isRetryable = false;
      suggestedAction = 'skip';
    }

    const confidence = this.calculateAnalysisConfidence(errorMessage, attempt);

    return {
      stepId,
      errorCategory,
      severity,
      isRetryable,
      suggestedAction,
      confidence,
      reasoning: `Error categorized as ${errorCategory} with ${severity} severity based on pattern analysis`
    };
  }

  private calculateBackoffDelay(strategy: BackoffStrategy, attempt: number): number {
    let delay: number;

    switch (strategy.type) {
      case 'linear':
        delay = strategy.baseDelayMs * attempt;
        break;
      
      case 'exponential':
        delay = strategy.baseDelayMs * Math.pow(strategy.multiplier || 2, attempt - 1);
        break;
      
      case 'jittery':
        const exponentialDelay = strategy.baseDelayMs * Math.pow(strategy.multiplier || 2, attempt - 1);
        const jitter = exponentialDelay * (strategy.jitterRatio || 0.1) * Math.random();
        delay = exponentialDelay + jitter;
        break;
      
      case 'fixed':
        delay = strategy.baseDelayMs;
        break;
      
      case 'custom':
        delay = strategy.customCalculator ? 
          strategy.customCalculator(attempt, strategy.baseDelayMs) : 
          strategy.baseDelayMs;
        break;
      
      default:
        delay = strategy.baseDelayMs;
    }

    return Math.min(delay, strategy.maxDelayMs);
  }

  // === CIRCUIT BREAKER IMPLEMENTATION ===

  private isCircuitOpen(stepKey: string, config: CircuitBreakerConfig): boolean {
    const status = this.circuitBreakers.get(stepKey);
    if (!status) return false;

    const now = Date.now();

    switch (status.state) {
      case CircuitBreakerState.CLOSED:
        return false;
      
      case CircuitBreakerState.OPEN:
        if (now >= status.nextAttemptTime) {
          // Move to half-open state
          status.state = CircuitBreakerState.HALF_OPEN;
          status.halfOpenAttempts = 0;
          this.logger.info('PipelineIntelligence', `Circuit breaker moving to half-open: ${stepKey}`);
          return false;
        }
        return true;
      
      case CircuitBreakerState.HALF_OPEN:
        return status.halfOpenAttempts >= config.halfOpenRetryCount;
      
      default:
        return false;
    }
  }

  private recordCircuitBreakerFailure(stepKey: string, config: CircuitBreakerConfig): void {
    let status = this.circuitBreakers.get(stepKey);
    if (!status) {
      status = {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        halfOpenAttempts: 0
      };
      this.circuitBreakers.set(stepKey, status);
    }

    status.failureCount++;
    status.lastFailureTime = Date.now();

    if (status.state === CircuitBreakerState.HALF_OPEN) {
      // Move back to open
      status.state = CircuitBreakerState.OPEN;
      status.nextAttemptTime = Date.now() + config.recoveryTimeoutMs;
      this.logger.warn('PipelineIntelligence', `Circuit breaker reopening: ${stepKey}`);
    } else if (status.failureCount >= config.failureThreshold) {
      // Open the circuit
      status.state = CircuitBreakerState.OPEN;
      status.nextAttemptTime = Date.now() + config.recoveryTimeoutMs;
      this.logger.warn('PipelineIntelligence', `Circuit breaker opening: ${stepKey}`, {
        failureCount: status.failureCount,
        threshold: config.failureThreshold
      });
    }
  }

  private recordCircuitBreakerSuccess(stepKey: string): void {
    const status = this.circuitBreakers.get(stepKey);
    if (!status) return;

    if (status.state === CircuitBreakerState.HALF_OPEN) {
      status.halfOpenAttempts++;
      if (status.halfOpenAttempts >= 3) { // Successful attempts threshold
        status.state = CircuitBreakerState.CLOSED;
        status.failureCount = 0;
        this.logger.info('PipelineIntelligence', `Circuit breaker closing: ${stepKey}`);
      }
    } else if (status.state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success
      status.failureCount = Math.max(0, status.failureCount - 1);
    }
  }

  private createCircuitBreakerResult(stepId: string): PipelineStepResult {
    return {
      stepId,
      success: false,
      error: 'Circuit breaker is open - step execution blocked',
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      retryCount: 0,
      circuitBreakerTripped: true
    };
  }

  // === PERFORMANCE MONITORING ===

  private async recordPerformanceMetrics(stepId: string, duration: number, context: PipelineContext): Promise<void> {
    const metrics: PerformanceMetrics = {
      stepId,
      duration,
      memoryUsage: await this.getMemoryUsage(),
      resourceUtilization: await this.getResourceUtilization(),
      bottleneckFactors: await this.identifyBottleneckFactors(stepId, duration)
    };

    // Store metrics
    if (!this.performanceHistory.has(context.pipelineId)) {
      this.performanceHistory.set(context.pipelineId, []);
    }
    this.performanceHistory.get(context.pipelineId)!.push(metrics);

    this.logger.info('PipelineIntelligence', `Performance metrics recorded: ${stepId}`, {
      duration,
      bottlenecks: metrics.bottleneckFactors.length
    });
  }

  async generatePerformanceProfile(pipelineId: string, _context: PipelineContext): Promise<PipelinePerformanceProfile> {
    const stepMetrics = this.performanceHistory.get(pipelineId) || [];
    const totalDuration = stepMetrics.reduce((sum, m) => sum + m.duration, 0);

    // Identify bottlenecks
    const bottlenecks = await this.identifyBottlenecks(stepMetrics);
    
    // Generate optimization recommendations
    const optimization = await this.generateOptimizationRecommendations(stepMetrics, bottlenecks);
    
    // Calculate trends
    const trends = await this.calculatePerformanceTrends(pipelineId);

    const profile: PipelinePerformanceProfile = {
      pipelineId,
      totalDuration,
      stepMetrics,
      bottlenecks,
      optimization,
      trends
    };

    this.executionProfiles.set(pipelineId, profile);

    this.logger.info('PipelineIntelligence', `Performance profile generated: ${pipelineId}`, {
      totalDuration,
      stepCount: stepMetrics.length,
      bottleneckCount: bottlenecks.length,
      optimizationOpportunities: optimization.parallelizationOpportunities.length
    });

    return profile;
  }

  private async identifyBottlenecks(stepMetrics: PerformanceMetrics[]): Promise<PipelinePerformanceProfile['bottlenecks']> {
    const bottlenecks: PipelinePerformanceProfile['bottlenecks'] = [];
    const averageDuration = stepMetrics.reduce((sum, m) => sum + m.duration, 0) / stepMetrics.length;

    for (const metrics of stepMetrics) {
      // Duration-based bottlenecks
      if (metrics.duration > averageDuration * 2) {
        bottlenecks.push({
          stepId: metrics.stepId,
          type: 'dependency',
          severity: metrics.duration / averageDuration,
          impact: (metrics.duration / stepMetrics.reduce((sum, m) => sum + m.duration, 0)) * 100,
          recommendation: `Step ${metrics.stepId} takes ${Math.round(metrics.duration)}ms (${Math.round(metrics.duration / averageDuration)}x average). Consider optimizing or parallelizing.`
        });
      }

      // Resource-based bottlenecks
      if (metrics.memoryUsage && metrics.memoryUsage > 80) {
        bottlenecks.push({
          stepId: metrics.stepId,
          type: 'memory',
          severity: metrics.memoryUsage / 100,
          impact: 75,
          recommendation: `High memory usage (${metrics.memoryUsage}%). Consider memory optimization.`
        });
      }

      // Bottleneck factors
      if (metrics.bottleneckFactors.length > 0) {
        bottlenecks.push({
          stepId: metrics.stepId,
          type: 'coordination',
          severity: metrics.bottleneckFactors.length / 5,
          impact: 50,
          recommendation: `Multiple bottleneck factors detected: ${metrics.bottleneckFactors.join(', ')}`
        });
      }
    }

    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  private async generateOptimizationRecommendations(
    stepMetrics: PerformanceMetrics[],
    bottlenecks: PipelinePerformanceProfile['bottlenecks']
  ): Promise<PipelinePerformanceProfile['optimization']> {
    const parallelizationOpportunities: string[] = [];
    const resourceOptimizations: string[] = [];
    const architecturalRecommendations: string[] = [];

    // Analyze parallelization opportunities
    const independentSteps = stepMetrics.filter(m => !m.bottleneckFactors.includes('dependency'));
    if (independentSteps.length > 1) {
      parallelizationOpportunities.push(
        `Steps ${independentSteps.map(s => s.stepId).join(', ')} appear to be independent and could be parallelized`
      );
    }

    // Resource optimization recommendations
    const highMemorySteps = stepMetrics.filter(m => m.memoryUsage && m.memoryUsage > 60);
    if (highMemorySteps.length > 0) {
      resourceOptimizations.push(
        `Memory optimization needed for steps: ${highMemorySteps.map(s => s.stepId).join(', ')}`
      );
    }

    // Architectural recommendations
    const slowSteps = stepMetrics.filter(m => m.duration > 5000); // > 5 seconds
    if (slowSteps.length > 0) {
      architecturalRecommendations.push(
        `Consider breaking down long-running steps: ${slowSteps.map(s => s.stepId).join(', ')}`
      );
    }

    if (bottlenecks.length > 3) {
      architecturalRecommendations.push(
        'Multiple bottlenecks detected - consider pipeline redesign for better performance'
      );
    }

    // Estimate improvement
    const totalCurrentDuration = stepMetrics.reduce((sum, m) => sum + m.duration, 0);
    const parallelizableTime = independentSteps.reduce((sum, m) => sum + m.duration, 0);
    const estimatedImprovement = parallelizableTime > 0 ? 
      Math.min(50, (parallelizableTime / totalCurrentDuration) * 40) : 0;

    return {
      parallelizationOpportunities,
      resourceOptimizations,
      architecturalRecommendations,
      estimatedImprovement
    };
  }

  // === UTILITY METHODS ===

  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Step execution timeout')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async getMemoryUsage(): Promise<number> {
    // In a real implementation, this would get actual memory usage
    // For now, return a simulated value
    return Math.random() * 100;
  }

  private async getResourceUtilization(): Promise<Record<string, number>> {
    // Simulated resource utilization
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      network: Math.random() * 100,
      disk: Math.random() * 100
    };
  }

  private async identifyBottleneckFactors(_stepId: string, duration: number): Promise<string[]> {
    const factors: string[] = [];
    
    if (duration > 10000) factors.push('long_duration');
    if (Math.random() > 0.7) factors.push('network_latency');
    if (Math.random() > 0.8) factors.push('dependency_wait');
    
    return factors;
  }

  private recordErrorPattern(pipelineId: string, stepId: string, error: string): void {
    const key = `${pipelineId}_${stepId}`;
    if (!this.errorPatterns.has(key)) {
      this.errorPatterns.set(key, []);
    }
    
    this.errorPatterns.get(key)!.push({
      error,
      timestamp: Date.now(),
      stepId
    });

    // Keep only recent errors (last 100)
    const patterns = this.errorPatterns.get(key)!;
    if (patterns.length > 100) {
      this.errorPatterns.set(key, patterns.slice(-100));
    }
  }

  private calculateAnalysisConfidence(errorMessage: string, attempt: number): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on error pattern matching
    if (/timeout|network|connection/.test(errorMessage)) confidence += 0.3;
    if (/authentication|authorization/.test(errorMessage)) confidence += 0.4;
    if (/not.?found|invalid/.test(errorMessage)) confidence += 0.3;

    // Decrease confidence with more attempts (less certain about transient vs persistent)
    confidence -= (attempt - 1) * 0.1;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private async calculatePerformanceTrends(pipelineId: string): Promise<PipelinePerformanceProfile['trends']> {
    const errorPatterns = this.errorPatterns.get(pipelineId) || [];
    const errorCounts: Record<string, number> = {};
    
    errorPatterns.forEach(e => {
      const category = e.error.split(' ')[0].toLowerCase();
      errorCounts[category] = (errorCounts[category] || 0) + 1;
    });

    return {
      averageDuration: 5000, // Simulated
      successRate: 0.95, // Simulated
      errorPatterns: errorCounts,
      performanceTrend: 'stable' // Simulated
    };
  }

  // === PUBLIC API ===

  getPerformanceProfile(pipelineId: string): PipelinePerformanceProfile | undefined {
    return this.executionProfiles.get(pipelineId);
  }

  getCircuitBreakerStatus(stepKey: string): CircuitBreakerStatus | undefined {
    return this.circuitBreakers.get(stepKey);
  }

  resetCircuitBreaker(stepKey: string): void {
    this.circuitBreakers.delete(stepKey);
    this.logger.info('PipelineIntelligence', `Circuit breaker reset: ${stepKey}`);
  }

  getOptimizationRecommendations(pipelineId: string): OptimizationRecommendation[] {
    const profile = this.executionProfiles.get(pipelineId);
    if (!profile) return [];

    const recommendations: OptimizationRecommendation[] = [];

    // Convert optimization insights to recommendations
    profile.optimization.parallelizationOpportunities.forEach(opp => {
      recommendations.push({
        category: 'parallelization',
        priority: 'medium',
        description: opp,
        implementation: 'Modify pipeline definition to enable parallel execution',
        estimatedImprovement: 25,
        effort: 'moderate',
        impact: 'performance'
      });
    });

    profile.optimization.resourceOptimizations.forEach(opt => {
      recommendations.push({
        category: 'resource',
        priority: 'high',
        description: opt,
        implementation: 'Optimize memory usage in identified steps',
        estimatedImprovement: 15,
        effort: 'moderate',
        impact: 'performance'
      });
    });

    return recommendations;
  }

  getHealthMetrics(): any {
    return {
      circuitBreakers: {
        total: this.circuitBreakers.size,
        open: Array.from(this.circuitBreakers.values()).filter(cb => cb.state === CircuitBreakerState.OPEN).length,
        halfOpen: Array.from(this.circuitBreakers.values()).filter(cb => cb.state === CircuitBreakerState.HALF_OPEN).length
      },
      performanceProfiles: this.executionProfiles.size,
      errorPatterns: this.errorPatterns.size
    };
  }
} 