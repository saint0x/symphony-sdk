import { BaseService } from './base';
import { PipelineConfig, PipelineStep, ToolConfig } from '../../types/sdk';
import { Pipeline } from '../../types/components';
import { ISymphony } from '../interfaces/types';
import { assertString } from '../../utils/validation';

export class PipelineService extends BaseService {
    constructor(symphony: ISymphony) {
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

    async createPipeline(config: PipelineConfig): Promise<Pipeline> {
        this.assertInitialized();
        return this.withErrorHandling('createPipeline', async () => {
            const validation = await this.symphony.utils.validation.validateConfig(config, {
                name: { type: 'string', required: true },
                description: { type: 'string', required: true },
                steps: { type: 'array', required: true }
            });
            if (!validation.isValid) {
                throw new Error(`Invalid pipeline configuration: ${validation.errors.join(', ')}`);
            }

            const registry = await this.symphony.getRegistry();
            if (!registry) {
                throw new Error('Service registry is not available');
            }

            const pipeline: Pipeline = {
                ...config,
                run: async (input?: any) => {
                    const metricId = `pipeline_${config.name}_execute_${Date.now()}`;
                    this.symphony.utils.metrics.start(metricId, { pipelineName: config.name, input });

                    try {
                        let context = input || {};
                        let result = null;

                        for (const step of config.steps) {
                            const tool = typeof step.tool === 'string' 
                                ? await registry.getTool(step.tool)
                                : await this.symphony.tools.create({
                                    name: step.name,
                                    description: step.description,
                                    inputs: Object.keys(step.expects),
                                    handler: async (params: any) => {
                                        const toolConfig = step.tool as ToolConfig;
                                        const result = await toolConfig.handler(params);
                                        return {
                                            success: true,
                                            result: result
                                        };
                                    }
                                });

                            if (!tool) {
                                throw new Error(`Tool not found: ${typeof step.tool === 'string' ? step.tool : step.name}`);
                            }

                            const stepInput = step.inputMap 
                                ? (typeof step.inputMap === 'function' 
                                    ? await step.inputMap(context)
                                    : step.inputMap)
                                : context;

                            const stepResult = await tool.run(stepInput);
                            if (!stepResult.success) {
                                if (config.onError) {
                                    const { retry, delay } = await config.onError(
                                        stepResult.error || new Error('Step failed'),
                                        { step, context }
                                    );
                                    if (retry) {
                                        if (delay) {
                                            await new Promise(resolve => setTimeout(resolve, delay));
                                        }
                                        continue;
                                    }
                                }
                                throw stepResult.error || new Error('Step failed');
                            }

                            context = {
                                ...context,
                                [step.name]: stepResult.result
                            };
                            result = stepResult.result;
                        }

                        this.symphony.utils.metrics.end(metricId, {
                            success: true,
                            result
                        });

                        return {
                            success: true,
                            result,
                            metrics: {
                                duration: Date.now() - parseInt(metricId.split('_').pop()!),
                                startTime: parseInt(metricId.split('_').pop()!),
                                endTime: Date.now()
                            }
                        };
                    } catch (error) {
                        this.symphony.utils.metrics.end(metricId, {
                            success: false,
                            error: error instanceof Error ? error.message : String(error)
                        });
                        throw error;
                    }
                }
            };

            registry.registerPipeline(config.name, pipeline);
            this.logInfo(`Created pipeline: ${config.name}`);
            return pipeline;
        }, { pipelineName: config.name });
    }

    async loadPipeline(path: string): Promise<Pipeline> {
        this.assertInitialized();
        assertString(path, 'path');

        return this.withErrorHandling('loadPipeline', async () => {
            const config = await import(path);
            return this.createPipeline(config);
        }, { path });
    }

    async loadPipelineFromString(configStr: string): Promise<Pipeline> {
        this.assertInitialized();
        assertString(configStr, 'configStr');

        return this.withErrorHandling('loadPipelineFromString', async () => {
            const config = JSON.parse(configStr);
            return this.createPipeline(config);
        }, { configStr });
    }
} 