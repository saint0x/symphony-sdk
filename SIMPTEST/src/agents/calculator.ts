import { symphony } from '../sdk';
import type { Agent, AgentResult, AgentConfig } from '../sdk';
import { tripleAddTool } from '../tools/calculator';

class CalculatorAgent {
    private agent!: Agent;
    private initialized: boolean = false;

    constructor() {
        // Don't register in constructor
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        // Register the component
        await symphony.componentManager.register({
            id: 'calculatorAgent',
            name: 'Calculator Agent',
            type: 'agent',
            description: 'An agent that performs arithmetic calculations using tools',
            version: '1.0.0',
            capabilities: [
                {
                    name: symphony.types.CapabilityBuilder.agent('TOOL_USE'),
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
                    capability: symphony.types.CapabilityBuilder.numeric('ADD'),
                    required: true
                }
            ],
            provides: ['agent.arithmetic', 'agent.calculation'],
            tags: ['math', 'agent', 'calculator']
        }, this);

        // Ensure agent service and tool are initialized
        await Promise.all([
            symphony.agent.initialize(),
            tripleAddTool.initialize()
        ]);

        const agentConfig: AgentConfig = {
            name: 'calculator',
            description: 'Performs arithmetic calculations',
            task: 'Add three numbers together',
            tools: [tripleAddTool],
            llm: symphony.types.DEFAULT_LLM_CONFIG,
            maxCalls: 10,
            requireApproval: false,
            timeout: 30000
        };

        this.agent = await symphony.agent.create(agentConfig);
        this.initialized = true;
    }

    async run(task: string, options?: { onProgress?: (update: { status: string }) => void }): Promise<AgentResult> {
        if (!this.initialized || !this.agent) {
            await this.initialize();
        }

        // Extract numbers from the task string
        const numbers = task.match(/\d+/g)?.map(Number) || [];
        if (numbers.length < 3) {
            throw new Error('Task must contain at least three numbers');
        }

        if (options?.onProgress) {
            options.onProgress({ status: 'Extracting numbers from task...' });
        }

        // Use the tripleAdd tool
        const toolResult = await tripleAddTool.run({
            num1: numbers[0],
            num2: numbers[1],
            num3: numbers[2]
        });

        if (options?.onProgress) {
            options.onProgress({ status: 'Calculation completed' });
        }

        return {
            success: true,
            result: toolResult.result,
            metrics: {
                duration: 0,
                toolCalls: 1
            }
        };
    }
}

export const calculatorAgent = new CalculatorAgent(); 