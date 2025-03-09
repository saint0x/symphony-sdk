import sdkInstance from '../sdk';
import CalculatorAgent from '../agents/calculator';
import CalculatorTeam from '../teams/calculator';

interface CalculatorInput {
    operation: string;
    numbers: number[];
}

interface CalculatorMetrics {
    duration: number;
    startTime: number;
    endTime: number;
    stepResults?: {
        validation?: any;
        calculation?: any;
        error?: {
            message: string;
            stack?: string;
        };
    };
}

interface CalculatorResult {
    success: boolean;
    result: number | null;
    error?: Error;
    metrics: CalculatorMetrics;
}

class CalculatorPipeline {
    private calculatorAgent = new CalculatorAgent();
    private calculatorTeam = new CalculatorTeam();
    private pipeline: Promise<any>;
    
    constructor() {
        this.pipeline = sdkInstance.then(sdk =>
            sdk.pipeline.create({
                name: 'Calculator Pipeline',
                description: 'A pipeline that coordinates calculator agents and teams',
                steps: [
                    {
                        id: 'validate',
                        name: 'Input Validation',
                        description: 'Validates the input numbers and operation',
                        tool: 'validator',
                        inputs: ['operation', 'numbers'],
                        handler: async ({ operation, numbers }: CalculatorInput) => {
                            if (!operation || !numbers || !Array.isArray(numbers)) {
                                return {
                                    success: false,
                                    error: new Error('Invalid input format'),
                                    result: null
                                };
                            }
                            return { success: true, result: { operation, numbers } };
                        },
                        expects: { operation: 'string', numbers: 'array' },
                        outputs: { operation: 'string', numbers: 'array' },
                        chained: 0
                    },
                    {
                        id: 'calculate',
                        name: 'Calculation',
                        description: 'Performs the arithmetic operation',
                        tool: 'calculator',
                        inputs: ['operation', 'numbers'],
                        handler: async ({ operation, numbers }: CalculatorInput) => {
                            const task = `${operation} the numbers ${numbers.join(', ')}`;
                            return this.calculatorAgent.run(task);
                        },
                        expects: { operation: 'string', numbers: 'array' },
                        outputs: { result: 'number' },
                        chained: 1
                    }
                ],
                validation: {
                    schema: {
                        operation: {
                            type: 'string',
                            required: true,
                            enum: ['add', 'subtract', 'multiply', 'divide']
                        },
                        numbers: {
                            type: 'array',
                            required: true
                        }
                    }
                },
                errorStrategy: {
                    type: 'retry',
                    maxRetries: 3
                },
                metrics: {
                    enabled: true,
                    detailed: true,
                    trackMemory: true
                }
            })
        );
    }

    async run(input: CalculatorInput): Promise<CalculatorResult> {
        const pipeline = await this.pipeline;
        const startTime = Date.now();
        
        try {
            const result = await pipeline.run(input);
            const endTime = Date.now();

            return {
                ...result,
                metrics: {
                    duration: endTime - startTime,
                    startTime,
                    endTime,
                    stepResults: {
                        validation: result.metrics?.validation,
                        calculation: result.metrics?.calculation
                    }
                }
            };
        } catch (error) {
            const endTime = Date.now();
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                result: null,
                metrics: {
                    duration: endTime - startTime,
                    startTime,
                    endTime,
                    stepResults: {
                        error: {
                            message: error instanceof Error ? error.message : String(error),
                            stack: error instanceof Error ? error.stack : undefined
                        }
                    }
                }
            };
        }
    }
}

export default CalculatorPipeline; 