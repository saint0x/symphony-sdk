import { ISymphony } from '../interfaces/types';
import { BaseManager } from '../../managers/base';
import { PipelineConfig } from '../../types/sdk';
import { assertString } from '../../utils/validation';
import { ToolService } from '../../services/tool';

export class PipelineService extends BaseManager {
    private toolService: ToolService;

    constructor(symphony: ISymphony) {
        super(symphony as any, 'PipelineService');
        this.toolService = new ToolService(symphony);
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            this.logInfo('Already initialized');
            return;
        }

        await this.initializeInternal();
        await this.toolService.initialize();
        this.initialized = true;
        this.logInfo('Initialization complete');
    }

    async createPipeline(config: PipelineConfig): Promise<any> {
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
                            const stepMetricId = `step_${step.name}_${Date.now()}`;
                            this.symphony.startMetric(stepMetricId, {
                                stepId: step.name,
                                input: currentInput
                            });

                            try {
                                // Get step input
                                const stepInput = typeof step.inputMap === 'function'
                                    ? await step.inputMap(currentInput)
                                    : step.inputMap || currentInput;

                                // Run step
                                const result = await (async () => {
                                    if (typeof step.tool === 'string') {
                                        return await this.toolService.createTool({
                                            name: step.name,
                                            description: step.description,
                                            inputs: Object.keys(step.expects),
                                            handler: async () => {
                                                const result = await step.tool;
                                                return { result };
                                            }
                                        });
                                    } else {
                                        return await this.toolService.createTool(step.tool);
                                    }
                                })();

                                if (!result || typeof result !== 'object' || !('run' in result)) {
                                    throw new Error(`Invalid tool created for step: ${step.name}`);
                                }

                                const toolResult = await result.run(stepInput);
                                stepResults.push({
                                    stepId: step.name,
                                    result: toolResult.result
                                });

                                // Update current input for next step
                                currentInput = toolResult.result;

                                this.symphony.endMetric(stepMetricId, {
                                    success: true,
                                    result: toolResult.result
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

    async loadPipeline(path: string): Promise<any> {
        this.assertInitialized();
        assertString(path, 'path');

        return this.withErrorHandling('loadPipeline', async () => {
            const config = await import(path);
            return this.createPipeline(config);
        }, { path });
    }

    async loadPipelineFromString(configStr: string): Promise<any> {
        this.assertInitialized();
        assertString(configStr, 'configStr');

        return this.withErrorHandling('loadPipelineFromString', async () => {
            const config = JSON.parse(configStr);
            return this.createPipeline(config);
        }, { configStr });
    }
} 