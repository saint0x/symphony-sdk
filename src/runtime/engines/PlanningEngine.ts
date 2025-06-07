import { v4 as uuidv4 } from 'uuid';
import { PlanningEngineInterface, RuntimeContext, RuntimeDependencies, ExecutionPlan, TaskAnalysis, TaskComplexity, PlannedStep } from "../RuntimeTypes";
import { ToolResult } from "../../types/sdk";

/**
 * The PlanningEngine is responsible for analyzing tasks and creating execution plans.
 * It leverages existing tools to bootstrap its planning capabilities.
 */
export class PlanningEngine implements PlanningEngineInterface {
    private dependencies: RuntimeDependencies;

    constructor(dependencies: RuntimeDependencies) {
        this.dependencies = dependencies;
    }

    async initialize(): Promise<void> {
        this.dependencies.logger.info('PlanningEngine', 'PlanningEngine initialized');
    }

    getDependencies(): string[] {
        return ['toolRegistry', 'llmHandler', 'logger'];
    }

    getState(): string {
        return 'ready';
    }

    async healthCheck(): Promise<boolean> {
        // The health of the planning engine depends on the createPlanTool being available.
        const createPlanTool = this.dependencies.toolRegistry.getToolInfo('createPlanTool');
        return !!createPlanTool;
    }

    /**
     * Analyzes the complexity of a task to determine if it requires multi-step planning.
     * @param task The user's task description.
     * @param _context The runtime context.
     * @returns A TaskAnalysis object.
     */
    async analyzeTask(task: string, _context: RuntimeContext): Promise<TaskAnalysis> {
        const keywords = ['then', 'and then', 'after that', 'first', 'second', 'finally', 'create a plan'];
        const taskLower = task.toLowerCase();

        const requiresPlanning = keywords.some(kw => taskLower.includes(kw)) || task.length > 200;
        const complexity: TaskComplexity = requiresPlanning ? 'multi_step' : 'simple';

        const reasoning = requiresPlanning 
            ? `Task contains keywords or is long, suggesting multiple steps are needed.`
            : `Task appears simple and suitable for single-shot execution.`;

        return {
            complexity,
            requiresPlanning,
            reasoning
        };
    }

    /**
     * Creates a detailed execution plan for a given task by wrapping the 'createPlanTool'.
     * @param task The user's task description.
     * @param context The runtime context.
     * @returns An ExecutionPlan object.
     */
    async createExecutionPlan(task: string, context: RuntimeContext): Promise<ExecutionPlan> {
        this.dependencies.logger.info('PlanningEngine', `Creating execution plan for task: ${task}`);

        try {
            // Leverage the existing createPlanTool
            const planToolResult: ToolResult = await this.dependencies.toolRegistry.executeTool('createPlanTool', {
                objective: task,
                context: {
                    agentName: context.agentConfig.name,
                    availableTools: context.agentConfig.tools
                }
            });

            if (!planToolResult.success || !planToolResult.result?.plan?.generatedPlan) {
                throw new Error(`createPlanTool failed or returned an invalid plan: ${planToolResult.error}`);
            }

            // For now, we'll treat the raw LLM output as the plan steps.
            // In the future, we would parse this into a structured list of PlannedStep.
            const rawPlan = planToolResult.result.plan.generatedPlan;
            const steps: PlannedStep[] = this.parseRawPlanToSteps(rawPlan);

            const plan: ExecutionPlan = {
                id: uuidv4(),
                taskDescription: task,
                steps: steps,
                confidence: 0.85 // Confidence in the generated plan
            };

            return plan;

        } catch (error) {
            this.dependencies.logger.error('PlanningEngine', `Failed to create execution plan`, { error });
            throw error;
        }
    }

    /**
     * A simple parser to convert raw text plan into structured steps.
     * This will be improved later with more robust LLM-guided JSON generation.
     */
    private parseRawPlanToSteps(rawPlan: string): PlannedStep[] {
        return rawPlan.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && /^\d+\./.test(line)) // Look for lines starting with "1.", "2.", etc.
            .map(line => ({
                id: uuidv4(),
                description: line.replace(/^\d+\.\s*/, ''),
                toolName: 'TBD', // This will be determined by a future LLM call per step
                parameters: {},
                successCriteria: 'Step completes without error.'
            }));
    }
} 