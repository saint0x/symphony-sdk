import { ToolConfig, AgentConfig, ToolResult } from '../types/sdk';
import { BaseAgent } from '../agents/base';

// Define our calculator tool
const calculatorTool: ToolConfig = {
    name: 'calculator',
    description: 'A simple calculator that adds two numbers',
    inputs: ['a', 'b'],
    outputs: ['sum'],
    handler: async (params: { a: number; b: number }): Promise<ToolResult<{ sum: number }>> => {
        try {
            // Validate input types
            if (typeof params.a !== 'number' || typeof params.b !== 'number') {
                throw new Error('Both inputs must be numbers');
            }

            const sum = params.a + params.b;
            return {
                success: true,
                result: { sum },
                error: undefined
            };
        } catch (error) {
            return {
                success: false,
                result: undefined,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }
};

// Create a simple agent that uses the calculator
class CalculatorAgent extends BaseAgent {
    constructor() {
        const config: AgentConfig = {
            name: 'calculator_agent',
            description: 'An agent that performs calculations',
            task: 'Perform basic arithmetic operations',
            tools: [calculatorTool],
            capabilities: ['arithmetic', 'calculation'],
            handler: async () => ({
                success: true,
                result: {},
                error: undefined
            }),
            llm: {
                provider: 'openai',
                model: 'gpt-4',
                apiKey: process.env.OPENAI_API_KEY || ''
            }
        };
        super(config);
    }

    async add(a: number, b: number): Promise<number> {
        const result = await this.executeTool('calculator', { a, b });
        if (!result?.sum) {
            throw new Error('Failed to calculate sum');
        }
        return result.sum;
    }
}

export { CalculatorAgent, calculatorTool }; 