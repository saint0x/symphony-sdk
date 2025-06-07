import { IContextAPI } from '../../api/IContextAPI';
import { Logger } from '../../utils/logger';
import { RuntimeContext } from '../RuntimeContext';
import { ExecutionStep, Insight, Reflection, InsightType, ExecutionPlan } from '../RuntimeTypes';
import { ExecutionState } from './ExecutionState';
import { v4 as uuidv4 } from 'uuid';

/**
 * Manages the runtime context, including learning, analytics, and memory optimization.
 * This class acts as the "brain" for context, using the IContextAPI to perform
 * intelligent operations based on the execution state.
 */
export class RuntimeContextManager {
  private logger: Logger;

  constructor(
    private context: RuntimeContext,
    private contextApi: IContextAPI
  ) {
    this.logger = new Logger('RuntimeContextManager');
    this.logger.info('RuntimeContextManager', 'created', { sessionId: this.context.sessionId });
  }

  /**
   * Records a completed execution step and triggers learning.
   * @param step The execution step that was just completed.
   */
  public async recordStep(step: ExecutionStep): Promise<void> {
    this.context.addExecutionStep(step);
    this.logger.debug('RuntimeContextManager', `Step recorded: ${step.description}`, { stepId: step.stepId, success: step.success });
    
    // Asynchronously learn from the execution without blocking the main flow
    this.learnFromExecution().catch(error => {
      this.logger.warn('RuntimeContextManager', 'Failed to learn from execution', { error, stepId: step.stepId });
    });
  }

  /**
   * Records a reflection and incorporates its insights.
   * @param reflection The reflection generated after a step.
   */
  public recordReflection(reflection: Reflection): void {
    this.context.addReflection(reflection);
    
    const insight: Insight = {
      id: reflection.id,
      type: 'strategy_assessment' as InsightType,
      description: `Reflection on step "${reflection.stepId}": ${reflection.reasoning}`,
      confidence: reflection.confidence,
      source: 'ReflectionEngine',
      timestamp: Date.now(),
      actionable: reflection.suggestedAction !== 'continue',
    };

    this.context.addInsight(insight);
    this.logger.debug('RuntimeContextManager', `Reflection recorded for step ${reflection.stepId}`);
  }

  /**
   * Generates a comprehensive, immutable snapshot of the current execution state.
   * @returns The current ExecutionState.
   */
  public getExecutionState(): ExecutionState {
    return this.context.toExecutionState();
  }

  /**
   * Sets the execution plan on the underlying context.
   * @param plan The execution plan to set.
   */
  public setPlan(plan: ExecutionPlan): void {
    this.context.setExecutionPlan(plan);
    this.logger.info('RuntimeContextManager', `Execution plan set with ${plan.steps.length} steps.`, { planId: plan.id });
  }

  /**
   * Updates the overall status of the execution.
   * @param status The new status.
   */
  public updateStatus(status: 'running' | 'succeeded' | 'failed' | 'aborted'): void {
    this.context.status = status;
    this.logger.info('RuntimeContextManager', `Execution status updated to: ${status}`);
  }

  /**
   * Generates a final summary insight for the entire execution.
   */
  public async generateExecutionInsights(): Promise<void> {
    this.logger.info('RuntimeContextManager', 'Generating final execution insights...');
    try {
        const { success, result } = await this.contextApi.useMagic('get_insights', {
            sessionId: this.context.sessionId,
            includeFailures: true,
        });

        if (success && result) {
            const summaryDescription = `Execution Summary: ${result.totalExecutions} total operations, ${result.successRate}% success rate. Average execution time: ${result.avgExecutionTime}ms.`;
            const insight: Insight = {
                id: uuidv4(),
                type: 'performance_optimization',
                description: summaryDescription,
                confidence: 0.9,
                source: 'ContextAPI.get_insights',
                timestamp: Date.now(),
                actionable: false,
                metadata: result,
            };
            this.context.addInsight(insight);
            this.logger.info('RuntimeContextManager', 'Successfully generated execution insights.');
        } else {
            this.logger.warn('RuntimeContextManager', 'Failed to generate execution insights', { error: result?.error });
        }
    } catch (error) {
        this.logger.error('RuntimeContextManager', 'An exception occurred during insight generation', { error });
    }
  }

  /**
   * Calls the Context API to learn from the latest execution details.
   */
  private async learnFromExecution(): Promise<void> {
    const lastStep = this.context.executionHistory[this.context.executionHistory.length - 1];
    if (!lastStep || !lastStep.toolUsed) {
        return; // Nothing to learn from
    }

    try {
        const { success, result } = await this.contextApi.useMagic('learn_from_execution', {
            toolName: lastStep.toolUsed,
            success: lastStep.success,
            executionTime: lastStep.duration,
            context: {
                task: this.context.currentPlan?.taskDescription || 'N/A',
                stepDescription: lastStep.description,
                agent: this.context.agentConfig.name,
            },
            errorDetails: lastStep.error,
        });

        if (success) {
            this.logger.info('RuntimeContextManager', `Learned from execution of tool: ${lastStep.toolUsed}`);
            if (result?.insights) {
                result.insights.forEach((insight: Insight) => this.context.addInsight(insight));
            }
        } else {
            this.logger.warn('RuntimeContextManager', `Context API failed to learn from execution`, { tool: lastStep.toolUsed, error: result?.error });
        }
    } catch (error) {
        this.logger.error('RuntimeContextManager', 'An exception occurred during learnFromExecution', { error });
    }
  }

  /**
   * Performs intelligent context pruning and memory cleanup.
   */
  public async performMaintenance(): Promise<void> {
    this.logger.info('RuntimeContextManager', 'Performing context maintenance...');
    try {
        const { success, result } = await this.contextApi.useMagic('prune_context', {
            sessionId: this.context.sessionId,
        });

        if (success) {
            this.logger.info('RuntimeContextManager', 'Intelligent context pruning successful', result);
        } else {
            this.logger.warn('RuntimeContextManager', 'Intelligent context pruning failed', result);
        }
    } catch (error) {
        this.logger.error('RuntimeContextManager', 'An exception occurred during context pruning', { error });
    }
  }
} 