import { symphony } from 'symphonic';
import type { AgentConfig, AgentResult, ToolConfig } from 'symphonic';

// Define the calculator tool configurations
const calculatorTools: ToolConfig[] = [
    {
        name: 'add',
        description: 'Add three numbers together',
        inputs: ['num1', 'num2', 'num3'],
        handler: async ({ num1, num2, num3 }: { num1: number; num2: number; num3: number }) => ({
            success: true,
            result: num1 + num2 + num3,
            metrics: {
                startTime: Date.now(),
                endTime: Date.now(),
                duration: 0
            }
        })
    },
    {
        name: 'subtract',
        description: 'Subtract numbers from the first number',
        inputs: ['num1', 'num2', 'num3'],
        handler: async ({ num1, num2, num3 }: { num1: number; num2: number; num3: number }) => ({
            success: true,
            result: num1 - num2 - num3,
            metrics: {
                startTime: Date.now(),
                endTime: Date.now(),
                duration: 0
            }
        })
    },
    {
        name: 'multiply',
        description: 'Multiply three numbers together',
        inputs: ['num1', 'num2', 'num3'],
        handler: async ({ num1, num2, num3 }: { num1: number; num2: number; num3: number }) => ({
            success: true,
            result: num1 * num2 * num3,
            metrics: {
                startTime: Date.now(),
                endTime: Date.now(),
                duration: 0
            }
        })
    }
];

class CalculatorAgent {
    private agent: Promise<any>;

    constructor() {
        const config: AgentConfig = {
            name: 'Calculator Agent',
            description: 'An agent that performs arithmetic operations',
            task: 'process arithmetic operations',
            tools: calculatorTools,
            llm: {
                provider: 'openai',
                model: 'gpt-4',
                temperature: 0.7,
                maxTokens: 2000,
                apiKey: process.env.OPENAI_API_KEY || ''
            },
            capabilities: ['arithmetic.calculation']
        };

        this.agent = symphony.agent.create(config);
    }

    async run(task: string): Promise<AgentResult> {
        const startTime = Date.now();
        try {
            // Extract numbers and operation from task
            const numbers = task.match(/\d+/g)?.map(Number) || [];
            if (numbers.length < 3) {
                throw new Error('Need at least three numbers');
            }

            // Determine operation from task description
            const taskLower = task.toLowerCase();
            const operation = taskLower.includes('add') ? 'add'
                : taskLower.includes('subtract') ? 'subtract'
                : taskLower.includes('multiply') ? 'multiply'
                : null;

            if (!operation) {
                throw new Error('Unknown operation');
            }

            // Find and execute the appropriate tool
            const tool = calculatorTools.find(t => t.name === operation);
            if (!tool) {
                throw new Error(`Tool ${operation} not found`);
            }

            // For subtraction, we need to handle the order differently
            // "Subtract 20 and 10 from 100" means 100 - 20 - 10
            let orderedNumbers = [...numbers];
            if (operation === 'subtract' && taskLower.includes('from')) {
                // The number being subtracted from should be first
                const fromIndex = taskLower.indexOf('from');
                const numbersAfterFrom = task.slice(fromIndex).match(/\d+/g)?.map(Number) || [];
                if (numbersAfterFrom.length > 0) {
                    orderedNumbers = [
                        numbersAfterFrom[0],  // The number we're subtracting from
                        ...numbers.filter(n => n !== numbersAfterFrom[0])  // The numbers being subtracted
                    ];
                }
            }

            const result = await tool.handler({
                num1: orderedNumbers[0],
                num2: orderedNumbers[1],
                num3: orderedNumbers[2]
            });

            return {
                success: true,
                result: result.result,
                metrics: {
                    duration: Date.now() - startTime,
                    startTime,
                    endTime: Date.now(),
                    toolCalls: 1
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                result: 0,
                metrics: {
                    duration: Date.now() - startTime,
                    startTime,
                    endTime: Date.now(),
                    toolCalls: 0
                }
            };
        }
    }
}

export default CalculatorAgent; 