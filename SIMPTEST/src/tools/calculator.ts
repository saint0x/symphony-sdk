import { symphony } from '../sdk';
import { Tool, ToolResult } from 'symphonic/types';
import { SymphonyComponentManager } from '../core/component-manager';
import { CapabilityBuilder, CommonCapabilities } from '../core/component-manager/types/metadata';

interface TripleAddParams {
    num1: number;
    num2: number;
    num3: number;
}

class TripleAddTool {
    private tool: Tool;

    constructor() {
        return SymphonyComponentManager.getInstance().register({
            id: 'tripleAdd',
            name: 'Triple Add Tool',
            type: 'tool',
            description: 'A tool that adds three numbers together',
            version: '1.0.0',
            capabilities: [
                {
                    name: CapabilityBuilder.numeric('ADD'),
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
        this.tool = await symphony.tools.createTool<TripleAddParams, number>({
            name: 'tripleAdd',
            description: 'Adds three numbers together',
            inputParams: ['num1', 'num2', 'num3'],
            handler: async (params) => {
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
    }

    async run(params: TripleAddParams): Promise<ToolResult<number>> {
        return this.tool.run(params);
    }
}

export const tripleAddTool = new TripleAddTool(); 