import { PipelineConfig, PipelineStep, ToolConfig } from '../types/sdk';
import { createMetricsTracker } from '../utils/metrics';
import { validatePipelineConfig } from '../utils/validation';
import { standardTools } from '../tools/standard';

export class BasePipeline {
    protected name: string;
    protected description: string;
    protected steps: PipelineStep[];
    protected onError?: PipelineConfig['onError'];
    protected metrics: PipelineConfig['metrics'];
    protected metricsTracker = createMetricsTracker();

    constructor(config: PipelineConfig) {
        validatePipelineConfig(config);

        this.name = config.name;
        this.description = config.description;
        this.steps = config.steps;
        this.onError = config.onError;
        this.metrics = config.metrics || {
            enabled: true,
            detailed: true,
            trackMemory: true
        };
    }

    private async executeStep(step: PipelineStep, input: any): Promise<any> {
        this.metricsTracker.trackOperation(`step_${step.name}_start`);

        try {
            // Validate input against expectations
            this.validateInput(step, input);

            // Get tool implementation
            const toolKey = typeof step.tool === 'string' ? step.tool : step.tool.name;
            const tool = typeof step.tool === 'string' 
                ? standardTools.find(t => t.name === toolKey) 
                : step.tool;
            if (!tool) {
                throw new Error(`Tool '${toolKey}' not found`);
            }

            // Execute tool with retry logic if configured
            const result = await this.executeWithRetry(tool, input, step.retry);

            // Validate output
            this.validateOutput(step, result);

            this.metricsTracker.trackOperation(`step_${step.name}_complete`);
            return result;
        } catch (error) {
            this.metricsTracker.trackOperation(`step_${step.name}_error`);
            throw error;
        }
    }

    private validateInput(step: PipelineStep, input: any) {
        for (const [key, type] of Object.entries(step.expects)) {
            if (!(key in input)) {
                throw new Error(`Missing required input '${key}' for step '${step.name}'`);
            }
            if (typeof input[key] !== type) {
                throw new Error(`Invalid type for input '${key}' in step '${step.name}'. Expected ${type}, got ${typeof input[key]}`);
            }
        }
    }

    private validateOutput(step: PipelineStep, output: any) {
        // Basic type validation
        for (const [key, type] of Object.entries(step.outputs)) {
            if (!(key in output)) {
                throw new Error(`Missing required output '${key}' from step '${step.name}'`);
            }
            if (typeof output[key] !== type) {
                throw new Error(`Invalid type for output '${key}' from step '${step.name}'. Expected ${type}, got ${typeof output[key]}`);
            }
        }

        // Custom validation if configured
        if (step.conditions?.validateOutput && !step.conditions.validateOutput(output)) {
            throw new Error(`Output validation failed for step '${step.name}'`);
        }
    }

    private async executeWithRetry(tool: ToolConfig, input: any, retry?: PipelineStep['retry']): Promise<any> {
        let lastError: Error | null = null;
        const maxAttempts = retry?.maxAttempts || 1;
        const delay = retry?.delay || 1000;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await tool.handler(input);
                if (!result.success) {
                    throw result.error || new Error('Tool execution failed');
                }
                return result.result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, delay * attempt));
                }
            }
        }

        throw lastError || new Error('Tool execution failed after retries');
    }

    async run(input: any): Promise<any> {
        this.metricsTracker.trackOperation('pipeline_start');
        
        try {
            let currentInput = input;
            const stepResults = new Map<string, any>();

            // Execute steps in order based on chaining
            const orderedSteps = [...this.steps].sort((a, b) => a.chained - b.chained);

            for (const step of orderedSteps) {
                try {
                    const result = await this.executeStep(step, currentInput);
                    stepResults.set(step.name, result);
                    currentInput = { ...currentInput, ...result };
                } catch (error) {
                    if (this.onError) {
                        const errorResult = await this.onError(
                            error instanceof Error ? error : new Error(String(error)),
                            { step, input: currentInput, results: stepResults }
                        );
                        
                        if (errorResult.retry) {
                            // Implement retry logic
                            if (errorResult.delay) {
                                await new Promise(resolve => setTimeout(resolve, errorResult.delay));
                            }
                            const retryResult = await this.executeStep(step, currentInput);
                            stepResults.set(step.name, retryResult);
                            currentInput = { ...currentInput, ...retryResult };
                            continue;
                        }
                    }
                    throw error;
                }
            }

            this.metricsTracker.trackOperation('pipeline_complete');
            return {
                success: true,
                results: Object.fromEntries(stepResults),
                metrics: this.metricsTracker.end()
            };
        } catch (error) {
            this.metricsTracker.trackOperation('pipeline_error');
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                metrics: this.metricsTracker.end()
            };
        }
    }

    async *executeStream(input: any): AsyncGenerator<any, void, unknown> {
        this.metricsTracker.trackOperation('stream_start');
        
        try {
            let currentInput = input;
            const stepResults = new Map<string, any>();

            // Execute steps in order based on chaining
            const orderedSteps = [...this.steps].sort((a, b) => a.chained - b.chained);

            for (const step of orderedSteps) {
                try {
                    yield {
                        type: 'step_start',
                        step: step.name
                    };

                    const result = await this.executeStep(step, currentInput);
                    stepResults.set(step.name, result);
                    currentInput = { ...currentInput, ...result };

                    yield {
                        type: 'step_complete',
                        step: step.name,
                        result,
                        metrics: this.metricsTracker.end()
                    };
                } catch (error) {
                    yield {
                        type: 'step_error',
                        step: step.name,
                        error: error instanceof Error ? error : new Error(String(error)),
                        metrics: this.metricsTracker.end()
                    };

                    if (this.onError) {
                        const errorResult = await this.onError(
                            error instanceof Error ? error : new Error(String(error)),
                            { step, input: currentInput, results: stepResults }
                        );
                        
                        if (errorResult.retry) {
                            yield {
                                type: 'step_retry',
                                step: step.name
                            };

                            if (errorResult.delay) {
                                await new Promise(resolve => setTimeout(resolve, errorResult.delay));
                            }

                            const retryResult = await this.executeStep(step, currentInput);
                            stepResults.set(step.name, retryResult);
                            currentInput = { ...currentInput, ...retryResult };

                            yield {
                                type: 'step_retry_complete',
                                step: step.name,
                                result: retryResult,
                                metrics: this.metricsTracker.end()
                            };
                            continue;
                        }
                    }
                    throw error;
                }
            }

            this.metricsTracker.trackOperation('stream_complete');
            yield {
                type: 'complete',
                results: Object.fromEntries(stepResults),
                metrics: this.metricsTracker.end()
            };
        } catch (error) {
            this.metricsTracker.trackOperation('stream_error');
            yield {
                type: 'error',
                error: error instanceof Error ? error : new Error(String(error)),
                metrics: this.metricsTracker.end()
            };
        }
    }
} 