import { v4 as uuidv4 } from 'uuid';
import { AgentConfig } from '../types/sdk';
import {
  RuntimeContext as IRuntimeContext,
  RuntimeSnapshot,
  ExecutionPlan,
  ExecutionStep,
  Insight,
  RuntimeError,
  PlannedStep,
  Reflection
} from './RuntimeTypes';

/**
 * Production-grade runtime context implementation
 * Manages execution state, memory, and insights throughout task execution
 */
export class RuntimeContext implements IRuntimeContext {
  public readonly sessionId: string;
  public readonly agentConfig: AgentConfig;
  public readonly createdAt: number;

  // Execution state
  public currentPlan?: ExecutionPlan;
  public executionHistory: ExecutionStep[] = [];
  public workingMemory: Map<string, any> = new Map();
  public insights: Insight[] = [];
  public errorHistory: RuntimeError[] = [];

  // Context management
  public currentStep: number = 0;
  public totalSteps: number = 0;
  public remainingSteps?: PlannedStep[];

  // Private state for optimization
  private _reflections: Reflection[] = [];
  // private _lastSnapshot?: RuntimeSnapshot; // Reserved for future caching optimization
  private _memorySize: number = 0;
  private readonly _maxMemorySize: number = 50 * 1024 * 1024; // 50MB limit

  constructor(agentConfig: AgentConfig, sessionId?: string) {
    this.sessionId = sessionId || uuidv4();
    this.agentConfig = agentConfig;
    this.createdAt = Date.now();
  }

  /**
   * Set execution plan and update context state
   */
  setExecutionPlan(plan: ExecutionPlan): void {
    this.currentPlan = plan;
    this.totalSteps = plan.steps.length;
    this.remainingSteps = [...plan.steps];
    this.currentStep = 0;
  }

  /**
   * Update execution plan with new steps (for adaptation)
   */
  updateExecutionPlan(plan: ExecutionPlan): void {
    if (!this.currentPlan) {
      this.setExecutionPlan(plan);
      return;
    }

    const previousStep = this.currentStep;
    this.currentPlan = plan;
    this.totalSteps = plan.steps.length;
    
    // Adjust remaining steps based on current progress
    this.remainingSteps = plan.steps.slice(previousStep);
    
    // Add insight about plan adaptation
    this.addInsight({
      id: uuidv4(),
      type: 'strategy_improvement',
      description: `Execution plan adapted: ${plan.steps.length} total steps, ${this.remainingSteps.length} remaining`,
      confidence: 0.8,
      source: 'plan_adaptation',
      timestamp: Date.now(),
      actionable: true
    });
  }

  /**
   * Add execution step and update context
   */
  addExecutionStep(stepData: Omit<ExecutionStep, 'stepId' | 'startTime' | 'endTime' | 'duration'>): ExecutionStep {
    const startTime = Date.now();
    // Complex logic here...
    const endTime = Date.now();
    const duration = endTime - startTime;

    const step: ExecutionStep = {
      ...stepData,
      stepId: uuidv4(),
      startTime,
      endTime,
      duration,
    };
    
    this.executionHistory.push(step);
    this.currentStep = this.executionHistory.length;
    
    // Update remaining steps if we have a plan
    if (this.remainingSteps && this.remainingSteps.length > 0) {
      this.remainingSteps = this.remainingSteps.slice(1);
    }

    // Store step result in working memory for reference
    this.setMemory(`step_${step.stepId}`, {
      result: step.result,
      success: step.success,
      duration: step.duration,
      timestamp: step.endTime
    });

    // Add reflection to internal tracking
    if (step.reflection) {
      this._reflections.push(step.reflection);
    }

    // Automatic memory cleanup if we're approaching limits
    this._cleanupMemoryIfNeeded();

    return step;
  }

  /**
   * Add insight with deduplication
   */
  addInsight(insight: Insight): void {
    // Check for duplicate insights
    const isDuplicate = this.insights.some(existing => 
      existing.type === insight.type && 
      existing.description === insight.description &&
      (Date.now() - existing.timestamp) < 60000 // Within 1 minute
    );

    if (!isDuplicate) {
      this.insights.push(insight);
      
      // Keep only the most recent 100 insights to prevent memory bloat
      if (this.insights.length > 100) {
        this.insights = this.insights.slice(-100);
      }
    }
  }

  /**
   * Add reflection with deduplication
   */
  addReflection(reflection: Reflection): void {
    // Basic check to avoid duplicate reflection entries
    const isDuplicate = this._reflections.some(existing => 
      existing.stepId === reflection.stepId &&
      existing.reasoning === reflection.reasoning
    );

    if (!isDuplicate) {
      this._reflections.push(reflection);
    }
  }

  /**
   * Get all reflections from execution history
   */
  getReflections(): Reflection[] {
    return [...this._reflections];
  }

  /**
   * Create immutable snapshot of current context
   */
  toSnapshot(): RuntimeSnapshot {
    const snapshot: RuntimeSnapshot = {
      sessionId: this.sessionId,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      executionHistory: this.executionHistory.map(step => ({ ...step })),
      insights: this.insights.map(insight => ({ ...insight })),
      timestamp: Date.now()
    };

    return snapshot;
  }

  // ==========================================
  // MEMORY MANAGEMENT METHODS
  // ==========================================

  /**
   * Set value in working memory with size tracking
   */
  setMemory(key: string, value: any): void {
    const serialized = JSON.stringify(value);
    const size = new Blob([serialized]).size;
    
    // Remove old value size if exists
    if (this.workingMemory.has(key)) {
      const oldValue = this.workingMemory.get(key);
      const oldSize = new Blob([JSON.stringify(oldValue)]).size;
      this._memorySize -= oldSize;
    }

    this.workingMemory.set(key, value);
    this._memorySize += size;

    // Cleanup if memory is too large
    this._cleanupMemoryIfNeeded();
  }

  /**
   * Get value from working memory
   */
  getMemory<T = any>(key: string): T | undefined {
    return this.workingMemory.get(key) as T;
  }

  /**
   * Get memory keys matching pattern
   */
  getMemoryKeys(pattern?: RegExp): string[] {
    const keys = Array.from(this.workingMemory.keys());
    return pattern ? keys.filter(key => pattern.test(key)) : keys;
  }

  /**
   * Clear specific memory key
   */
  clearMemory(key: string): boolean {
    if (this.workingMemory.has(key)) {
      const value = this.workingMemory.get(key);
      const size = new Blob([JSON.stringify(value)]).size;
      this._memorySize -= size;
      this.workingMemory.delete(key);
      return true;
    }
    return false;
  }

  // ==========================================
  // ERROR MANAGEMENT
  // ==========================================

  /**
   * Add runtime error with context
   */
  addError(error: Omit<RuntimeError, 'id' | 'timestamp'>): void {
    const runtimeError: RuntimeError = {
      id: uuidv4(),
      timestamp: Date.now(),
      ...error
    };

    this.errorHistory.push(runtimeError);

    // Keep only the most recent 50 errors
    if (this.errorHistory.length > 50) {
      this.errorHistory = this.errorHistory.slice(-50);
    }

    // Add insight for error pattern recognition
    if (this.errorHistory.length > 1) {
      const recentErrors = this.errorHistory.slice(-5);
      const errorPattern = this._detectErrorPattern(recentErrors);
      
      if (errorPattern) {
        this.addInsight({
          id: uuidv4(),
          type: 'error_prevention',
          description: errorPattern,
          confidence: 0.7,
          source: 'error_analysis',
          timestamp: Date.now(),
          actionable: true
        });
      }
    }
  }

  /**
   * Get recent errors by type
   */
  getRecentErrors(type?: RuntimeError['type'], limit: number = 10): RuntimeError[] {
    let errors = [...this.errorHistory].reverse(); // Most recent first
    
    if (type) {
      errors = errors.filter(error => error.type === type);
    }

    return errors.slice(0, limit);
  }

  // ==========================================
  // ANALYTICS & INSIGHTS
  // ==========================================

  /**
   * Get execution progress as percentage
   */
  getProgress(): number {
    if (this.totalSteps === 0) return 0;
    return Math.min((this.currentStep / this.totalSteps) * 100, 100);
  }

  /**
   * Get average step duration
   */
  getAverageStepDuration(): number {
    if (this.executionHistory.length === 0) return 0;
    
    const totalDuration = this.executionHistory.reduce((sum, step) => sum + step.duration, 0);
    return totalDuration / this.executionHistory.length;
  }

  /**
   * Get success rate of executed steps
   */
  getSuccessRate(): number {
    if (this.executionHistory.length === 0) return 0;
    
    const successfulSteps = this.executionHistory.filter(step => step.success).length;
    return (successfulSteps / this.executionHistory.length) * 100;
  }

  /**
   * Get insights by type
   */
  getInsightsByType(type: Insight['type']): Insight[] {
    return this.insights.filter(insight => insight.type === type);
  }

  /**
   * Get actionable insights
   */
  getActionableInsights(): Insight[] {
    return this.insights.filter(insight => insight.actionable && insight.confidence > 0.6);
  }

  // ==========================================
  // PERFORMANCE OPTIMIZATION
  // ==========================================

  /**
   * Get memory usage information
   */
  getMemoryUsage(): {
    currentSize: number;
    maxSize: number;
    utilizationPercent: number;
    itemCount: number;
  } {
    return {
      currentSize: this._memorySize,
      maxSize: this._maxMemorySize,
      utilizationPercent: (this._memorySize / this._maxMemorySize) * 100,
      itemCount: this.workingMemory.size
    };
  }

  /**
   * Force memory cleanup
   */
  cleanupMemory(): void {
    this._cleanupMemoryIfNeeded(true);
  }

  /**
   * Reset context to initial state (preserves config and session)
   */
  reset(): void {
    this.currentPlan = undefined;
    this.executionHistory = [];
    this.workingMemory.clear();
    this.insights = [];
    this.errorHistory = [];
    this.currentStep = 0;
    this.totalSteps = 0;
    this.remainingSteps = undefined;
    this._reflections = [];
    this._memorySize = 0;
  }

  // ==========================================
  // PRIVATE METHODS
  // ==========================================

  /**
   * Cleanup memory if approaching limits
   */
  private _cleanupMemoryIfNeeded(force: boolean = false): void {
    const utilizationPercent = (this._memorySize / this._maxMemorySize) * 100;
    
    if (force || utilizationPercent > 80) {
      // Remove oldest step results first
      const stepKeys = this.getMemoryKeys(/^step_/);
      const sortedStepKeys = stepKeys.sort((a, b) => {
        const stepA = this.getMemory(a);
        const stepB = this.getMemory(b);
        return (stepA?.timestamp || 0) - (stepB?.timestamp || 0);
      });

      // Remove oldest 25% of step results
      const toRemove = Math.ceil(sortedStepKeys.length * 0.25);
      for (let i = 0; i < toRemove && i < sortedStepKeys.length; i++) {
        this.clearMemory(sortedStepKeys[i]);
      }
    }
  }

  /**
   * Detect error patterns for insights
   */
  private _detectErrorPattern(errors: RuntimeError[]): string | null {
    if (errors.length < 2) return null;

    // Check for repeated tool failures
    const toolErrors = errors.filter(e => e.type === 'tool_execution');
    if (toolErrors.length >= 2) {
      const toolNames = toolErrors.map(e => e.toolName).filter(Boolean);
      const uniqueTools = new Set(toolNames);
      
      if (uniqueTools.size === 1) {
        return `Repeated failures with tool: ${Array.from(uniqueTools)[0]}`;
      }
    }

    // Check for planning failures
    const planningErrors = errors.filter(e => e.type === 'planning_failure');
    if (planningErrors.length >= 2) {
      return 'Multiple planning failures detected - consider simpler task decomposition';
    }

    return null;
  }
}

/**
 * Factory function for creating RuntimeContext instances
 */
export function createRuntimeContext(
  agentConfig: AgentConfig, 
  sessionId?: string
): RuntimeContext {
  return new RuntimeContext(agentConfig, sessionId);
} 