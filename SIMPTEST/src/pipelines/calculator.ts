import { symphony } from '../sdk';
import { Pipeline, PipelineConfig, PipelineResult, PipelineStep } from '../types/sdk';
import { ToolLifecycleState } from '../types/lifecycle';

export class CalculatorPipeline implements Pipeline {
    private _state: ToolLifecycleState = ToolLifecycleState.CREATED;
    private _steps: PipelineStep[];

    constructor() {
        this._steps = [
            {
                name: 'parse',
                type: 'tool',
                config: {
                    type: 'parser',
                    operation: 'parse_math'
                }
            },
            {
                name: 'validate',
                type: 'tool',
                config: {
                    type: 'validator',
                    rules: ['math_expression']
                }
            },
            {
                name: 'calculate',
                type: 'agent',
                config: {
                    agent: 'calculator',
                    timeout: 5000
                },
                retryConfig: {
                    maxAttempts: 3,
                    delay: 1000
                }
            }
        ];
    }

    get name(): string {
        return 'calculator_pipeline';
    }

    get description(): string {
        return 'Pipeline for processing and executing calculator operations';
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    get steps(): PipelineStep[] {
        return this._steps;
    }

    async initialize(): Promise<void> {
        // Register with pipeline service
        await symphony.pipeline.createPipeline(this.name, {
            name: this.name,
            description: this.description,
            steps: this.steps,
            onError: async (error: Error, context: any) => {
                // Implement retry logic based on error type
                if (error.message.includes('timeout')) {
                    return { retry: true, delay: 2000 };
                }
                return { retry: false };
            }
        });

        this._state = ToolLifecycleState.READY;
    }

    async run(input: any): Promise<PipelineResult> {
        const startTime = Date.now();
        const stepResults: Record<string, any> = {};

        try {
            // Step 1: Parse input
            const parser = await symphony.tool.getTool('parser');
            const parsedResult = await parser.run({
                input,
                operation: 'parse_math'
            });
            stepResults.parse = parsedResult;

            // Step 2: Validate
            const validator = await symphony.tool.getTool('validator');
            const validationResult = await validator.run({
                expression: parsedResult.result
            });
            stepResults.validate = validationResult;

            // Step 3: Calculate
            const calculator = await symphony.agent.getAgent('calculator');
            const calculationResult = await calculator.run(parsedResult.result);
            stepResults.calculate = calculationResult;

            return {
                success: true,
                result: calculationResult.result,
                metrics: {
                    duration: Date.now() - startTime,
                    startTime,
                    endTime: Date.now(),
                    stepResults
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                metrics: {
                    duration: Date.now() - startTime,
                    startTime,
                    endTime: Date.now(),
                    stepResults
                }
            };
        }
    }
} 