import { Symphony } from '../symphony/core/symphony';
import { BaseManager } from '../managers/base';

export class PipelineService extends BaseManager {
    constructor(symphony: Symphony) {
        super(symphony, 'PipelineService');
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            this.logInfo('Already initialized');
            return;
        }

        await this.initializeInternal();
        this.initialized = true;
        this.logInfo('Initialization complete');
    }

    async createPipeline(config: any): Promise<any> {
        this.assertInitialized();
        return this.withErrorHandling('createPipeline', async () => {
            const validation = await this.symphony.validation.validate(config, 'PipelineConfig');
            if (!validation.isValid) {
                throw new Error(`Invalid pipeline configuration: ${validation.errors.join(', ')}`);
            }

            const pipeline = {
                ...config,
                run: async (input?: any) => {
                    const metricId = `pipeline_${config.name}_run_${Date.now()}`;
                    this.symphony.startMetric(metricId, { pipelineName: config.name, input });

                    try {
                        let currentInput = input;
                        const stepResults = [];

                        for (const step of config.steps) {
                            const stepMetricId = `step_${step.id}_${Date.now()}`;
                            this.symphony.startMetric(stepMetricId, {
                                stepId: step.id,
                                input: currentInput
                            });

                            try {
                                // Get step input
                                const stepInput = typeof step.inputs === 'function'
                                    ? step.inputs(currentInput)
                                    : step.inputs;

                                // Run step
                                const result = await step.tool.run(stepInput);
                                stepResults.push({
                                    stepId: step.id,
                                    result: result.result
                                });

                                // Update current input for next step
                                currentInput = result.result;

                                this.symphony.endMetric(stepMetricId, {
                                    success: true,
                                    result: result.result
                                });
                            } catch (error) {
                                this.symphony.endMetric(stepMetricId, {
                                    success: false,
                                    error: error instanceof Error ? error.message : String(error)
                                });
                                throw error;
                            }
                        }

                        this.symphony.endMetric(metricId, {
                            success: true,
                            stepResults
                        });

                        return {
                            success: true,
                            result: currentInput,
                            stepResults
                        };
                    } catch (error) {
                        this.symphony.endMetric(metricId, {
                            success: false,
                            error: error instanceof Error ? error.message : String(error)
                        });
                        throw error;
                    }
                }
            };

            this.logInfo(`Created pipeline: ${config.name}`);
            return pipeline;
        }, { pipelineName: config.name });
    }
} 