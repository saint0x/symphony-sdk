import { symphony } from '../sdk';
import { tripleAddTool } from '../tools/calculator';
import { calculatorTeam } from '../teams/calculator';
import { Pipeline, PipelineResult } from 'symphonic/types';
import { SymphonyComponentManager } from '../core/component-manager';
import { CapabilityBuilder, CommonCapabilities } from '../core/component-manager/types/metadata';

class CalculatorPipeline {
    private pipeline: Pipeline;

    constructor() {
        return SymphonyComponentManager.getInstance().register({
            id: 'calculatorPipeline',
            name: 'Calculator Pipeline',
            type: 'pipeline',
            description: 'A pipeline that processes calculations through multiple steps',
            version: '1.0.0',
            capabilities: [
                {
                    name: CapabilityBuilder.pipeline('SEQUENTIAL'),
                    parameters: {
                        input: { type: 'object', required: true }
                    },
                    returns: {
                        type: 'object',
                        description: 'The results of the sequential calculation steps'
                    }
                }
            ],
            requirements: [
                {
                    capability: CapabilityBuilder.team('COORDINATION'),
                    required: true
                },
                {
                    capability: CapabilityBuilder.numeric('ADD'),
                    required: true
                }
            ],
            provides: ['pipeline.arithmetic', 'pipeline.sequential_processing'],
            tags: ['math', 'pipeline', 'sequential', 'calculator']
        }, this);
    }

    async initialize() {
        this.pipeline = await symphony.pipeline.createPipeline({
            name: 'Calculator Pipeline',
            description: 'A pipeline that processes calculations through multiple steps',
            steps: [
                {
                    id: 'firstAdd',
                    tool: tripleAddTool,
                    inputs: {
                        num1: 10,
                        num2: 20,
                        num3: 30
                    }
                },
                {
                    id: 'teamProcess',
                    tool: calculatorTeam,
                    inputs: {
                        task: 'Process the result from firstAdd'
                    }
                },
                {
                    id: 'finalAdd',
                    tool: tripleAddTool,
                    inputs: {
                        num1: 60,
                        num2: 70,
                        num3: 80
                    }
                }
            ],
            onStepComplete: (step, result) => {
                console.log(`Step ${step.id} completed with result:`, result);
            }
        });
    }

    async run(): Promise<PipelineResult> {
        return this.pipeline.run();
    }
}

export const calculatorPipeline = new CalculatorPipeline(); 