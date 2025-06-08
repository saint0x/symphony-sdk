import { v4 as uuidv4 } from 'uuid';

import { AgentConfig } from '../types/sdk';
import { RuntimeContext, createRuntimeContext } from './context';
import {
  SymphonyRuntimeInterface,
  RuntimeResult,
  RuntimeStatus,
  RuntimeMetrics,
  RuntimeConfiguration,
  RuntimeDependencies,
  RuntimeExecutionMode,
  Conversation,
  ExecutionStep
} from './types';
import { ExecutionEngine } from './engines/ExecutionEngine';
import { ConversationEngine } from './engines/ConversationEngine';
import { Logger } from '../utils/logger';
import { PlanningEngine } from './engines/PlanningEngine';
import { ReflectionEngine } from './engines/ReflectionEngine';
import { RuntimeContextManager } from './context/RuntimeContextManager';
import { SymphonyError, ErrorCode, ErrorCategory, ErrorSeverity } from '../errors/index';

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
  private activeManagers: Map<string, RuntimeContextManager> = new Map();
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

  async execute(
    task: string,
    agentConfig: AgentConfig,
    _sessionId?: string,
    _executionOptions?: {
        planFirst?: boolean;
        streaming?: boolean;
        maxSteps?: number;
    }
  ): Promise<RuntimeResult> {
    if (this.status !== 'ready') {
        throw new SymphonyError({
            code: ErrorCode.EXECUTION_FAILED,
            category: ErrorCategory.RUNTIME,
            severity: ErrorSeverity.HIGH,
            message: `Runtime not ready. Status: ${this.status}`,
            details: { status: this.status, task, agentConfig: agentConfig.name },
            context: { component: 'SymphonyRuntime', operation: 'execute' },
            userGuidance: 'Ensure the runtime is properly initialized before executing tasks.',
            recoveryActions: ['Initialize the runtime', 'Check runtime configuration'],
            timestamp: new Date(),
            component: 'SymphonyRuntime',
            operation: 'execute'
        });
    }

    await this.initialize();
    if (this.status !== 'ready') {
        throw new SymphonyError({
            code: ErrorCode.EXECUTION_FAILED,
            category: ErrorCategory.RUNTIME,
            severity: ErrorSeverity.HIGH,
            message: `Runtime not ready after initialization. Status: ${this.status}`,
            details: { status: this.status, task, agentConfig: agentConfig.name },
            context: { component: 'SymphonyRuntime', operation: 'execute' },
            userGuidance: 'Runtime failed to initialize properly. Check logs for initialization errors.',
            recoveryActions: ['Check runtime dependencies', 'Review initialization logs', 'Restart the runtime'],
            timestamp: new Date(),
            component: 'SymphonyRuntime',
            operation: 'execute'
        });
    }

    const startTime = Date.now();
    const executionId = uuidv4();
    const context = this.createExecutionContext(agentConfig, executionId);
    const contextManager = new RuntimeContextManager(context, this.dependencies.contextAPI);
    this.activeManagers.set(executionId, contextManager);

    try {
        this.status = 'executing';
        let conversation = await this.conversationEngine.initiate(task, context);
        
        const taskAnalysis = await this.planningEngine.analyzeTask(task, context.toExecutionState());
        
        if (this.config.enhancedRuntime && taskAnalysis.requiresPlanning) {
            await this.executePlannedTask(task, contextManager, context.agentConfig, conversation, context);
        } else {
            await this.executeSingleShotTask(task, contextManager, context.agentConfig, conversation);
        }
        
        conversation = await this.conversationEngine.conclude(conversation, context);
        context.conversation = conversation.toJSON();
        context.status = context.errorHistory.length > 0 ? 'failed' : 'succeeded';
        
        const finalResult = this.constructFinalResult(context, conversation, startTime);
        this.updateMetrics(finalResult.mode, startTime, finalResult.success);
        return finalResult;

    } catch (error) {
        this.logger.error('SymphonyRuntime', 'Execution failed catastrophically', {
            executionId, error: error instanceof Error ? error.message : String(error)
        });
        context.status = 'failed';
        const failedResult = this.constructFinalResult(context, undefined, startTime, error as Error);
        return failedResult;
    } finally {
        await contextManager.generateExecutionInsights();
        await contextManager.performMaintenance();
        this.activeManagers.delete(executionId);
        this.status = 'ready';
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('SymphonyRuntime', 'Shutting down runtime');
    this.status = 'shutdown';
    for (const [executionId, manager] of this.activeManagers) {
      this.logger.warn('SymphonyRuntime', `Cancelling active execution: ${executionId}`);
      manager.updateStatus('aborted');
    }
    this.activeManagers.clear();
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
      throw new SymphonyError({
        code: ErrorCode.MISSING_DEPENDENCY,
        category: ErrorCategory.CONFIGURATION,
        severity: ErrorSeverity.CRITICAL,
        message: 'Missing required runtime dependencies',
        details: { 
          hasToolRegistry: !!this.dependencies.toolRegistry,
          hasContextAPI: !!this.dependencies.contextAPI,
          hasLLMHandler: !!this.dependencies.llmHandler,
          hasLogger: !!this.dependencies.logger
        },
        context: { component: 'SymphonyRuntime', operation: 'validateDependencies' },
        userGuidance: 'Ensure all required dependencies are provided when creating the runtime.',
        recoveryActions: [
          'Verify toolRegistry is provided',
          'Verify contextAPI is provided', 
          'Verify llmHandler is provided',
          'Verify logger is provided'
        ],
        timestamp: new Date(),
        component: 'SymphonyRuntime',
        operation: 'validateDependencies'
      });
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
      toolCalls: context.executionHistory.filter(s => s.toolUsed).length,
      reflectionCount: context.getReflections().length,
      adaptationCount: 0 // To be implemented
    };
  }

  private async executePlannedTask(task: string, contextManager: RuntimeContextManager, agentConfig: AgentConfig, conversation: Conversation, context: RuntimeContext): Promise<void> {
    this.logger.info('SymphonyRuntime', 'Task requires planning. Executing multi-step plan.');
    const plan = await this.planningEngine.createExecutionPlan(task, agentConfig, contextManager.getExecutionState());
    contextManager.setPlan(plan);

    for (const step of plan.steps) {
        conversation.addTurn('assistant', `Executing step: ${step.description}`);
        
        const resolvedParameters = this.resolvePlaceholders(step.parameters, context.executionHistory);

        const stepResult = await this.executionEngine.executeStep(step.toolName, resolvedParameters);
        
        const executionStep: ExecutionStep = {
            stepId: uuidv4(),
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 0,
            description: step.description,
            success: stepResult.success,
            result: stepResult.result,
            error: stepResult.error,
            summary: `Step "${step.description}" ${stepResult.success ? 'succeeded' : 'failed'}.`,
            toolUsed: stepResult.result?.toolsExecuted?.[0]?.name,
            parameters: stepResult.result?.toolsExecuted?.[0]?.parameters
        };
        await contextManager.recordStep(executionStep);

        if (this.config.reflectionEnabled && !stepResult.success) {
            const reflection = await this.reflectionEngine.reflect(executionStep, contextManager.getExecutionState(), conversation);
            contextManager.recordReflection(reflection);
            conversation.addTurn('assistant', `Reflection: ${reflection.reasoning}`);
        }

        if (!stepResult.success) {
            conversation.addTurn('assistant', `Step failed: ${step.description}. Error: ${stepResult.error}`);
            conversation.currentState = 'error';
            contextManager.updateStatus('failed');
            break; 
        }
    }
  }

  private resolvePlaceholders(parameters: any, history: ReadonlyArray<ExecutionStep>): any {
    if (!parameters || typeof parameters !== 'object') {
        return parameters;
    }

    const resolved = JSON.parse(JSON.stringify(parameters));

    const fullPlaceholderRegex = /^\{\{step_(\d+)_output(?:\.(.*))?\}\}$/;
    const partialPlaceholderRegex = /\{\{step_(\d+)_output(?:\.(.*))?\}\}/g;

    const resolveValue = (stepIndexStr: string, propertyPath: string | undefined): any => {
        const stepIndex = parseInt(stepIndexStr, 10) - 1;
        
        if (history[stepIndex] && history[stepIndex].success) {
            let currentValue = history[stepIndex].result;
            
            if (propertyPath) {
                const props = propertyPath.split('.');
                for (const prop of props) {
                    if (currentValue && typeof currentValue === 'object' && prop in currentValue) {
                        currentValue = (currentValue as any)[prop];
                    } else {
                        this.logger.warn('SymphonyRuntime', `Could not resolve property path "${propertyPath}" in step ${stepIndex + 1} output.`, { propertyPath, stepOutput: history[stepIndex].result });
                        return undefined; // Property path not found
                    }
                }
            }
            return currentValue;
        }
        
        this.logger.warn('SymphonyRuntime', `Referenced step ${stepIndex + 1} not found or failed.`, { stepIndex: stepIndex + 1, historyCount: history.length });
        return undefined; // Step not found or failed
    };

    const traverseAndResolve = (obj: any): any => {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => traverseAndResolve(item));
        }

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (typeof obj[key] === 'string') {
                    const strValue = obj[key];

                    // Case 1: The entire string is a placeholder. Replace it with the resolved value, preserving type.
                    const fullMatch = strValue.match(fullPlaceholderRegex);
                    if (fullMatch) {
                        const [, stepIndexStr, propertyPath] = fullMatch;
                        const resolvedValue = resolveValue(stepIndexStr, propertyPath);
                        if (resolvedValue !== undefined) {
                            obj[key] = resolvedValue;
                        }
                        continue; // Move to next key
                    }

                    // Case 2: The string contains one or more placeholders (partial substitution).
                    // The result must be a string.
                    obj[key] = strValue.replace(partialPlaceholderRegex, (match, stepIndexStr, propertyPath) => {
                        const resolvedValue = resolveValue(stepIndexStr, propertyPath);
                        if (resolvedValue === undefined) {
                            return match; // Keep original placeholder if not found
                        }
                        return typeof resolvedValue === 'object' ? JSON.stringify(resolvedValue) : String(resolvedValue);
                    });

                } else if (typeof obj[key] === 'object') {
                    // Recurse for nested objects or arrays
                    traverseAndResolve(obj[key]);
                }
            }
        }
        return obj;
    }

    return traverseAndResolve(resolved);
  }

  private async executeSingleShotTask(task: string, contextManager: RuntimeContextManager, agentConfig: AgentConfig, conversation: Conversation): Promise<void> {
    this.logger.info('SymphonyRuntime', 'Executing single-shot task.');
    const executionResult = await this.executionEngine.execute(task, agentConfig, contextManager.getExecutionState());
    
    await contextManager.recordStep({
        stepId: uuidv4(),
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        description: task,
        success: executionResult.success,
        result: executionResult.result,
        error: executionResult.error,
        summary: `Single-shot task execution.`,
        toolUsed: executionResult.result?.toolsExecuted?.[0]?.name,
        parameters: executionResult.result?.toolsExecuted?.[0]?.parameters
    } as ExecutionStep);

    if (executionResult.success) {
        const finalContent = executionResult.result?.response || JSON.stringify(executionResult.result);
        conversation.addTurn('assistant', `Completed task successfully. Result: ${finalContent}`);
        conversation.finalResponse = finalContent;
    } else {
        conversation.addTurn('assistant', `Failed to complete task. Error: ${executionResult.error}`);
    }
  }

  private constructFinalResult(context: RuntimeContext, conversation: Conversation | undefined, startTime: number, error?: Error): RuntimeResult {
    const finalState = context.toExecutionState();
    const finalSuccess = !error && finalState.errors.length === 0 && finalState.status !== 'failed' && finalState.status !== 'aborted';
    
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
            adaptations: [],
            insights: finalState.insights
        },
        error: error ? error.message : (finalSuccess ? undefined : finalState.errors[finalState.errors.length - 1]?.message),
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