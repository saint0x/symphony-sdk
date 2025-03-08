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

    constructor() {
        return symphony.componentManager.register({
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
    }

    async initialize() {
        const steps: PipelineStep[] = [
            {
                name: 'Agent Calculation',
                description: 'Performs a calculation using the calculator agent',
                tool: calculatorAgent,
                input: 'Add the numbers 10, 20, and 30',
                handler: async (input: string) => {
                    return calculatorAgent.run(input);
                }
            },
            {
                name: 'Team Calculation',
                description: 'Performs parallel calculations using the calculator team',
                tool: calculatorTeam,
                input: 'Calculate (40, 50, 60) and (70, 80, 90) in parallel',
                handler: async (input: string) => {
                    return calculatorTeam.run(input);
                }
            }
        ];

        this.pipeline = await symphony.pipeline.create({
            name: 'Calculator Pipeline',
            description: 'Coordinates calculator components',
            steps
        });
    }

    async run(): Promise<PipelineResult> {
        return this.pipeline.run();
    }
}

export const calculatorPipeline = new CalculatorPipeline(); 