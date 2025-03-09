import { symphony } from 'symphonic';
import type { Symphony, Team, TeamConfig } from 'symphonic';
import CalculatorAgent from '../agents/calculator';

interface TaskResult {
    success: boolean;
    result?: number | number[];
    error?: Error;
    metrics?: {
        duration: number;
        startTime: number;
        endTime: number;
        toolCalls?: number;
        agentCalls?: number;
    };
}

interface ProgressUpdate {
    status: string;
    result?: TaskResult;
}

class CalculatorTeam {
    private calculatorAgent = new CalculatorAgent();
    private team: Team;
    
    constructor() {
        const config: TeamConfig = {
            name: 'Calculator Team',
            description: 'A team of calculator agents that work together on complex calculations',
            agents: ['calculator'],
            executeStream: async function*(this: CalculatorTeam, input: { task: string }): AsyncGenerator<TaskResult | ProgressUpdate> {
                const startTime = Date.now();
                const { task } = input;

                // Parse task to get number groups
                const numberGroups = task.match(/\(\d+,\s*\d+,\s*\d+\)/g)?.map(group => {
                    const numbers = group.match(/\d+/g)?.map(Number) || [];
                    return numbers;
                }) || [];

                if (numberGroups.length === 0) {
                    const endTime = Date.now();
                    yield {
                        success: false,
                        error: new Error('Task must contain at least one group of three numbers in format (x, y, z)'),
                        result: [],
                        metrics: {
                            duration: endTime - startTime,
                            startTime,
                            endTime,
                            agentCalls: 0,
                            toolCalls: 0
                        }
                    };
                    return;
                }

                // Create subtasks for each number group
                const subtasks = numberGroups.map(numbers => ({
                    task: `Add the numbers ${numbers[0]}, ${numbers[1]}, and ${numbers[2]}`,
                    numbers
                }));

                try {
                    // Execute subtasks with calculator agent
                    const results: TaskResult[] = [];
                    for (const { task } of subtasks) {
                        const result = await this.calculatorAgent.run(task);
                        const taskResult: TaskResult = {
                            success: result.success,
                            result: result.result,
                            error: result.error,
                            metrics: {
                                duration: result.metrics?.duration || 0,
                                startTime: result.metrics?.startTime || Date.now(),
                                endTime: result.metrics?.endTime || Date.now(),
                                agentCalls: 1,
                                toolCalls: result.metrics?.toolCalls || 0
                            }
                        };
                        yield { status: `Completed ${task}`, result: taskResult };
                        results.push(taskResult);
                    }

                    const endTime = Date.now();

                    // Combine results
                    const successfulResults = results.filter(r => r.success);
                    yield {
                        success: successfulResults.length > 0,
                        result: successfulResults.map(r => r.result).filter((r): r is number => typeof r === 'number'),
                        metrics: {
                            duration: endTime - startTime,
                            startTime,
                            endTime,
                            agentCalls: results.length,
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
                            agentCalls: 0,
                            toolCalls: 0
                        }
                    };
                }
            }
        };

        this.team = symphony.team.create(config);
    }

    async run(task: string): Promise<TaskResult> {
        return this.team.run(task);
    }
}

export default CalculatorTeam;

export const initialize = async (symphony: Symphony): Promise<void> => {
    // Initialization logic here
}; 