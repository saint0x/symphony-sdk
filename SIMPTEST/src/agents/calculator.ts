import { symphony } from '../sdk';
import type { Agent, AgentResult, AgentConfig } from '../sdk';
import { tripleAddTool } from '../tools/calculator';

class CalculatorAgent {
    private agent!: Agent;

    constructor() {
        return symphony.componentManager.register({
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
    }

    async initialize() {
        const config: AgentConfig = {
            name: 'calculator',
            description: 'Performs arithmetic calculations',
            task: 'Add three numbers together',
            tools: [tripleAddTool],
            llm: symphony.types.DEFAULT_LLM_CONFIG,
            maxCalls: 10,
            requireApproval: false,
            timeout: 30000
        };

        this.agent = await symphony.agent.create(config);
    }

    async run(task: string, options?: { onProgress?: (update: { status: string }) => void }): Promise<AgentResult> {
        return this.agent.run(task, options);
    }
}

export const calculatorAgent = new CalculatorAgent(); 