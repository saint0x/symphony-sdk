import { symphony } from '../sdk';
import type { Tool, ToolResult } from '../sdk';

interface TripleDivParams {
    num1: number;
    num2: number;
    num3: number;
}

class TripleDivTool {
    private tool!: Tool;
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
            id: 'tripleDiv',
            name: 'Triple Division Tool',
            type: 'tool',
            description: 'A tool that divides three numbers in sequence (num1 / num2 / num3)',
            version: '1.0.0',
            capabilities: [
                {
                    name: symphony.types.CapabilityBuilder.numeric('DIVIDE'),
                    parameters: {
                        num1: { type: 'number', required: true },
                        num2: { type: 'number', required: true },
                        num3: { type: 'number', required: true }
                    },
                    returns: {
                        type: 'number',
                        description: 'The result of dividing the three numbers in sequence'
                    }
                }
            ],
            requirements: [],  // This tool has no dependencies
            provides: ['numeric.calculation', 'batch.processing'],
            tags: ['math', 'arithmetic', 'division']
        }, this);

        // Create the tool
        this.tool = await symphony.tools.create({
            name: 'tripleDiv',
            description: 'A tool that divides three numbers in sequence',
            inputs: ['num1', 'num2', 'num3'],
            handler: async (params: TripleDivParams) => {
                const { num1, num2, num3 } = params;
                if (num2 === 0 || num3 === 0) {
                    return {
                        success: false,
                        error: new Error('Division by zero is not allowed'),
                        metrics: {
                            duration: 0,
                            startTime: Date.now(),
                            endTime: Date.now()
                        }
                    };
                }
                const result = num1 / num2 / num3;
                return {
                    success: true,
                    result,
                    metrics: {
                        duration: 0,
                        startTime: Date.now(),
                        endTime: Date.now()
                    }
                };
            }
        });

        this.initialized = true;
    }

    async run(params: TripleDivParams): Promise<ToolResult<number>> {
        if (!this.initialized || !this.tool) {
            await this.initialize();
        }
        return this.tool.run(params);
    }
}

export const tripleDivTool = new TripleDivTool(); 