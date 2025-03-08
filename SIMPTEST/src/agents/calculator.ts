import { symphony } from '../sdk';
import { tripleAddTool } from '../tools/calculator';
import { Agent, AgentResult } from 'symphonic/types';
import { SymphonyComponentManager } from '../core/component-manager';
import { CapabilityBuilder, CommonCapabilities } from '../core/component-manager/types/metadata';

class CalculatorAgent {
    private agent: Agent;

    constructor() {
        return SymphonyComponentManager.getInstance().register({
            id: 'calculatorAgent',
            name: 'Calculator Agent',
            type: 'agent',
            description: 'An agent that performs arithmetic calculations using tools',
            version: '1.0.0',
            capabilities: [
                {
                    name: CapabilityBuilder.agent('TOOL_USE'),
                    parameters: {
                        task: { type: 'string', required: true }
                    },
                    returns: {
                        type: 'number',
                        description: 'The result of the arithmetic calculation'
                    }
                }
            ],
            requirements: [
                {
                    capability: CapabilityBuilder.numeric('ADD'),
                    required: true
                }
            ],
            provides: ['agent.arithmetic', 'agent.calculation'],
            tags: ['math', 'agent', 'calculator']
        }, this);
    }

    async initialize() {
        this.agent = await symphony.agent.createAgent({
            name: 'calculator',
            description: 'Performs arithmetic calculations',
            task: 'Add three numbers together',
            tools: [tripleAddTool],
            handler: async (task: string) => {
                // Extract numbers from the task string
                const numbers = task.match(/\d+/g)?.map(Number) || [];
                if (numbers.length < 3) {
                    throw new Error('Need exactly three numbers to add');
                }
                
                // Use the first three numbers found
                const result = await tripleAddTool.run({
                    num1: numbers[0],
                    num2: numbers[1],
                    num3: numbers[2]
                });
                
                return {
                    success: result.success,
                    result: result.result,
                    error: result.error
                };
            }
        });
    }

    async run(task: string, options?: { onProgress?: (update: { status: string }) => void }): Promise<AgentResult> {
        return this.agent.run(task, options);
    }
}

export const calculatorAgent = new CalculatorAgent(); 