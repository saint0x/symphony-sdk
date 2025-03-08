import { symphony } from 'symphonic';
import { tripleAddTool } from '../tools/calculator';
import { calculatorTeam } from '../teams/calculator';
import { PipelineConfig } from 'symphonic/types';

class CalculatorPipeline {
    private pipeline: any;
    private initialized: boolean = false;

    constructor() {
        // Configuration follows the validated PipelineConfig schema
        const config: PipelineConfig = {
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
                    },
                    validation: {
                        input: {
                            num1: { type: 'number', required: true },
                            num2: { type: 'number', required: true },
                            num3: { type: 'number', required: true }
                        },
                        output: {
                            result: { type: 'number', required: true }
                        }
                    }
                },
                {
                    id: 'teamProcess',
                    tool: calculatorTeam,
                    inputs: (prevResult: any) => ({
                        task: `Process the number ${prevResult.result}`
                    }),
                    validation: {
                        input: {
                            result: { type: 'number', required: true }
                        },
                        output: {
                            processed: { type: 'number', required: true }
                        }
                    }
                },
                {
                    id: 'finalAdd',
                    tool: tripleAddTool,
                    inputs: (prevResult: any) => ({
                        num1: prevResult.processed,
                        num2: 60,
                        num3: 70
                    }),
                    validation: {
                        input: {
                            num1: { type: 'number', required: true },
                            num2: { type: 'number', required: true },
                            num3: { type: 'number', required: true }
                        },
                        output: {
                            result: { type: 'number', required: true }
                        }
                    }
                }
            ]
        };

        this.initialize(config);
    }

    private async initialize(config: PipelineConfig): Promise<void> {
        try {
            // Ensure symphony is initialized
            if (!symphony.isInitialized()) {
                await symphony.initialize();
            }

            // Create pipeline with validated config
            this.pipeline = await symphony.pipeline.createPipeline(config);
            this.initialized = true;

            // Start initialization metric
            symphony.startMetric('calculator_pipeline_init', {
                pipelineName: config.name,
                stepCount: config.steps.length
            });
        } catch (error) {
            symphony.startMetric('calculator_pipeline_init', {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private assertInitialized(): void {
        if (!this.initialized) {
            throw new Error('Calculator pipeline is not initialized');
        }
    }

    async run(input?: Record<string, any>): Promise<any> {
        this.assertInitialized();

        const metricId = `calculator_pipeline_run_${Date.now()}`;
        symphony.startMetric(metricId, { input });

        try {
            const result = await this.pipeline.run(input);
            
            symphony.endMetric(metricId, {
                success: true,
                stepResults: result.stepResults
            });

            return result;
        } catch (error) {
            symphony.endMetric(metricId, {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });

            throw error;
        }
    }
}

export const calculatorPipeline = new CalculatorPipeline(); 