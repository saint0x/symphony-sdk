import { symphony } from '../sdk';
import type { Tool, ToolResult } from '../sdk';

interface TripleAddParams {
    num1: number;
    num2: number;
    num3: number;
}

class TripleAddTool {
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
            id: 'tripleAdd',
            name: 'Triple Add Tool',
            type: 'tool',
            description: 'A tool that adds three numbers together',
            version: '1.0.0',
            capabilities: [
                {
                    name: symphony.types.CapabilityBuilder.numeric('ADD'),
                    parameters: {
                        num1: { type: 'number', required: true },
                        num2: { type: 'number', required: true },
                        num3: { type: 'number', required: true }
                    },
                    returns: {
                        type: 'number',
                        description: 'The sum of the three input numbers'
                    }
                }
            ],
            requirements: [],  // This tool has no dependencies
            provides: ['numeric.calculation', 'batch.processing'],
            tags: ['math', 'arithmetic', 'addition']
        }, this);

        // Create the tool
        this.tool = await symphony.tools.create({
            name: 'tripleAdd',
            description: 'A tool that adds three numbers together',
            inputs: ['num1', 'num2', 'num3'],
            handler: async (params: TripleAddParams) => {
                const { num1, num2, num3 } = params;
                const result = num1 + num2 + num3;
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

    async run(params: TripleAddParams): Promise<ToolResult<number>> {
        if (!this.initialized || !this.tool) {
            await this.initialize();
        }
        return this.tool.run(params);
    }
}

export const tripleAddTool = new TripleAddTool(); 