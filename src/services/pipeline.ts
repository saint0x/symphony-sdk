import { BaseService } from './base';
import { IPipelineService } from '../types/interfaces';
import { Pipeline, PipelineConfig, ToolLifecycleState as SDKToolLifecycleState } from '../types/sdk';
import { ToolLifecycleState } from '../types/lifecycle';
import { ISymphony } from '../types/symphony';

export class PipelineService extends BaseService implements IPipelineService {
    private pipelines: Map<string, Pipeline> = new Map();

    constructor(symphony: ISymphony) {
        super(symphony, 'PipelineService');
        this._dependencies = ['ToolService', 'AgentService', 'TeamService'];
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    async createPipeline(name: string, config: PipelineConfig): Promise<Pipeline> {
        return this.withErrorHandling('createPipeline', async () => {
            this.assertInitialized();
            
            if (this.pipelines.has(name)) {
                throw new Error(`Pipeline ${name} already exists`);
            }

            // Validate pipeline config
            await this.symphony.validation.validate(config, 'pipeline');

            // Validate step dependencies
            for (const step of config.steps) {
                switch (step.type) {
                    case 'tool':
                        await this.symphony.tool.getTool(typeof step.tool === 'string' ? step.tool : step.tool?.name || '');
                        break;
                    case 'agent':
                        if (step.config?.agent) {
                            await this.symphony.agent.getAgent(step.config.agent);
                        }
                        break;
                    case 'team':
                        if (step.config?.team) {
                            await this.symphony.team.getTeam(step.config.team);
                        }
                        break;
                }
            }

            const pipeline: Pipeline = {
                name,
                description: config.description || `Pipeline ${name}`,
                state: SDKToolLifecycleState.PENDING,
                steps: config.steps,
                run: async (input: any) => {
                    const startTime = Date.now();
                    try {
                        // Execute pipeline logic
                        const stepResults = new Map<string, any>();
                        
                        // Execute each step in sequence
                        for (let i = 0; i < config.steps.length; i++) {
                            const step = config.steps[i];
                            try {
                                let result;
                                switch (step.type) {
                                    case 'tool':
                                        const tool = await this.symphony.tool.getTool(typeof step.tool === 'string' ? step.tool : step.tool?.name || '');
                                        result = await tool.run(input);
                                        break;
                                    case 'agent':
                                        if (step.config?.agent) {
                                            const agent = await this.symphony.agent.getAgent(step.config.agent);
                                            result = await agent.run(input);
                                        }
                                        break;
                                    case 'team':
                                        if (step.config?.team) {
                                            const team = await this.symphony.team.getTeam(step.config.team);
                                            result = await team.run(input);
                                        }
                                        break;
                                }
                                stepResults.set(step.name, result);
                            } catch (error) {
                                stepResults.set(step.name, { error: error instanceof Error ? error.message : String(error) });
                                if (!config.errorStrategy?.type || config.errorStrategy.type === 'stop') {
                                    throw error;
                                }
                            }
                        }

                        return {
                            success: true,
                            result: Object.fromEntries(stepResults),
                            metrics: {
                                duration: Date.now() - startTime,
                                startTime,
                                endTime: Date.now(),
                                stepResults: Object.fromEntries(stepResults)
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
                                stepResults: {}
                            }
                        };
                    }
                }
            };

            this.pipelines.set(name, pipeline);
            return pipeline;
        });
    }

    async getPipeline(name: string): Promise<Pipeline> {
        return this.withErrorHandling('getPipeline', async () => {
            this.assertInitialized();
            
            const pipeline = this.pipelines.get(name);
            if (!pipeline) {
                throw new Error(`Pipeline ${name} not found`);
            }
            return pipeline;
        });
    }

    async listPipelines(): Promise<string[]> {
        return this.withErrorHandling('listPipelines', async () => {
            this.assertInitialized();
            return Array.from(this.pipelines.keys());
        });
    }

    protected async initializeInternal(): Promise<void> {
        this.logInfo('Initializing pipeline service');
        this._state = ToolLifecycleState.READY;
    }
} 