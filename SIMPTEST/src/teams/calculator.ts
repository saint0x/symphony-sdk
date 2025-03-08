import { symphony } from '../sdk';
import type { Team, TeamResult } from '../sdk';
import { calculatorAgent } from '../agents/calculator';

class CalculatorTeam implements Team {
    private initialized: boolean = false;
    private agents: string[] = [];

    constructor() {
        // Don't register in constructor
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        // Register the component
        await symphony.componentManager.register({
            id: 'calculatorTeam',
            name: 'Calculator Team',
            type: 'team',
            description: 'A team of calculator agents that work together on complex calculations',
            version: '1.0.0',
            capabilities: [
                {
                    name: symphony.types.CapabilityBuilder.team('COORDINATION'),
                    parameters: {
                        task: { type: 'string', required: true }
                    },
                    returns: {
                        type: 'object',
                        description: 'The results of parallel calculations'
                    }
                }
            ],
            requirements: [
                {
                    capability: symphony.types.CapabilityBuilder.agent('TOOL_USE'),
                    required: true
                }
            ],
            provides: ['team.arithmetic', 'team.parallel_processing'],
            tags: ['math', 'team', 'parallel', 'calculator']
        }, this);

        // Ensure team service and agent are initialized
        await Promise.all([
            symphony.team.initialize(),
            calculatorAgent.initialize()
        ]);

        // Add the calculator agent to the team
        this.agents.push('calculator');

        this.initialized = true;
    }

    async run(task: string, options?: { onProgress?: (update: { status: string }) => void }): Promise<TeamResult> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (options?.onProgress) {
            options.onProgress({ status: 'Starting parallel calculations...' });
        }

        // Parse task to get number groups
        const numberGroups = task.match(/\(\d+,\s*\d+,\s*\d+\)/g)?.map(group => {
            const numbers = group.match(/\d+/g)?.map(Number) || [];
            return numbers;
        }) || [];

        if (numberGroups.length === 0) {
            throw new Error('Task must contain at least one group of three numbers in format (x, y, z)');
        }

        // Create subtasks for each number group
        const subtasks = numberGroups.map(numbers => ({
            task: `Add the numbers ${numbers[0]}, ${numbers[1]}, and ${numbers[2]}`,
            numbers
        }));

        try {
            // Execute subtasks with calculator agent
            const results = await Promise.all(subtasks.map(async ({ task }) => {
                if (options?.onProgress) {
                    options.onProgress({ status: `Processing ${task}...` });
                }
                return calculatorAgent.run(task);
            }));

            // Combine results
            const successfulResults = results.filter(r => r.success);
            const finalResult = {
                success: successfulResults.length > 0,
                result: successfulResults.map(r => r.result),
                metrics: {
                    totalCalculations: results.length,
                    successfulCalculations: successfulResults.length
                }
            };

            if (options?.onProgress) {
                options.onProgress({ 
                    status: `Completed with ${successfulResults.length} successful calculations` 
                });
            }

            return finalResult;
        } catch (error) {
            return {
                success: false,
                result: [],
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

export const calculatorTeam = new CalculatorTeam(); 