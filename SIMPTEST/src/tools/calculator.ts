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
        return symphony.componentManager.register({
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
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        // Ensure tool service is initialized
        await symphony.tools.initialize();

        this.tool = await symphony.tools.create({
            name: 'tripleAdd',
            description: 'Adds three numbers together',
            inputs: ['num1', 'num2', 'num3'],
            handler: async (params: TripleAddParams) => {
                try {
                    const result = params.num1 + params.num2 + params.num3;
                    return {
                        success: true,
                        result
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
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