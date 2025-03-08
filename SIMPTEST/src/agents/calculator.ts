import { symphony } from '../sdk';
import type { Agent, AgentResult, AgentConfig, Tool } from '../sdk';

interface AgentOptions {
    onProgress?: (update: { status: string; result?: any }) => void;
}

class CalculatorAgent {
    private agent!: Agent;
    private initialized: boolean = false;
    private tools: Map<string, Tool> = new Map();

    constructor() {
        // Don't register in constructor
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        // Register the component
        await symphony.componentManager.register({
            id: 'calculator',
            name: 'Calculator Agent',
            type: 'agent',
            description: 'An agent that performs arithmetic operations on three numbers',
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
                { capability: symphony.types.CapabilityBuilder.numeric('ADD'), required: true },
                { capability: symphony.types.CapabilityBuilder.numeric('SUBTRACT'), required: true },
                { capability: symphony.types.CapabilityBuilder.numeric('MULTIPLY'), required: true },
                { capability: symphony.types.CapabilityBuilder.numeric('DIVIDE'), required: true }
            ],
            provides: ['arithmetic.calculation'],
            tags: ['math', 'arithmetic', 'calculator']
        }, this);

        // Register tools first
        const toolConfigs = [
            {
                name: 'tripleAdd',
                description: 'Adds three numbers together',
                inputs: ['num1', 'num2', 'num3'],
                handler: async (params: any) => {
                    const { num1, num2, num3 } = params;
                    return { success: true, result: num1 + num2 + num3 };
                }
            },
            {
                name: 'tripleSub',
                description: 'Subtracts two numbers from the first number',
                inputs: ['num1', 'num2', 'num3'],
                handler: async (params: any) => {
                    const { num1, num2, num3 } = params;
                    // Subtract num2 and num3 from num1
                    return { success: true, result: num1 - num2 - num3 };
                }
            },
            {
                name: 'tripleMult',
                description: 'Multiplies three numbers together',
                inputs: ['num1', 'num2', 'num3'],
                handler: async (params: any) => {
                    const { num1, num2, num3 } = params;
                    return { success: true, result: num1 * num2 * num3 };
                }
            },
            {
                name: 'tripleDiv',
                description: 'Divides three numbers in sequence',
                inputs: ['num1', 'num2', 'num3'],
                handler: async (params: any) => {
                    const { num1, num2, num3 } = params;
                    if (num2 === 0 || num3 === 0) {
                        return { success: false, error: 'Division by zero', result: 0 };
                    }
                    return { success: true, result: num1 / num2 / num3 };
                }
            }
        ];

        // Register each tool and store the instance
        for (const config of toolConfigs) {
            const tool = await symphony.tools.create(config);
            this.tools.set(config.name, tool);
        }

        // Create the agent with the required configuration
        const agentConfig: AgentConfig = {
            name: 'calculator',
            description: 'A calculator agent that performs arithmetic operations',
            task: 'process arithmetic operations',
            tools: Array.from(this.tools.values()),
            llm: symphony.types.DEFAULT_LLM_CONFIG,
            maxCalls: 10,
            requireApproval: false,
            timeout: 30000
        };

        this.agent = await symphony.agent.create(agentConfig);
        this.initialized = true;
    }

    async run(task: string, options?: AgentOptions): Promise<AgentResult> {
        if (!this.initialized || !this.agent) {
            await this.initialize();
        }

        if (options?.onProgress) {
            options.onProgress({ status: 'Parsing task...' });
        }

        // Extract numbers from the task
        const numbers = task.match(/\d+/g)?.map(Number) || [];
        if (numbers.length < 3) {
            return {
                success: false,
                error: 'Need at least three numbers for calculation',
                result: 0,
                metrics: {
                    duration: 0,
                    toolCalls: 0
                }
            };
        }

        // Determine the operation based on keywords in the task
        const taskLower = task.toLowerCase();
        let toolName;

        if (taskLower.includes('add') || taskLower.includes('sum') || taskLower.includes('plus')) {
            toolName = 'tripleAdd';
        } else if (taskLower.includes('subtract') || taskLower.includes('minus') || taskLower.includes('sub')) {
            toolName = 'tripleSub';
            // For subtraction, if the task contains "from", rearrange the numbers
            if (taskLower.includes('from')) {
                const fromIndex = taskLower.indexOf('from');
                const beforeFrom = task.slice(0, fromIndex).match(/\d+/g)?.map(Number) || [];
                const afterFrom = task.slice(fromIndex).match(/\d+/g)?.map(Number) || [];
                if (afterFrom.length > 0 && beforeFrom.length > 0) {
                    // Put the "from" number first, followed by the numbers to subtract
                    numbers.length = 0;
                    numbers.push(afterFrom[0], ...beforeFrom);
                }
            }
        } else if (taskLower.includes('multiply') || taskLower.includes('times') || taskLower.includes('product')) {
            toolName = 'tripleMult';
        } else if (taskLower.includes('divide') || taskLower.includes('divided by') || taskLower.includes('quotient')) {
            toolName = 'tripleDiv';
        } else {
            return {
                success: false,
                error: 'Unknown operation requested',
                result: 0,
                metrics: {
                    duration: 0,
                    toolCalls: 0
                }
            };
        }

        if (options?.onProgress) {
            options.onProgress({ status: `Using ${toolName} operation...` });
        }

        const tool = this.tools.get(toolName);
        if (!tool) {
            return {
                success: false,
                error: `Tool ${toolName} not found`,
                result: 0,
                metrics: {
                    duration: 0,
                    toolCalls: 0
                }
            };
        }

        const startTime = Date.now();
        const result = await tool.run({
            num1: numbers[0],
            num2: numbers[1],
            num3: numbers[2]
        });
        const endTime = Date.now();

        if (options?.onProgress) {
            options.onProgress({ status: 'Task completed', result: result.result });
        }

        return {
            ...result,
            metrics: {
                duration: endTime - startTime,
                toolCalls: 1
            }
        };
    }
}

export const calculatorAgent = new CalculatorAgent(); 