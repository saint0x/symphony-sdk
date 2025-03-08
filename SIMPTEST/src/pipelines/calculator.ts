import { symphony } from '../sdk';
import type { Pipeline, PipelineResult, PipelineStep } from '../sdk';
import { calculatorAgent } from '../agents/calculator';
import { calculatorTeam } from '../teams/calculator';

interface StepResult {
    success: boolean;
    result: any;
    error?: string;
}

class CalculatorPipeline {
    private pipeline!: Pipeline;
    private initialized: boolean = false;

    constructor() {
        // Don't register in constructor
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        // Register the component
        await symphony.componentManager.register({
            id: 'calculatorPipeline',
            name: 'Calculator Pipeline',
            type: 'pipeline',
            description: 'A pipeline that coordinates calculator agents and teams',
            version: '1.0.0',
            capabilities: [
                {
                    name: symphony.types.CapabilityBuilder.processing('SEQUENTIAL'),
                    parameters: {
                        steps: { type: 'array', required: true }
                    },
                    returns: {
                        type: 'object',
                        description: 'The results of sequential calculations'
                    }
                }
            ],
            requirements: [
                {
                    capability: symphony.types.CapabilityBuilder.agent('TOOL_USE'),
                    required: true
                },
                {
                    capability: symphony.types.CapabilityBuilder.team('COORDINATION'),
                    required: true
                }
            ],
            provides: ['pipeline.arithmetic', 'pipeline.sequential'],
            tags: ['math', 'pipeline', 'calculator']
        }, this);

        // Ensure pipeline service and dependencies are initialized
        await Promise.all([
            symphony.pipeline.initialize(),
            calculatorAgent.initialize(),
            calculatorTeam.initialize()
        ]);

        const steps: PipelineStep[] = [
            {
                id: 'agent_calculation',
                name: 'Agent Calculation',
                description: 'Performs a calculation using the calculator agent',
                tool: {
                    name: 'agent_calculation',
                    description: 'Performs a calculation using the calculator agent',
                    inputs: ['task'],
                    run: async (inputs: any) => {
                        const task = inputs?.agent_calculation?.task || inputs?.task;
                        if (!task) {
                            throw new Error('No task provided for agent calculation');
                        }
                        const result = await calculatorAgent.run(task);
                        return result;
                    }
                },
                inputs: {
                    task: 'Add the numbers 10, 20, and 30'
                }
            },
            {
                id: 'team_calculation',
                name: 'Team Calculation',
                description: 'Performs parallel calculations using the calculator team',
                tool: {
                    name: 'team_calculation',
                    description: 'Performs parallel calculations using the calculator team',
                    inputs: ['task'],
                    run: async (inputs: any) => {
                        const task = inputs?.team_calculation?.task || inputs?.task;
                        if (!task) {
                            throw new Error('No task provided for team calculation');
                        }
                        const result = await calculatorTeam.run(task);
                        return result;
                    }
                },
                inputs: {
                    task: 'Calculate (40, 50, 60) and (70, 80, 90) in parallel'
                }
            }
        ];

        this.pipeline = await symphony.pipeline.create({
            name: 'Calculator Pipeline',
            description: 'Coordinates calculator components',
            steps
        });

        this.initialized = true;
    }

    async run(): Promise<PipelineResult> {
        if (!this.initialized || !this.pipeline) {
            await this.initialize();
        }

        try {
            console.log('Running pipeline...');
            const result = await this.pipeline.run({
                agent_calculation: {
                    task: 'Add the numbers 10, 20, and 30'
                },
                team_calculation: {
                    task: 'Calculate (40, 50, 60) and (70, 80, 90) in parallel'
                }
            });
            console.log('Pipeline result:', result);

            if (!result.success) {
                return {
                    success: false,
                    error: 'Pipeline execution failed'
                };
            }

            const pipelineResult = {
                success: true,
                result: {
                    agentCalculation: result.stepResults?.[0]?.result,
                    teamCalculation: result.stepResults?.[1]?.result
                }
            };
            console.log('Final result:', pipelineResult);
            return pipelineResult;
        } catch (error) {
            console.error('Pipeline error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

export const calculatorPipeline = new CalculatorPipeline(); 