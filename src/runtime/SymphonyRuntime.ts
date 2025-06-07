import { v4 as uuidv4 } from 'uuid';
import { AgentConfig } from '../types/sdk';
import { RuntimeContext, createRuntimeContext } from './RuntimeContext';
import {
  SymphonyRuntimeInterface,
  RuntimeResult,
  RuntimeStatus,
  RuntimeMetrics,
  RuntimeConfiguration,
  RuntimeDependencies,
  RuntimeExecutionMode,
  Conversation
} from './RuntimeTypes';
import { ExecutionEngine } from './engines/ExecutionEngine';
import { ConversationEngine } from './engines/ConversationEngine';
import { Logger } from '../utils/logger';
import { PlanningEngine } from './engines/PlanningEngine';
import { ReflectionEngine } from './engines/ReflectionEngine';

/**
 * Default runtime configuration
 */
const DEFAULT_RUNTIME_CONFIG: RuntimeConfiguration = {
  enhancedRuntime: false,
  planningThreshold: 'multi_step',
  reflectionEnabled: false,
  maxStepsPerPlan: 10,
  timeoutMs: 300000, // 5 minutes
  retryAttempts: 3,
  debugMode: false
};

/**
 * Production-grade Symphony Runtime orchestrator.
 * Coordinates execution engines to provide a seamless conversational and tool-using experience.
 */
export class SymphonyRuntime implements SymphonyRuntimeInterface {
  private readonly dependencies: RuntimeDependencies;
  private readonly config: RuntimeConfiguration;
  private readonly logger: Logger;
  private readonly executionEngine: ExecutionEngine;
  private readonly conversationEngine: ConversationEngine;
  private readonly planningEngine: PlanningEngine;
  private readonly reflectionEngine: ReflectionEngine;
  
  private status: RuntimeStatus = 'initializing';
  private metrics: RuntimeMetrics;
  private activeContexts: Map<string, RuntimeContext> = new Map();
  private initializationPromise?: Promise<void>;

  constructor(dependencies: RuntimeDependencies, config?: Partial<RuntimeConfiguration>) {
    this.dependencies = dependencies;
    this.config = { ...DEFAULT_RUNTIME_CONFIG, ...config };
    this.logger = dependencies.logger || Logger.getInstance('SymphonyRuntime');
    
    this.executionEngine = new ExecutionEngine(this.dependencies);
    this.conversationEngine = new ConversationEngine(this.dependencies);
    this.planningEngine = new PlanningEngine(this.dependencies);
    this.reflectionEngine = new ReflectionEngine(this.dependencies);
    
    this.metrics = this.createInitialMetrics();

    this.logger.info('SymphonyRuntime', 'Runtime orchestrator created', {
      enhancedRuntime: this.config.enhancedRuntime,
      planningThreshold: this.config.planningThreshold
    });
  }

  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  async execute(task: string, agentConfig: AgentConfig): Promise<RuntimeResult> {
    await this.initialize();
    if (this.status !== 'ready') throw new Error(`Runtime not ready. Status: ${this.status}`);

    const startTime = Date.now();
    const executionId = uuidv4();
    const context = this.createExecutionContext(agentConfig, executionId);
    this.activeContexts.set(executionId, context);

    try {
        this.status = 'executing';
        let conversation = await this.conversationEngine.initiate(task, context);
        
        const taskAnalysis = await this.planningEngine.analyzeTask(task, context);
        
        if (this.config.enhancedRuntime && taskAnalysis.requiresPlanning) {
            await this.executePlannedTask(task, context, conversation);
        } else {
            await this.executeSingleShotTask(task, context, conversation);
        }
        
        conversation = await this.conversationEngine.conclude(conversation, context);
        
        const finalResult = this.constructFinalResult(context, conversation, startTime);
        this.updateMetrics(finalResult.mode, startTime, finalResult.success);
        return finalResult;

    } catch (error) {
        this.logger.error('SymphonyRuntime', 'Execution failed catastrophically', {
            executionId, error: error instanceof Error ? error.message : String(error)
        });
        // In case of a catastrophic failure, construct a failed result
        const failedResult = this.constructFinalResult(context, undefined, startTime, error as Error);
        return failedResult;
    } finally {
        this.activeContexts.delete(executionId);
        this.status = 'ready';
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('SymphonyRuntime', 'Shutting down runtime');
    this.status = 'shutdown';
    for (const [executionId, context] of this.activeContexts) {
      this.logger.warn('SymphonyRuntime', `Cancelling active execution: ${executionId}`);
      context.addError({
        type: 'system_error', message: 'Execution cancelled due to runtime shutdown', context: { executionId }, recoverable: false
      });
    }
    this.activeContexts.clear();
    this.logger.info('SymphonyRuntime', 'Runtime shutdown complete');
  }

  getStatus(): RuntimeStatus {
    return this.status;
  }

  getMetrics(): RuntimeMetrics {
    return { ...this.metrics };
  }

  async healthCheck(): Promise<boolean> {
    const checks = await Promise.allSettled([
      this.dependencies.toolRegistry.getAvailableTools().length > 0,
      this.dependencies.contextAPI.healthCheck(),
      this.dependencies.llmHandler ? Promise.resolve(true) : Promise.resolve(false)
    ]);
    return checks.every(result => result.status === 'fulfilled' && result.value === true);
  }

  private async _performInitialization(): Promise<void> {
    try {
      this.logger.info('SymphonyRuntime', 'Initializing runtime engines');
      await this.validateDependencies();
      await this.initializeEngines();
      this.status = 'ready';
      this.logger.info('SymphonyRuntime', 'Runtime initialization complete');
    } catch (error) {
      this.status = 'error';
      this.logger.error('SymphonyRuntime', 'Runtime initialization failed', { error });
      throw error;
    }
  }

  private async validateDependencies(): Promise<void> {
    const { toolRegistry, contextAPI, llmHandler, logger } = this.dependencies;
    if (!toolRegistry || !contextAPI || !llmHandler || !logger) {
      throw new Error('Missing required runtime dependencies.');
    }
  }

  private async initializeEngines(): Promise<void> {
    await this.executionEngine.initialize();
    await this.conversationEngine.initialize();
    await this.planningEngine.initialize();
    if (this.config.reflectionEnabled) {
      await this.reflectionEngine.initialize();
    }
    
    this.logger.info('SymphonyRuntime', 'Engines initialized', {
      execution: !!this.executionEngine,
      conversation: !!this.conversationEngine,
      planning: !!this.planningEngine,
      reflection: !!this.reflectionEngine && this.config.reflectionEnabled,
    });
  }

  private createExecutionContext(agentConfig: AgentConfig, sessionId?: string): RuntimeContext {
    return createRuntimeContext(agentConfig, sessionId);
  }

  private updateMetrics(mode: RuntimeExecutionMode, startTime: number, success: boolean): void {
    const duration = Date.now() - startTime;
    this.metrics.totalDuration += duration;
    this.metrics.stepCount += 1;
    this.metrics.toolCalls += 1;
    if (mode === 'enhanced_planning') {
      this.metrics.adaptationCount += 1;
    }
    if (!success) {
      this.logger.warn('SymphonyRuntime', `${mode} execution failed`, { duration });
    }
  }

  private createInitialMetrics(): RuntimeMetrics {
    return {
      totalDuration: 0, startTime: Date.now(), endTime: 0, stepCount: 0, toolCalls: 0, reflectionCount: 0, adaptationCount: 0
    };
  }

  private createFinalMetrics(startTime: number, context: RuntimeContext): RuntimeMetrics {
    const duration = Date.now() - startTime;
    return {
      totalDuration: duration,
      startTime: startTime,
      endTime: Date.now(),
      stepCount: context.executionHistory.length,
      toolCalls: context.executionHistory.length, // Simplification for now
      reflectionCount: 0, // To be implemented
      adaptationCount: 0 // To be implemented
    };
  }

  private async executePlannedTask(task: string, context: RuntimeContext, conversation: Conversation): Promise<void> {
    this.logger.info('SymphonyRuntime', 'Task requires planning. Executing multi-step plan.');
    const plan = await this.planningEngine.createExecutionPlan(task, context);
    context.setExecutionPlan(plan);

    for (const step of plan.steps) {
        conversation.addTurn('assistant', `Executing step: ${step.description}`);
        
        // Execute the step using the same magic engine
        const stepResult = await this.executionEngine.execute(step.description, context);
        const executionStep = context.addExecutionStep({
            description: step.description,
            success: stepResult.success,
            result: stepResult.result,
            error: stepResult.error,
            summary: `Step "${step.description}" ${stepResult.success ? 'succeeded' : 'failed'}.`,
            toolUsed: stepResult.result?.toolsExecuted?.[0]?.name, // Best guess
            parameters: stepResult.result?.toolsExecuted?.[0]?.parameters
        });

        // New Reflection Step
        if (this.config.reflectionEnabled) {
            const reflection = await this.reflectionEngine.reflect(executionStep, context, conversation);
            context.addReflection(reflection);
            conversation.addTurn('assistant', `Reflection: ${reflection.reasoning}`);

            if (reflection.suggestedAction === 'abort') {
                this.logger.warn('SymphonyRuntime', `Aborting plan based on reflection: ${reflection.reasoning}`);
                break; // Abort the plan
            }
            // Future: Handle 'retry' and 'modify_plan'
        }

        if (!stepResult.success) {
            conversation.addTurn('assistant', `Step failed: ${step.description}. Error: ${stepResult.error}`);
            conversation.currentState = 'error';
            // For now, we stop on failure. Day 6 will add reflection/recovery.
            break; 
        }
    }
  }

  private async executeSingleShotTask(task: string, context: RuntimeContext, conversation: Conversation): Promise<void> {
    this.logger.info('SymphonyRuntime', 'Executing single-shot task.');
    const executionResult = await this.executionEngine.execute(task, context);
    if (executionResult.success) {
        conversation.addTurn('assistant', `Completed task successfully. Result: ${JSON.stringify(executionResult.result)}`);
    } else {
        conversation.addTurn('assistant', `Failed to complete task. Error: ${executionResult.error}`);
    }
  }

  private constructFinalResult(context: RuntimeContext, conversation: Conversation | undefined, startTime: number, error?: Error): RuntimeResult {
    const finalSuccess = !error && context.errorHistory.length === 0;
    
    const finalResult: RuntimeResult = {
        success: finalSuccess,
        mode: context.currentPlan ? 'enhanced_planning' : 'legacy_with_conversation',
        conversation: conversation?.toJSON(),
        plan: context.currentPlan,
        executionDetails: {
            mode: context.currentPlan ? 'enhanced_planning' : 'legacy_with_conversation',
            stepResults: context.executionHistory,
            totalSteps: context.totalSteps || (finalSuccess ? 1 : 0),
            completedSteps: context.executionHistory.filter(s => s.success).length,
            failedSteps: context.executionHistory.filter(s => !s.success).length,
            adaptations: [] // This should be empty for now
        },
        error: error ? error.message : (finalSuccess ? undefined : context.errorHistory[context.errorHistory.length - 1].message),
        metrics: this.createFinalMetrics(startTime, context)
    };

    return finalResult;
  }
}

export function createSymphonyRuntime(
  dependencies: RuntimeDependencies,
  config?: Partial<RuntimeConfiguration>
): SymphonyRuntime {
  return new SymphonyRuntime(dependencies, config);
}

export function createSymphonyRuntimeWithFlags(
  dependencies: RuntimeDependencies,
  environmentFlags?: Record<string, string>
): SymphonyRuntime {
  const config: Partial<RuntimeConfiguration> = {
    enhancedRuntime: environmentFlags?.ENHANCED_RUNTIME === 'true',
    planningThreshold: (environmentFlags?.PLANNING_THRESHOLD as any) || 'multi_step',
    reflectionEnabled: environmentFlags?.REFLECTION_ENABLED === 'true',
    debugMode: environmentFlags?.DEBUG_MODE === 'true'
  };
  return new SymphonyRuntime(dependencies, config);
} 