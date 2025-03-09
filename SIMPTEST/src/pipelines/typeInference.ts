import type { PipelineConfig, PipelineResult, ToolResult, PipelineStep } from 'symphonic';
import typeInferenceTool from '../tools/typeInference';
import TransformerAgent from '../agents/transformer';

export interface TypeInferenceResult extends PipelineResult {
    metadata: {
        pipelineSteps?: Array<{
            name: string;
            duration?: number;
            typeChecks?: number;
            operations?: number;
            typeAnalysis?: Record<string, string>;
        }>;
    };
}

interface StepResult extends ToolResult<any> {
    stepMetadata?: {
        typeAnalysis?: Record<string, string>;
    };
}

class TypeInferencePipeline {
    private config: PipelineConfig;
    private transformer: TransformerAgent;

    constructor() {
        this.transformer = new TransformerAgent();
        
        this.config = {
            name: 'Type Inference Pipeline',
            description: 'Tests complex type inference scenarios',
            metrics: {
                enabled: true,
                detailed: true,
                trackMemory: false
            },
            steps: [
                {
                    name: 'initial_analysis',
                    description: 'Analyze input types',
                    tool: typeInferenceTool,
                    handler: async ({ input }: { input: any }): Promise<StepResult> => {
                        const startTime = Date.now();
                        const result = await typeInferenceTool.handler({
                            value: input,
                            operation: 'analyze'
                        }) as any; // Type assertion to access metadata
                        const endTime = Date.now();
                        return {
                            success: result.success,
                            result: result.result,
                            stepMetadata: {
                                typeAnalysis: result.metadata?.typeAnalysis
                            },
                            metrics: {
                                startTime,
                                endTime,
                                duration: endTime - startTime,
                                operations: result.metrics?.operations || 0,
                                typeChecks: result.metrics?.typeChecks || 0,
                                stepResults: {}
                            }
                        };
                    }
                } as PipelineStep,
                {
                    name: 'recursive_wrap',
                    description: 'Create recursive type structure',
                    tool: typeInferenceTool,
                    handler: async ({ input, context }: { input: any; context: any }): Promise<StepResult> => {
                        const startTime = Date.now();
                        const depth = context.complexity || 3;
                        const result = await typeInferenceTool.handler({
                            value: input,
                            depth,
                            operation: 'wrap'
                        }) as any; // Type assertion to access metadata
                        const endTime = Date.now();
                        return {
                            success: result.success,
                            result: result.result,
                            stepMetadata: {
                                typeAnalysis: result.metadata?.typeAnalysis
                            },
                            metrics: {
                                startTime,
                                endTime,
                                duration: endTime - startTime,
                                operations: result.metrics?.operations || 0,
                                typeChecks: result.metrics?.typeChecks || 0,
                                stepResults: {}
                            }
                        };
                    }
                } as PipelineStep,
                {
                    name: 'transform_complex',
                    description: 'Transform to complex structure',
                    tool: typeInferenceTool,
                    handler: async ({ input, context }: { input: any; context: any }): Promise<StepResult> => {
                        const startTime = Date.now();
                        const depth = context.complexity || 3;
                        const result = await typeInferenceTool.handler({
                            value: input,
                            depth,
                            operation: 'transform'
                        }) as any; // Type assertion to access metadata
                        const endTime = Date.now();
                        return {
                            success: result.success,
                            result: result.result,
                            stepMetadata: {
                                typeAnalysis: result.metadata?.typeAnalysis
                            },
                            metrics: {
                                startTime,
                                endTime,
                                duration: endTime - startTime,
                                operations: result.metrics?.operations || 0,
                                typeChecks: result.metrics?.typeChecks || 0,
                                stepResults: {}
                            }
                        };
                    }
                } as PipelineStep,
                {
                    name: 'string_transformation',
                    description: 'Apply string transformations',
                    tool: typeInferenceTool, // Using typeInferenceTool as a placeholder
                    handler: async ({ input }: { input: any }): Promise<StepResult> => {
                        const startTime = Date.now();
                        // Convert complex structure to JSON string
                        const jsonString = JSON.stringify(input);
                        
                        // Apply multiple transformations
                        const result = await this.transformer.run(
                            `Transform "${jsonString}" to uppercase then to base64`
                        );
                        const endTime = Date.now();
                        
                        return {
                            success: result.success,
                            result: result.result,
                            stepMetadata: {},
                            metrics: {
                                startTime,
                                endTime,
                                duration: endTime - startTime,
                                operations: 2, // uppercase + base64
                                typeChecks: 0,
                                stepResults: {}
                            }
                        };
                    }
                } as PipelineStep
            ],
            onError: async (error: Error, context: any) => {
                console.error('Pipeline error:', error);
                return {
                    retry: false,
                    delay: 0
                };
            }
        };
    }

    getConfig(): PipelineConfig {
        return this.config;
    }

    async run(
        pipeline: any,
        input: any,
        options: { complexity?: number } = {}
    ): Promise<TypeInferenceResult> {
        const startTime = Date.now();
        const context = {
            complexity: options.complexity || 3,
            startTime
        };

        try {
            const results = [];
            let currentInput = input;
            
            for (const step of this.config.steps) {
                try {
                    const result = await step.handler({ input: currentInput, context }) as StepResult;
                    results.push({
                        name: step.name,
                        result: result.result,
                        metadata: result.stepMetadata,
                        metrics: {
                            duration: result.metrics?.duration,
                            operations: result.metrics?.operations,
                            typeChecks: result.metrics?.typeChecks
                        }
                    });
                    currentInput = result.result;
                } catch (error) {
                    if (this.config.onError) {
                        await this.config.onError(
                            error instanceof Error ? error : new Error(String(error)),
                            { lastResult: currentInput }
                        );
                    }
                    throw error;
                }
            }

            const endTime = Date.now();
            
            return {
                success: true,
                result: currentInput,
                metadata: {
                    pipelineSteps: results.map(step => ({
                        name: step.name,
                        duration: step.metrics?.duration,
                        typeChecks: step.metrics?.typeChecks,
                        operations: step.metrics?.operations,
                        typeAnalysis: step.metadata?.typeAnalysis
                    }))
                },
                metrics: {
                    startTime,
                    endTime,
                    duration: endTime - startTime,
                    steps: results.length,
                    totalOperations: results.reduce(
                        (sum, step) => sum + (step.metrics?.operations || 0), 
                        0
                    ),
                    totalTypeChecks: results.reduce(
                        (sum, step) => sum + (step.metrics?.typeChecks || 0), 
                        0
                    ),
                    stepResults: {}
                }
            };
        } catch (error) {
            const endTime = Date.now();
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                result: null,
                metadata: {
                    pipelineSteps: []
                },
                metrics: {
                    startTime,
                    endTime,
                    duration: endTime - startTime,
                    steps: 0,
                    totalOperations: 0,
                    totalTypeChecks: 0,
                    stepResults: {}
                }
            };
        }
    }
}

export default TypeInferencePipeline; 