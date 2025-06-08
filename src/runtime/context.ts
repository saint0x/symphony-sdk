import { v4 as uuidv4 } from 'uuid';
import { AgentConfig } from '../types/sdk';
import {
  RuntimeContext as IRuntimeContext,
  ExecutionPlan,
  ExecutionStep,
  Insight,
  RuntimeError,
  PlannedStep,
  Reflection
} from './types';
import { ExecutionState } from './context/ExecutionState';
import { ConversationJSON, RuntimeSnapshot } from './types';

/**
 * Manages the state of a single execution flow. It is a state container
 * with methods to update and query that state. The intelligent logic
 * for learning and analytics has been moved to the RuntimeContextManager.
 */
export class RuntimeContext implements IRuntimeContext {
  public readonly sessionId: string;
  public readonly agentConfig: AgentConfig;
  public readonly createdAt: number;
  public conversation: ConversationJSON | null = null;
  public status: 'running' | 'succeeded' | 'failed' | 'aborted' = 'running';

  public currentPlan?: ExecutionPlan;
  public executionHistory: ExecutionStep[] = [];
  public workingMemory: Map<string, any> = new Map();
  public insights: Insight[] = [];
  public errorHistory: RuntimeError[] = [];
  public currentStep: number = 0;
  public totalSteps: number = 0;
  public remainingSteps?: PlannedStep[];
  
  private _reflections: Reflection[] = [];
  private _memorySize: number = 0;
  private readonly _maxMemorySize: number = 50 * 1024 * 1024; // 50MB limit

  constructor(agentConfig: AgentConfig, sessionId?: string) {
    this.sessionId = sessionId || uuidv4();
    this.agentConfig = agentConfig;
    this.createdAt = Date.now();
  }

  setExecutionPlan(plan: ExecutionPlan): void {
    this.currentPlan = plan;
    this.totalSteps = plan.steps.length;
    this.remainingSteps = [...plan.steps];
    this.currentStep = 0;
  }

  addExecutionStep(stepData: Omit<ExecutionStep, 'stepId' | 'startTime' | 'endTime' | 'duration'>): ExecutionStep {
    const startTime = Date.now();
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
    
    if (this.remainingSteps && this.remainingSteps.length > 0) {
      this.remainingSteps = this.remainingSteps.slice(1);
    }

    this.setMemory(`step_${step.stepId}`, {
      result: step.result,
      success: step.success,
      duration: step.duration,
      timestamp: step.endTime
    });

    if (step.reflection) {
      this._reflections.push(step.reflection);
    }
    
    return step;
  }

  addInsight(insight: Insight): void {
    const isDuplicate = this.insights.some(existing => 
      existing.type === insight.type && existing.description === insight.description
    );

    if (!isDuplicate) {
      this.insights.push(insight);
      if (this.insights.length > 100) {
        this.insights.shift();
      }
    }
  }

  addReflection(reflection: Reflection): void {
    this._reflections.push(reflection);
  }

  getReflections(): Reflection[] {
    return [...this._reflections];
  }
  
  public toSnapshot(): RuntimeSnapshot {
    return {
      sessionId: this.sessionId,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      executionHistory: this.executionHistory,
      insights: this.insights,
      timestamp: Date.now()
    }
  }

  public updateExecutionPlan(plan: ExecutionPlan): void {
    if (!this.currentPlan) {
      this.setExecutionPlan(plan);
      return;
    }

    const previousStep = this.currentStep;
    this.currentPlan = plan;
    this.totalSteps = plan.steps.length;
    
    // Adjust remaining steps based on current progress
    this.remainingSteps = plan.steps.slice(previousStep);
  }

  toExecutionState(): ExecutionState {
    const memoryRecord: Record<string, any> = {};
    this.workingMemory.forEach((value, key) => {
        memoryRecord[key] = value;
    });

    return {
      sessionId: this.sessionId,
      agentConfig: this.agentConfig,
      plan: this.currentPlan || null,
      history: this.executionHistory.map(step => ({
        stepId: step.stepId,
        description: step.description,
        toolUsed: step.toolUsed || null,
        input: step.parameters || {},
        output: step.result,
        success: step.success,
        reflection: this._reflections.find(r => r.stepId === step.stepId)?.reasoning,
      })),
      insights: [...this.insights],
      errors: [...this.errorHistory],
      conversation: this.conversation || { id: '', originalTask: '', turns: [], finalResponse: '', reasoningChain: [], duration: 0, state: 'error' },
      workingMemory: memoryRecord,
      status: this.status,
    };
  }

  setMemory(key: string, value: any): void {
    const serialized = JSON.stringify(value);
    const size = new Blob([serialized]).size;
    
    if (this.workingMemory.has(key)) {
      const oldSize = new Blob([JSON.stringify(this.workingMemory.get(key))]).size;
      this._memorySize -= oldSize;
    }

    this.workingMemory.set(key, value);
    this._memorySize += size;
  }

  getMemory<T = any>(key: string): T | undefined {
    return this.workingMemory.get(key) as T;
  }

  addError(error: Omit<RuntimeError, 'id' | 'timestamp'>): void {
    const runtimeError: RuntimeError = { id: uuidv4(), timestamp: Date.now(), ...error };
    this.errorHistory.push(runtimeError);
    if (this.errorHistory.length > 50) {
      this.errorHistory.shift();
    }
  }

  getMemoryUsage(): { currentSize: number; maxSize: number; utilizationPercent: number; itemCount: number; } {
    return {
      currentSize: this._memorySize,
      maxSize: this._maxMemorySize,
      utilizationPercent: (this._memorySize / this._maxMemorySize) * 100,
      itemCount: this.workingMemory.size
    };
  }

  cleanupMemory(): void {
    const utilizationPercent = (this._memorySize / this._maxMemorySize) * 100;
    
    if (utilizationPercent > 80) {
      const stepKeys = Array.from(this.workingMemory.keys()).filter(k => k.startsWith('step_'));
      const sortedStepKeys = stepKeys.sort((a, b) => {
        const stepA = this.getMemory(a);
        const stepB = this.getMemory(b);
        return (stepA?.timestamp || 0) - (stepB?.timestamp || 0);
      });

      const toRemoveCount = Math.ceil(sortedStepKeys.length * 0.25);
      for (let i = 0; i < toRemoveCount; i++) {
        this.clearMemory(sortedStepKeys[i]);
      }
    }
  }
  
  private clearMemory(key: string): boolean {
    if (this.workingMemory.has(key)) {
      const value = this.workingMemory.get(key);
      const size = new Blob([JSON.stringify(value)]).size;
      this._memorySize -= size;
      this.workingMemory.delete(key);
      return true;
    }
    return false;
  }
}

export function createRuntimeContext(
  agentConfig: AgentConfig, 
  sessionId?: string
): RuntimeContext {
  return new RuntimeContext(agentConfig, sessionId);
} 