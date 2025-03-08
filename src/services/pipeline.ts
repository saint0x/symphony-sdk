import { ISymphony } from '../symphony/interfaces/types';
import { BaseManager } from '../managers/base';
import { IPipelineService } from './interfaces';
import { Pipeline, PipelineConfig } from '../types/sdk';
import { generateId } from '../utils/id';

export class PipelineService extends BaseManager implements IPipelineService {
    constructor(symphony: ISymphony) {
        super(symphony, 'PipelineService');
        // Add dependencies
        this.addDependency(symphony.validation);
        this.addDependency(symphony.componentManager);
        this.addDependency(symphony.tool);
        this.addDependency(symphony.agent);
        this.addDependency(symphony.team);
    }

    async create(input: string | Partial<PipelineConfig>): Promise<Pipeline> {
        if (typeof input === 'string') {
            // Create from name
            return this.createFromName(input);
        } else {
            // Create from config
            return this.createPipeline(input);
        }
    }

    private async createFromName(name: string): Promise<Pipeline> {
        // Create pipeline from name using inference
        const config: Partial<PipelineConfig> = {
            name,
            description: `Pipeline ${name}`,
            steps: []
        };
        return this.createPipeline(config);
    }

    private async createPipeline(config: Partial<PipelineConfig>): Promise<Pipeline> {
        this.assertInitialized();
        return this.withErrorHandling('createPipeline', async () => {
            const validation = await this.symphony.validation.validate(config, 'PipelineConfig');
            if (!validation.isValid) {
                throw new Error(`Invalid pipeline configuration: ${validation.errors.join(', ')}`);
            }

            const pipeline: Pipeline = {
                id: generateId(),
                name: config.name || 'Unnamed Pipeline',
                description: config.description || 'No description provided',
                steps: config.steps || [],
                run: async (input?: any) => {
                    const metricId = `pipeline_${config.name}_run_${Date.now()}`;
                    this.symphony.startMetric(metricId, { pipelineName: config.name, input });

                    try {
                        let currentInput = input;
                        const stepResults = [];

                        for (const step of config.steps || []) {
                            const stepMetricId = `step_${step.id}_${Date.now()}`;
                            this.symphony.startMetric(stepMetricId, {
                                stepId: step.id,
                                input: currentInput
                            });

                            try {
                                const result = await step.handler(currentInput);
                                stepResults.push(result);
                                currentInput = result;

                                this.symphony.endMetric(stepMetricId, {
                                    success: true,
                                    output: result
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
                            results: stepResults
                        });

                        return {
                            success: true,
                            result: stepResults
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
        });
    }

    protected async initializeInternal(): Promise<void> {
        // No additional initialization needed
    }
} 