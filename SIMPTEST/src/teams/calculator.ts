import { symphony } from 'symphonic';
import { calculatorAgent } from '../agents/calculator';
import { TeamConfig } from 'symphonic/types';

class CalculatorTeam {
    private team: any;
    private initialized: boolean = false;
    private metrics: Record<string, any> = {};

    constructor() {
        // Configuration follows the validated TeamConfig schema
        const config: TeamConfig = {
            name: 'Calculator Team',
            description: 'A team of calculator agents that work together to solve complex calculations',
            agents: [calculatorAgent],  // Simple array of agents as required by schema
            strategy: {
                name: 'roundRobin',
                description: 'Distribute calculations evenly among agents',
                assignmentLogic: async (task: string, agents: any[]) => agents,
                coordinationRules: {
                    maxParallelTasks: 2,
                    taskTimeout: 5000
                }
            }
        };

        this.initialize(config);
    }

    private async initialize(config: TeamConfig): Promise<void> {
        try {
            // Ensure symphony is initialized
            if (!symphony.isInitialized()) {
                await symphony.initialize();
            }

            // Create team with validated config
            this.team = await symphony.team.createTeam(config);
            this.initialized = true;

            // Start initialization metric
            symphony.startMetric('calculator_team_init', {
                teamName: config.name,
                agentCount: config.agents.length
            });
        } catch (error) {
            symphony.startMetric('calculator_team_init', {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private assertInitialized(): void {
        if (!this.initialized) {
            throw new Error('Calculator team is not initialized');
        }
    }

    async run(task: string, options: any = {}): Promise<any> {
        this.assertInitialized();

        const metricId = `calculator_team_run_${Date.now()}`;
        symphony.startMetric(metricId, { task });

        try {
            // Parse the task to get numbers for parallel processing
            const numbers = this.parseTask(task);
            
            // Create parallel execution promises
            const executions = numbers.map(async (group) => {
                const operationId = `operation_${group.join('_')}`;
                symphony.startMetric(operationId, { group });
                
                try {
                    const result = await calculatorAgent.run(`Add the numbers ${group.join(', ')}`, {
                        onProgress: options.onProgress
                    });

                    symphony.endMetric(operationId, {
                        success: result.success,
                        duration: Date.now() - this.metrics[operationId]?.startTime
                    });

                    return result;
                } catch (error) {
                    symphony.endMetric(operationId, {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    throw error;
                }
            });

            // Execute all calculations in parallel
            const results = await Promise.allSettled(executions);

            // Process results
            const successResults = results
                .filter(r => r.status === 'fulfilled')
                .map(r => (r as PromiseFulfilledResult<any>).value)
                .filter(r => r.success);

            const errorResults = results
                .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
                .map(r => r.status === 'rejected' ? r.reason : r.value.error);

            // End metric with success
            symphony.endMetric(metricId, {
                success: errorResults.length === 0,
                successCount: successResults.length,
                errorCount: errorResults.length
            });

            return {
                success: errorResults.length === 0,
                result: successResults.map(r => r.result),
                errors: errorResults
            };
        } catch (error) {
            // End metric with error
            symphony.endMetric(metricId, {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });

            throw error;
        }
    }

    private parseTask(task: string): number[][] {
        // Extract number groups from task string
        // Example: "Calculate (10 + 20 + 30) and (40 + 50 + 60) in parallel"
        // Returns: [[10, 20, 30], [40, 50, 60]]
        const groups = task.match(/\(([^)]+)\)/g) || [];
        return groups.map(group => 
            group.replace(/[()]/g, '')
                .split('+')
                .map(num => parseInt(num.trim()))
                .filter(num => !isNaN(num))
        );
    }
}

export const calculatorTeam = new CalculatorTeam(); 