import { PipelineConfig, PipelineStep, ErrorStrategy } from '../types/sdk';
import { ServiceRegistry } from '../proto/symphonic/core/types';
import { ContextManager } from '../proto/symphonic/core/cache/context';
import { ValidationManager } from '../proto/symphonic/core/cache/validation';
import { logger, LogCategory } from '../utils/logger';

export class PipelineExecutor {
    private serviceRegistry: ServiceRegistry;
    private contextManager: ContextManager;
    private validationManager: ValidationManager;

    constructor(
        serviceRegistry: ServiceRegistry,
        contextManager: ContextManager,
        validationManager: ValidationManager
    ) {
        this.serviceRegistry = serviceRegistry;
        this.contextManager = contextManager;
        this.validationManager = validationManager;
    }

    public async execute(config: PipelineConfig, input: any): Promise<any> {
        const executionId = `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            logger.debug(LogCategory.SYSTEM, 'Starting pipeline execution', {
                metadata: {
                    pipeline: config.name,
                    executionId,
                    input: Object.keys(input)
                }
            });

            // Record execution context
            await this.contextManager.recordExecutionContext(config.name, executionId, {
                type: 'PIPELINE_EXECUTION',
                pipeline: config.name,
                input: Object.keys(input),
                steps: config.steps.map(s => s.name)
            });

            // Validate input
            const validationResult = this.validationManager.validateServiceInput(input, ['data']);
            if (!validationResult.isValid) {
                throw new Error(`Invalid input: ${validationResult.errors[0].message}`);
            }

            // Execute pipeline steps
            let currentData = input.data;
            const stepResults = [];

            for (const step of config.steps) {
                try {
                    // Check step condition
                    if (step.conditions && typeof step.conditions === 'object') {
                        const conditionsMet = Object.entries(step.conditions).every(([key, value]) => {
                            return currentData?.[key] === value;
                        });
                        if (!conditionsMet) {
                            logger.info(LogCategory.PIPELINE, `Skipping step ${step.name} - conditions not met`);
                            continue;
                        }
                    }

                    // Execute step
                    const result = await this.executeStep(step, currentData);
                    stepResults.push({
                        step: step.name,
                        success: true,
                        data: result
                    });

                    // Update current data
                    currentData = result;

                } catch (error: any) {
                    const stepError = {
                        step: step.name,
                        success: false,
                        error: error.message
                    };

                    // Handle error based on strategy
                    if (!config.errorStrategy?.type || config.errorStrategy.type === 'stop') {
                        throw new Error(`Pipeline step ${step.name} failed: ${error.message}`);
                    } else if (config.errorStrategy.type === 'retry') {
                        const retryStrategy: ErrorStrategy = {
                            type: 'retry',
                            maxRetries: config.errorStrategy.maxAttempts
                        };
                        const retryResult = await this.handleRetry(step, currentData, retryStrategy);
                        if (retryResult.success) {
                            stepResults.push({
                                step: step.name,
                                success: true,
                                data: retryResult.data,
                                retries: retryResult.retries
                            });
                            currentData = retryResult.data;
                        } else {
                            stepResults.push({
                                ...stepError,
                                retries: retryResult.retries
                            });
                            throw new Error(`Pipeline step ${step.name} failed after ${retryResult.retries} retries`);
                        }
                    } else {
                        // Skip the failed step
                        stepResults.push(stepError);
                        continue;
                    }
                }
            }

            return {
                success: true,
                steps: stepResults,
                result: currentData
            };

        } catch (error: any) {
            logger.error(LogCategory.SYSTEM, 'Pipeline execution failed', {
                metadata: {
                    pipeline: config.name,
                    executionId,
                    error: error.message,
                    stack: error.stack
                }
            });

            // Record error context
            await this.contextManager.recordErrorContext(config.name, error, {
                executionId,
                input: Object.keys(input)
            });

            throw error;
        }
    }

    private async executeStep(
        step: PipelineStep,
        input: any
    ): Promise<any> {
        logger.debug(LogCategory.SYSTEM, 'Executing pipeline step', {
            metadata: {
                step: step.name,
                tool: step.tool,
                input: Object.keys(input)
            }
        });

        // Map input using inputMap function
        const transformedInput = typeof step.inputMap === 'function' 
            ? await step.inputMap(input)
            : step.inputMap || input;

        // Execute tool
        if (!step.tool) {
            throw new Error(`No tool specified for step: ${step.name}`);
        }

        const toolId = typeof step.tool === 'string' ? step.tool : step.tool.name;
        const result = await this.serviceRegistry.executeCall(
            toolId,
            'execute',
            transformedInput
        );

        return result;
    }

    private async handleRetry(
        step: PipelineStep,
        input: any,
        errorStrategy: ErrorStrategy
    ): Promise<{ success: boolean; data?: any; retries: number }> {
        let retries = 0;
        const maxRetries = errorStrategy.maxRetries || 3;
        const retryDelay = 1000;

        while (retries < maxRetries) {
            try {
                retries++;
                if (retries > 1) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay * retries));
                }
                const result = await this.executeStep(step, input);
                return { success: true, data: result, retries };
            } catch (error) {
                if (retries === maxRetries) {
                    return { success: false, retries };
                }
            }
        }

        return { success: false, retries };
    }
} 