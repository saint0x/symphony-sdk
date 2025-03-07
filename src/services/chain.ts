import { logger, LogCategory } from '../utils/logger';
import { ValidationError } from '../proto/symphonic/core/cache/validation';

export interface ChainedTool {
    name: string;
    description: string;
    chained: number; // 0-1 confidence threshold
    target?: string; // Target tool to chain with
    inputs: string[];
    handler: (input: any) => Promise<{
        success: boolean;
        result: any;
    }>;
}

export interface ChainResult {
    success: boolean;
    data?: any;
    error?: ValidationError;
    metrics: {
        startTime: string;
        endTime: string;
        duration: number;
        resourceUsage: {
            memory: number;
            cpu: number;
        };
    };
}

export class ChainExecutor {
    private tools: Map<string, ChainedTool>;

    constructor() {
        this.tools = new Map();
        logger.info(LogCategory.SYSTEM, 'ChainExecutor instance created', { metadata: {} });
    }

    public registerTool(tool: ChainedTool): void {
        if (this.tools.has(tool.name)) {
            logger.warn(LogCategory.SYSTEM, 'Tool already registered', {
                metadata: {
                    name: tool.name
                }
            });
            return;
        }

        this.tools.set(tool.name, tool);
        logger.debug(LogCategory.SYSTEM, 'Tool registered', {
            metadata: {
                name: tool.name,
                chainThreshold: tool.chained,
                target: tool.target
            }
        });
    }

    public async executeChain(initialTool: string, input: any): Promise<ChainResult> {
        const startTime = new Date();
        logger.debug(LogCategory.SYSTEM, 'Starting chain execution', {
            metadata: {
                tool: initialTool,
                inputKeys: Object.keys(input)
            }
        });

        try {
            const tool = this.tools.get(initialTool);
            if (!tool) {
                throw new Error(`Tool not found: ${initialTool}`);
            }

            // Execute initial tool
            const result = await tool.handler(input);
            if (!result.success) {
                throw new Error('Initial tool execution failed');
            }

            // Check if we should chain to another tool
            if (tool.target && tool.chained > 0) {
                const targetTool = this.tools.get(tool.target);
                if (!targetTool) {
                    throw new Error(`Target tool not found: ${tool.target}`);
                }

                // Calculate confidence based on result
                const confidence = this.calculateConfidence(result.result);
                logger.debug(LogCategory.SYSTEM, 'Chain confidence calculated', {
                    metadata: {
                        confidence,
                        threshold: tool.chained
                    }
                });

                if (confidence >= tool.chained) {
                    // Execute target tool with transformed input
                    const targetInput = this.transformInput(result.result, targetTool.inputs);
                    const targetResult = await targetTool.handler(targetInput);

                    const endTime = new Date();
                    return {
                        success: targetResult.success,
                        data: targetResult.result,
                        metrics: {
                            startTime: startTime.toISOString(),
                            endTime: endTime.toISOString(),
                            duration: endTime.getTime() - startTime.getTime(),
                            resourceUsage: await this.calculateResourceUsage()
                        }
                    };
                }
            }

            // Return result from initial tool if no chaining
            const endTime = new Date();
            return {
                success: true,
                data: result.result,
                metrics: {
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    duration: endTime.getTime() - startTime.getTime(),
                    resourceUsage: await this.calculateResourceUsage()
                }
            };
        } catch (error: any) {
            const endTime = new Date();
            logger.error(LogCategory.SYSTEM, 'Chain execution failed', {
                metadata: {
                    tool: initialTool,
                    error: error.message,
                    stack: error.stack
                }
            });

            return {
                success: false,
                error: {
                    errorCode: 'CHAIN_EXECUTION_FAILED',
                    message: error.message,
                    component: initialTool,
                    severity: 'ERROR'
                },
                metrics: {
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    duration: endTime.getTime() - startTime.getTime(),
                    resourceUsage: await this.calculateResourceUsage()
                }
            };
        }
    }

    private calculateConfidence(result: any): number {
        // Simple confidence calculation based on result properties
        if (!result || typeof result !== 'object') {
            return 0;
        }

        // Check for explicit confidence score
        if ('confidence' in result && typeof result.confidence === 'number') {
            return result.confidence;
        }

        // Check for success indicators
        if ('success' in result && typeof result.success === 'boolean') {
            return result.success ? 0.8 : 0.2;
        }

        // Check for error indicators
        if ('error' in result || 'errors' in result) {
            return 0.3;
        }

        // Default confidence based on result complexity
        const complexity = Object.keys(result).length;
        return Math.min(0.5 + (complexity * 0.1), 0.9);
    }

    private transformInput(result: any, requiredInputs: string[]): any {
        const transformedInput: any = {};

        for (const input of requiredInputs) {
            if (input in result) {
                transformedInput[input] = result[input];
            } else if (typeof result === 'object') {
                // Try to find nested property
                const value = this.findNestedProperty(result, input);
                if (value !== undefined) {
                    transformedInput[input] = value;
                }
            }
        }

        logger.debug(LogCategory.SYSTEM, 'Input transformed for chaining', {
            metadata: {
                originalKeys: Object.keys(result),
                transformedKeys: Object.keys(transformedInput)
            }
        });

        return transformedInput;
    }

    private findNestedProperty(obj: any, key: string): any {
        if (key in obj) {
            return obj[key];
        }

        for (const prop in obj) {
            if (typeof obj[prop] === 'object') {
                const value = this.findNestedProperty(obj[prop], key);
                if (value !== undefined) {
                    return value;
                }
            }
        }

        return undefined;
    }

    private async calculateResourceUsage(): Promise<{ memory: number; cpu: number }> {
        return {
            memory: process.memoryUsage().heapUsed / 1024 / 1024,
            cpu: process.cpuUsage().user / 1000000
        };
    }
} 