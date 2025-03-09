import { symphony } from '../sdk';
import { Tool, ToolConfig, ToolResult } from '../types/sdk';
import { ToolLifecycleState } from '../types/lifecycle';

interface CalculatorInput {
    operation: string;
}

interface CalculatorOutput {
    result: number;
    explanation: string;
}

export class CalculatorTool implements Tool<CalculatorInput, CalculatorOutput> {
    private _state: ToolLifecycleState = ToolLifecycleState.CREATED;

    get name(): string {
        return 'calculator';
    }

    get description(): string {
        return 'A tool for performing mathematical calculations';
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    async initialize(): Promise<void> {
        // Register with tool service
        await symphony.tool.createTool(this.name, {
            name: this.name,
            description: this.description,
            type: 'calculator'
        });

        this._state = ToolLifecycleState.READY;
    }

    async run(params: CalculatorInput): Promise<ToolResult<CalculatorOutput>> {
        const startTime = Date.now();

        try {
            // Extract numbers and operation from task
            const numbers = params.operation.match(/\d+/g)?.map(Number) || [];
            const operation = params.operation.toLowerCase();

            let result: number;
            let explanation: string;

            if (operation.includes('add') || operation.includes('sum')) {
                result = numbers.reduce((a, b) => a + b, 0);
                explanation = `Added numbers: ${numbers.join(' + ')} = ${result}`;
            } else if (operation.includes('subtract')) {
                result = numbers[0] - numbers.slice(1).reduce((a, b) => a + b, 0);
                explanation = `Subtracted numbers: ${numbers[0]} - ${numbers.slice(1).join(' - ')} = ${result}`;
            } else if (operation.includes('multiply')) {
                result = numbers.reduce((a, b) => a * b, 1);
                explanation = `Multiplied numbers: ${numbers.join(' × ')} = ${result}`;
            } else if (operation.includes('divide')) {
                if (numbers.slice(1).some(n => n === 0)) {
                    throw new Error('Division by zero');
                }
                result = numbers.reduce((a, b) => a / b);
                explanation = `Divided numbers: ${numbers.join(' ÷ ')} = ${result}`;
            } else {
                throw new Error('Unknown operation');
            }

            return {
                success: true,
                result: {
                    result,
                    explanation
                },
                metrics: {
                    duration: Date.now() - startTime,
                    startTime,
                    endTime: Date.now()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                metrics: {
                    duration: Date.now() - startTime,
                    startTime,
                    endTime: Date.now()
                }
            };
        }
    }
} 