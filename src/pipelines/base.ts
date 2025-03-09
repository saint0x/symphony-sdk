import { ISymphony } from '../types/symphony';
import { PipelineConfig, PipelineStep } from '../types/sdk';
import { BaseService } from '../services/base';
import { createMetricsTracker } from '../utils/metrics';

export abstract class BasePipeline extends BaseService {
    protected steps: PipelineStep[] = [];
    protected readonly config: PipelineConfig;
    protected metricsTracker = createMetricsTracker();

    constructor(symphony: ISymphony, name: string, config: PipelineConfig) {
        super(symphony, name);
        this.config = config;
    }

    protected async validateStep(step: PipelineStep): Promise<void> {
        // Validate step configuration
        if (!step.name || !step.type) {
            throw new Error('Step must have name and type');
        }

        // Validate tool configuration if it's a tool step
        if (step.type === 'tool' && step.tool) {
            const toolConfig = typeof step.tool === 'string' ? { name: step.tool } : step.tool;
            await this.symphony.validation.validate(toolConfig, 'tool');
        }

        // Validate retry configuration
        if (step.retryConfig) {
            if (step.retryConfig.maxAttempts < 1) {
                throw new Error('maxAttempts must be >= 1');
            }
            if (step.retryConfig.delay < 0) {
                throw new Error('delay must be >= 0');
            }
        }

        // Validate input/output mappings
        if (step.expects) {
            const entries = Object.entries(step.expects);
            for (const [key, value] of entries) {
                if (!value) {
                    throw new Error(`Invalid input mapping for ${key}`);
                }
            }
        }

        if (step.outputs) {
            const entries = Object.entries(step.outputs);
            for (const [key, value] of entries) {
                if (!value) {
                    throw new Error(`Invalid output mapping for ${key}`);
                }
            }
        }

        // Validate conditions
        if (step.conditions?.requiredFields) {
            for (const field of step.conditions.requiredFields) {
                if (!field) {
                    throw new Error('Required field cannot be empty');
                }
            }
        }
    }

    protected async executeStep(step: PipelineStep, input: any): Promise<any> {
        this.metricsTracker.trackOperation(`step_${step.name}_start`);
        
        try {
            // Get step inputs
            const stepInput = step.input ? this.resolveStepInputs(step.input, input) : input;

            // Execute step based on type
            let result;
            switch (step.type) {
                case 'tool':
                    const toolName = typeof step.tool === 'string' ? step.tool : step.tool?.name;
                    if (!toolName) {
                        throw new Error('Tool name is required');
                    }
                    const tool = await this.symphony.tool.getTool(toolName);
                    result = await tool.run(stepInput);
                    break;
                case 'agent':
                    if (!step.agent) {
                        throw new Error('Agent name is required');
                    }
                    const agent = await this.symphony.agent.getAgent(step.agent);
                    result = await agent.run(stepInput);
                    break;
                case 'team':
                    if (!step.team) {
                        throw new Error('Team name is required');
                    }
                    const team = await this.symphony.team.getTeam(step.team);
                    result = await team.run(stepInput);
                    break;
                default:
                    throw new Error(`Unknown step type: ${step.type}`);
            }

            this.metricsTracker.trackOperation(`step_${step.name}_complete`);
            return result;
        } catch (error) {
            this.metricsTracker.trackOperation(`step_${step.name}_error`);
            throw error;
        }
    }

    protected resolveStepInputs(inputs: { step: string; field: string }[], context: any): any {
        const result: Record<string, any> = {};
        for (const input of inputs) {
            if (context[input.step] && context[input.step][input.field] !== undefined) {
                result[input.field] = context[input.step][input.field];
            }
        }
        return result;
    }

    protected compareSteps(a: PipelineStep, b: PipelineStep): number {
        // If a depends on b's output, b should come first
        if (a.input?.some(input => input.step === b.name)) {
            return 1;
        }
        // If b depends on a's output, a should come first
        if (b.input?.some(input => input.step === a.name)) {
            return -1;
        }
        // Otherwise maintain original order
        return 0;
    }

    abstract run(input: any): Promise<any>;

    async *executeStream(input: any): AsyncGenerator<any, void, unknown> {
        this.metricsTracker.trackOperation('pipeline_stream_start');
        
        try {
            let currentInput = input;
            const stepResults = new Map<string, any>();

            // Execute steps in order based on chaining
            const orderedSteps = [...this.steps].sort((a, b) => this.compareSteps(a, b));

            for (const step of orderedSteps) {
                try {
                    const result = await this.executeStep(step, currentInput);
                    stepResults.set(step.name, result);
                    currentInput = { ...currentInput, ...result };
                    yield result;
                } catch (error) {
                    if (this.config.onError) {
                        const errorResult = await this.config.onError(
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
                            yield retryResult;
                            continue;
                        }
                    }
                    throw error;
                }
            }

            this.metricsTracker.trackOperation('pipeline_stream_complete');
        } catch (error) {
            this.metricsTracker.trackOperation('pipeline_stream_error');
            throw error;
        }
    }
} 