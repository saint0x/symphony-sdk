import { v4 as uuidv4 } from 'uuid';
import { ReflectionEngineInterface, RuntimeContext, RuntimeDependencies, Reflection, ExecutionStep, Conversation, ReflectionAssessment } from "../RuntimeTypes";
import { ToolResult } from '../../types/sdk';

/**
 * The ReflectionEngine leverages the 'ponderTool' to analyze execution results
 * and provide actionable insights for course correction and learning.
 */
export class ReflectionEngine implements ReflectionEngineInterface {
    private dependencies: RuntimeDependencies;

    constructor(dependencies: RuntimeDependencies) {
        this.dependencies = dependencies;
    }

    async initialize(): Promise<void> {
        this.dependencies.logger.info('ReflectionEngine', 'ReflectionEngine initialized');
    }

    getDependencies(): string[] {
        return ['logger'];
    }

    getState(): string {
        return 'ready';
    }

    async healthCheck(): Promise<boolean> {
        return true;
    }

    /**
     * Reflects on an execution step by forming a query and calling the ponderTool.
     * @returns A Reflection object.
     */
    async reflect(stepResult: ExecutionStep, context: RuntimeContext, _conversation: Conversation): Promise<Reflection> {
        this.dependencies.logger.info('ReflectionEngine', `Reflecting on step: ${stepResult.description}`);
        
        const query = this.createPonderQuery(stepResult);

        try {
            const ponderResult: ToolResult = await this.dependencies.toolRegistry.executeTool('ponderTool', {
                query: query,
                context: {
                    agentConfig: context.agentConfig,
                    fullPlan: context.currentPlan,
                    executionHistory: context.executionHistory
                }
            });

            if (!ponderResult.success || !ponderResult.result?.conclusion) {
                this.dependencies.logger.warn('ReflectionEngine', 'ponderTool execution failed or returned no conclusion.');
                return this.createFallbackReflection(stepResult, 'Ponder tool failed.');
            }

            return this.parsePonderResultToReflection(stepResult, ponderResult.result);

        } catch (error) {
            this.dependencies.logger.error('ReflectionEngine', 'Error during ponderTool execution', { error });
            return this.createFallbackReflection(stepResult, `Ponder tool execution threw an error.`);
        }
    }

    private createPonderQuery(stepResult: ExecutionStep): string {
        if (stepResult.success) {
            return `My last action to '${stepResult.description}' succeeded. Was this the most optimal and efficient approach? Analyze my method and suggest any potential optimizations or alternative strategies for similar future tasks.`;
        } else {
            return `My attempt to '${stepResult.description}' failed with the error: "${stepResult.error}". Analyze the root cause of this failure. Consider the tool used, the parameters, and the overall goal. Suggest a concrete, actionable correction strategy. Should I retry, use a different tool, modify the parameters, or abort the plan?`;
        }
    }

    private parsePonderResultToReflection(stepResult: ExecutionStep, ponderResult: any): Reflection {
        const { conclusion } = ponderResult;
        
        const assessment: ReflectionAssessment = {
            performance: stepResult.success ? 'good' : 'poor',
            quality: 'good', // This could be improved by parsing ponder's analysis
            suggestedImprovements: conclusion.nextSteps || []
        };
        
        let suggestedAction: 'continue' | 'retry' | 'abort' | 'modify_plan' = 'continue';
        if (!stepResult.success) {
            // A simple keyword search in the ponder conclusion to suggest next action
            const conclusionText = conclusion.summary.toLowerCase();
            if (conclusionText.includes('retry')) {
                suggestedAction = 'retry';
            } else if (conclusionText.includes('modify') || conclusionText.includes('alternative')) {
                suggestedAction = 'modify_plan';
            } else {
                suggestedAction = 'abort';
            }
        }
        
        const reflection: Reflection = {
            id: uuidv4(),
            stepId: stepResult.stepId,
            assessment,
            suggestedAction,
            reasoning: conclusion.summary || 'No summary provided by ponderTool.',
            confidence: conclusion.confidence || 0.7,
            timestamp: Date.now()
        };
        return reflection;
    }

    private createFallbackReflection(stepResult: ExecutionStep, reason: string): Reflection {
        return {
            id: uuidv4(),
            stepId: stepResult.stepId,
            assessment: { performance: 'poor', quality: 'wrong' },
            suggestedAction: 'abort',
            reasoning: `Reflection failed: ${reason}`,
            confidence: 0.9,
            timestamp: Date.now()
        };
    }
} 