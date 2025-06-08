import { v4 as uuidv4 } from 'uuid';
import { PlanningEngineInterface, RuntimeDependencies, ExecutionPlan, TaskAnalysis, TaskComplexity, PlannedStep } from "../types";
import { ToolResult, AgentConfig } from "../../types/sdk";
import { ExecutionState } from '../context/ExecutionState';
import { ToolError, ErrorCode } from '../../errors/index';

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
     * @param _state The current execution state.
     * @returns A TaskAnalysis object.
     */
    async analyzeTask(task: string, _state: ExecutionState): Promise<TaskAnalysis> {
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
     * @param agentConfig The configuration of the agent.
     * @param state The current execution state.
     * @returns An ExecutionPlan object.
     */
    async createExecutionPlan(task: string, agentConfig: AgentConfig, state: ExecutionState): Promise<ExecutionPlan> {
        this.dependencies.logger.info('PlanningEngine', `Creating execution plan for task: ${task}`);

        try {
            // Use the context-aware magic of the ContextAPI
            const planSuggestionResult = await this.dependencies.contextAPI.useMagic('suggest_tools', {
                task: task,
                context: {
                    agentName: agentConfig.name,
                    availableTools: agentConfig.tools,
                    sessionId: state.sessionId
                }
            });

            // For now, we still use the createPlanTool, but in the future,
            // the suggest_tools magic could directly return a structured plan.
            const planToolResult: ToolResult = await this.dependencies.toolRegistry.executeTool('createPlanTool', {
                objective: task,
                context: {
                    agentName: agentConfig.name,
                    availableTools: agentConfig.tools,
                    suggestions: planSuggestionResult.result?.suggestions
                }
            });

            if (!planToolResult.success || !planToolResult.result || !planToolResult.result.plan) {
                throw new ToolError(
                    'createPlanTool',
                    ErrorCode.TOOL_EXECUTION_FAILED,
                    `createPlanTool failed or returned an invalid plan: ${planToolResult.error}`,
                    { planToolResult, task },
                    { component: 'PlanningEngine', operation: 'createPlan' }
                );
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
        if (!rawPlan) {
            this.dependencies.logger.warn('PlanningEngine', 'Received an empty or null raw plan string.');
            return [];
        }

        this.dependencies.logger.info('PlanningEngine', 'Attempting to parse raw plan...', { rawPlan });

        try {
            const parsedJson = JSON.parse(rawPlan);
            let stepsArray: any[] | null = null;

            // Log the keys of the parsed object to understand its structure
            this.dependencies.logger.info('PlanningEngine', 'Parsed raw plan JSON object.', { keys: Object.keys(parsedJson) });

            // More robustly find the array of steps
            if (Array.isArray(parsedJson)) {
                stepsArray = parsedJson;
            } else if (parsedJson.plan && Array.isArray(parsedJson.plan)) {
                stepsArray = parsedJson.plan;
            } else if (parsedJson.steps && Array.isArray(parsedJson.steps)) {
                stepsArray = parsedJson.steps;
            } else {
                // Look for any key that holds an array
                const arrayKey = Object.keys(parsedJson).find(key => Array.isArray(parsedJson[key]));
                if (arrayKey) {
                    this.dependencies.logger.info('PlanningEngine', `Found plan array under unexpected key: '${arrayKey}'`);
                    stepsArray = parsedJson[arrayKey];
                }
            }

            if (!stepsArray) {
                this.dependencies.logger.warn('PlanningEngine', 'Could not find a valid step array in the parsed JSON.', { parsedJson });
                return [];
            }

            this.dependencies.logger.info('PlanningEngine', `Successfully extracted ${stepsArray.length} steps from the plan.`);

            return stepsArray.map((step, index) => {
                if (!step || typeof step !== 'object') {
                    this.dependencies.logger.warn('PlanningEngine', `Step ${index} is not a valid object.`, { step });
                    return null;
                }
                return {
                    id: uuidv4(),
                    description: step.description || `Execute step for ${step.tool || 'TBD'}`,
                    toolName: step.useTool === false ? 'none' : step.tool || 'TBD',
                    parameters: step.parameters || {},
                    successCriteria: 'Step completes without error.'
                };
            }).filter((step): step is PlannedStep => step !== null);

        } catch (error) {
            this.dependencies.logger.error('PlanningEngine', 'Failed to parse raw plan JSON, falling back to line-by-line.', { rawPlan, error });
            // Fallback to line-by-line parsing if JSON fails
            return rawPlan.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && /^\d+\./.test(line))
                .map(line => ({
                    id: uuidv4(),
                    description: line.replace(/^\d+\.\s*/, ''),
                    toolName: 'TBD',
                    parameters: {},
                    successCriteria: 'Step completes without error.'
                }));
        }
    }
} 