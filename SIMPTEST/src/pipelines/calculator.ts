import { symphony } from 'symphonic';
import type { Symphony, Pipeline, PipelineConfig } from 'symphonic';
import CalculatorTeam from '../teams/calculator';

interface PipelineResult {
    success: boolean;
    result?: number[];
    error?: Error;
    metrics?: {
        duration: number;
        startTime: number;
        endTime: number;
        teamCalls?: number;
        agentCalls?: number;
        toolCalls?: number;
    };
}

interface ProgressUpdate {
    status: string;
    result?: PipelineResult;
}

class CalculatorPipeline {
    private calculatorTeam = new CalculatorTeam();
    private pipeline: Pipeline;
    
    constructor() {
        const config: PipelineConfig = {
            name: 'Calculator Pipeline',
            description: 'A pipeline that processes multiple calculation tasks in sequence',
            steps: [
                {
                    name: 'Process Tasks',
                    description: 'Process multiple calculation tasks in sequence',
                    execute: async function*(this: CalculatorPipeline, input: { task: string } & Record<string, any>): AsyncGenerator<PipelineResult | ProgressUpdate> {
                        const startTime = Date.now();
                        const tasks = input.tasks as string[];

                        if (!tasks || tasks.length === 0) {
                            const endTime = Date.now();
                            yield {
                                success: false,
                                error: new Error('No tasks provided'),
                                result: [],
                                metrics: {
                                    duration: endTime - startTime,
                                    startTime,
                                    endTime,
                                    teamCalls: 0,
                                    agentCalls: 0,
                                    toolCalls: 0
                                }
                            };
                            return;
                        }

                        try {
                            const results: PipelineResult[] = [];
                            for (const task of tasks) {
                                const result = await this.calculatorTeam.run(task);
                                const pipelineResult: PipelineResult = {
                                    success: result.success,
                                    result: Array.isArray(result.result) ? result.result : [result.result as number],
                                    error: result.error,
                                    metrics: {
                                        duration: result.metrics?.duration || 0,
                                        startTime: result.metrics?.startTime || Date.now(),
                                        endTime: result.metrics?.endTime || Date.now(),
                                        teamCalls: 1,
                                        agentCalls: result.metrics?.agentCalls || 0,
                                        toolCalls: result.metrics?.toolCalls || 0
                                    }
                                };
                                yield { status: `Completed ${task}`, result: pipelineResult };
                                results.push(pipelineResult);
                            }

                            const endTime = Date.now();

                            // Combine all results
                            const successfulResults = results.filter(r => r.success);
                            yield {
                                success: successfulResults.length > 0,
                                result: successfulResults.flatMap(r => r.result || []),
                                metrics: {
                                    duration: endTime - startTime,
                                    startTime,
                                    endTime,
                                    teamCalls: results.length,
                                    agentCalls: results.reduce((sum, r) => sum + (r.metrics?.agentCalls || 0), 0),
                                    toolCalls: results.reduce((sum, r) => sum + (r.metrics?.toolCalls || 0), 0)
                                }
                            };
                        } catch (error) {
                            const endTime = Date.now();
                            yield {
                                success: false,
                                error: error instanceof Error ? error : new Error(String(error)),
                                result: [],
                                metrics: {
                                    duration: endTime - startTime,
                                    startTime,
                                    endTime,
                                    teamCalls: 0,
                                    agentCalls: 0,
                                    toolCalls: 0
                                }
                            };
                        }
                    }
                }
            ],
            onError: 'continue'
        };

        this.pipeline = symphony.pipeline.create(config);
    }

    async run(tasks: string[]): Promise<PipelineResult> {
        return this.pipeline.run({ task: '', tasks });
    }
}

export default CalculatorPipeline; 