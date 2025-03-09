import { ISymphony } from '../../types/symphony';
import { BaseManager } from '../../managers/base';
import { PipelineConfig, ToolConfig } from '../../types/sdk';
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

                    const stepResults: Array<{
                        step: string;
                        success: boolean;
                        result?: any;
                        error?: string;
                    }> = [];

                    try {
                        let currentInput = input;

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
                                        const toolConfig: ToolConfig = {
                                            name: step.name,
                                            type: 'pipeline_step',
                                            config: {
                                                handler: async () => {
                                                    const result = await step.tool;
                                                    return { success: true, result };
                                                }
                                            }
                                        };
                                        return await this.toolService.createTool(step.name, toolConfig);
                                    } else if (step.tool) {
                                        return await this.toolService.createTool(step.name, step.tool);
                                    } else {
                                        throw new Error(`No tool specified for step: ${step.name}`);
                                    }
                                })();

                                if (!result || typeof result !== 'object' || !('run' in result)) {
                                    throw new Error(`Invalid tool created for step: ${step.name}`);
                                }

                                const toolResult = await result.run(stepInput);
                                stepResults.push({
                                    step: step.name,
                                    success: true,
                                    result: toolResult
                                });

                                // Update current input for next step
                                if (step.outputs && typeof step.outputs === 'object') {
                                    currentInput = Object.entries(step.outputs).reduce((acc, [key, value]) => {
                                        if (typeof toolResult === 'object' && value in toolResult) {
                                            acc[key] = toolResult[value as keyof typeof toolResult];
                                        }
                                        return acc;
                                    }, {} as Record<string, any>);
                                } else {
                                    currentInput = toolResult;
                                }

                            } catch (error) {
                                stepResults.push({
                                    step: step.name,
                                    success: false,
                                    error: error instanceof Error ? error.message : String(error)
                                });
                                throw error;
                            } finally {
                                this.symphony.endMetric(stepMetricId);
                            }
                        }

                        this.symphony.endMetric(metricId);
                        return {
                            success: true,
                            steps: stepResults,
                            result: currentInput
                        };

                    } catch (error) {
                        this.symphony.endMetric(metricId);
                        return {
                            success: false,
                            error: error instanceof Error ? error.message : String(error),
                            steps: stepResults
                        };
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