import { 
    ToolChain, 
    ToolChainStep, 
    ChainContext, 
    ChainExecutionResult, 
    ChainExecutorConfig,
    ToolResult 
} from '../types/sdk';
import { ToolRegistry } from './standard/registry';
import { Logger } from '../utils/logger';

export class ChainExecutor {
    private static instance: ChainExecutor;
    private toolRegistry: ToolRegistry;
    private logger: Logger;
    private config: ChainExecutorConfig;

    private constructor() {
        this.toolRegistry = ToolRegistry.getInstance();
        this.logger = Logger.getInstance('ChainExecutor');
        this.config = {
            maxParallelSteps: 5,
            stepTimeoutMs: 30000,
            retryFailedSteps: false,
            continueOnStepFailure: false,
            logLevel: 'detailed'
        };
    }

    static getInstance(): ChainExecutor {
        if (!ChainExecutor.instance) {
            ChainExecutor.instance = new ChainExecutor();
        }
        return ChainExecutor.instance;
    }

    updateConfig(newConfig: Partial<ChainExecutorConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.logger.info('ChainExecutor', 'Configuration updated', { config: this.config });
    }

    async executeChain(chain: ToolChain, input: Record<string, any> = {}): Promise<ChainExecutionResult> {
        const executionId = `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const context: ChainContext = {
            input,
            stepResults: new Map(),
            chainId: chain.id,
            executionId,
            startTime: Date.now()
        };

        this.logger.info('ChainExecutor', `Starting chain execution: ${chain.name}`, {
            chainId: chain.id,
            executionId,
            stepCount: chain.steps.length,
            input
        });

        try {
            // Sort steps by semantic number for execution order
            const sortedSteps = this.sortStepsBySemanticNumber(chain.steps);
            
            // Group steps for parallel execution
            const executionGroups = this.groupStepsForExecution(sortedSteps);
            
            let completedSteps: string[] = [];
            let failedSteps: string[] = [];
            let stepTimings: Record<string, number> = {};

            // Execute each group (sequential groups, parallel within groups)
            for (const group of executionGroups) {
                const groupResults = await this.executeStepGroup(group, context);
                
                // Update tracking
                for (const [stepId, result] of groupResults) {
                    if (result.success) {
                        completedSteps.push(stepId);
                    } else {
                        failedSteps.push(stepId);
                        if (!this.config.continueOnStepFailure) {
                            throw new Error(`Step ${stepId} failed: ${result.error}`);
                        }
                    }
                    stepTimings[stepId] = result.metrics?.duration || 0;
                }
            }

            // Generate final result
            const finalResult = this.generateFinalResult(chain, context);
            const totalDuration = Date.now() - context.startTime;

            this.logger.info('ChainExecutor', `Chain execution completed: ${chain.name}`, {
                executionId,
                totalDuration,
                completedSteps: completedSteps.length,
                failedSteps: failedSteps.length
            });

            return {
                success: true,
                result: finalResult,
                context,
                metrics: {
                    totalDuration,
                    stepCount: chain.steps.length,
                    parallelGroups: executionGroups.length,
                    failedSteps,
                    completedSteps,
                    stepTimings
                }
            };

        } catch (error) {
            const totalDuration = Date.now() - context.startTime;
            this.logger.error('ChainExecutor', `Chain execution failed: ${chain.name}`, {
                executionId,
                error: error instanceof Error ? error.message : String(error),
                totalDuration
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                context,
                metrics: {
                    totalDuration,
                    stepCount: chain.steps.length,
                    parallelGroups: 0,
                    failedSteps: chain.steps.map(s => s.id),
                    completedSteps: [],
                    stepTimings: {}
                }
            };
        }
    }

    private sortStepsBySemanticNumber(steps: ToolChainStep[]): ToolChainStep[] {
        return steps.sort((a, b) => {
            // Parse semantic numbers (e.g., "1", "2.1", "2.2", "3")
            const parseSemanticNumber = (num: string): number[] => {
                return num.split('.').map(n => parseInt(n, 10));
            };

            const aNumbers = parseSemanticNumber(a.semantic_number);
            const bNumbers = parseSemanticNumber(b.semantic_number);

            // Compare each level
            for (let i = 0; i < Math.max(aNumbers.length, bNumbers.length); i++) {
                const aVal = aNumbers[i] || 0;
                const bVal = bNumbers[i] || 0;
                if (aVal !== bVal) {
                    return aVal - bVal;
                }
            }
            return 0;
        });
    }

    private groupStepsForExecution(steps: ToolChainStep[]): ToolChainStep[][] {
        const groups: ToolChainStep[][] = [];
        let currentGroup: ToolChainStep[] = [];
        let currentLevel = '';

        for (const step of steps) {
            const level = step.semantic_number.split('.')[0];
            
            if (level !== currentLevel) {
                if (currentGroup.length > 0) {
                    groups.push(currentGroup);
                }
                currentGroup = [step];
                currentLevel = level;
            } else {
                // Same level - can be executed in parallel
                currentGroup.push(step);
            }
        }

        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    }

    private async executeStepGroup(group: ToolChainStep[], context: ChainContext): Promise<Map<string, ToolResult>> {
        const results = new Map<string, ToolResult>();

        if (group.length === 1) {
            // Single step execution
            const step = group[0];
            const result = await this.executeStep(step, context);
            results.set(step.id, result);
        } else {
            // Parallel execution
            this.logger.info('ChainExecutor', `Executing ${group.length} steps in parallel`, {
                stepIds: group.map(s => s.id),
                semanticNumbers: group.map(s => s.semantic_number)
            });

            const promises = group.map(async (step) => {
                const result = await this.executeStep(step, context);
                return { stepId: step.id, result };
            });

            const parallelResults = await Promise.allSettled(promises);
            
            for (const promiseResult of parallelResults) {
                if (promiseResult.status === 'fulfilled') {
                    results.set(promiseResult.value.stepId, promiseResult.value.result);
                } else {
                    // Handle parallel execution failure
                    const stepId = 'unknown';
                    results.set(stepId, {
                        success: false,
                        error: `Parallel execution failed: ${promiseResult.reason}`,
                        metrics: { duration: 0, startTime: Date.now(), endTime: Date.now() }
                    });
                }
            }
        }

        return results;
    }

    private async executeStep(step: ToolChainStep, context: ChainContext): Promise<ToolResult> {
        context.currentStep = step;
        
        this.logger.info('ChainExecutor', `Executing step: ${step.id}`, {
            tool: step.tool,
            semanticNumber: step.semantic_number,
            executionId: context.executionId
        });

        try {
            // Check dependencies
            if (step.depends_on) {
                for (const depId of step.depends_on) {
                    if (!context.stepResults.has(depId)) {
                        throw new Error(`Dependency not met: step ${depId} not completed`);
                    }
                    const depResult = context.stepResults.get(depId);
                    if (!depResult?.success) {
                        throw new Error(`Dependency failed: step ${depId} was not successful`);
                    }
                }
            }

            // Check condition
            if (step.condition && !step.condition(context)) {
                this.logger.info('ChainExecutor', `Skipping step due to condition: ${step.id}`);
                const skippedResult: ToolResult = {
                    success: true,
                    result: { skipped: true, reason: 'condition not met' },
                    metrics: { duration: 0, startTime: Date.now(), endTime: Date.now() }
                };
                context.stepResults.set(step.id, skippedResult);
                return skippedResult;
            }

            // Build step parameters
            const stepParams = this.buildStepParameters(step, context);
            
            // Execute the tool
            const result = await this.toolRegistry.executeTool(step.tool, stepParams);
            
            // Store result for future steps
            context.stepResults.set(step.id, result);

            this.logger.info('ChainExecutor', `Step completed: ${step.id}`, {
                success: result.success,
                duration: result.metrics?.duration || 0,
                executionId: context.executionId
            });

            return result;

        } catch (error) {
            const errorResult: ToolResult = {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                metrics: { duration: 0, startTime: Date.now(), endTime: Date.now() }
            };
            
            context.stepResults.set(step.id, errorResult);
            this.logger.error('ChainExecutor', `Step failed: ${step.id}`, { error });
            
            return errorResult;
        }
    }

    private buildStepParameters(step: ToolChainStep, context: ChainContext): Record<string, any> {
        let params: Record<string, any> = { ...step.static_params };

        // Apply input mapping from previous steps
        if (step.input_mapping) {
            for (const [paramName, sourceRef] of Object.entries(step.input_mapping)) {
                const value = this.resolveParameterReference(sourceRef, context);
                if (value !== undefined) {
                    params[paramName] = value;
                }
            }
        }

        return params;
    }

    private resolveParameterReference(ref: string, context: ChainContext): any {
        // Handle different reference formats:
        // "input.fieldName" - from chain input
        // "step1.result.fieldName" - from step result
        // "step1.fieldName" - shorthand for step1.result.fieldName
        // "step1.result" - entire result object

        if (ref.startsWith('input.')) {
            const fieldPath = ref.substring(6);
            return this.getNestedValue(context.input, fieldPath);
        }

        if (ref.includes('.')) {
            const [stepId, ...pathParts] = ref.split('.');
            const stepResult = context.stepResults.get(stepId);
            
            if (!stepResult?.success) {
                return undefined;
            }

            // If just "stepId.result", return the entire result
            if (pathParts.length === 1 && pathParts[0] === 'result') {
                // Convert complex objects to JSON string for file content
                const result = stepResult.result;
                if (typeof result === 'object' && result !== null) {
                    return JSON.stringify(result, null, 2);
                }
                return result;
            }

            const path = pathParts.join('.');
            if (path.startsWith('result.')) {
                return this.getNestedValue(stepResult.result, path.substring(7));
            } else {
                // For backward compatibility, assume it's accessing result
                return this.getNestedValue(stepResult.result, path);
            }
        }

        return undefined;
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    private generateFinalResult(chain: ToolChain, context: ChainContext): any {
        if (!chain.output_mapping) {
            // Return all step results if no mapping specified
            const allResults: Record<string, any> = {};
            for (const [stepId, result] of context.stepResults) {
                allResults[stepId] = result.result;
            }
            return allResults;
        }

        // Apply output mapping
        const finalResult: Record<string, any> = {};
        for (const [outputKey, sourceRef] of Object.entries(chain.output_mapping)) {
            const value = this.resolveParameterReference(sourceRef, context);
            if (value !== undefined) {
                finalResult[outputKey] = value;
            }
        }

        return finalResult;
    }
} 