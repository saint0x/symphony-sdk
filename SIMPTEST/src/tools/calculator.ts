import { symphony } from 'symphonic';
import { ToolConfig } from 'symphonic/types';

class TripleAddTool {
    private tool: any;
    private initialized: boolean = false;

    constructor() {
        const config: ToolConfig = {
            name: 'tripleAdd',
            description: 'Add three integers together',
            inputs: {
                num1: { type: 'number', required: true },
                num2: { type: 'number', required: true },
                num3: { type: 'number', required: true }
            },
            validation: {
                input: {
                    num1: { type: 'number', required: true },
                    num2: { type: 'number', required: true },
                    num3: { type: 'number', required: true }
                },
                output: {
                    result: { type: 'number', required: true }
                }
            },
            handler: this.handler.bind(this)
        };

        this.initialize(config);
    }

    private async initialize(config: ToolConfig): Promise<void> {
        try {
            // Ensure symphony is initialized
            if (!symphony.isInitialized()) {
                await symphony.initialize();
            }

            // Create tool with validated config
            this.tool = await symphony.tools.createTool(config);
            this.initialized = true;

            // Start initialization metric
            symphony.startMetric('triple_add_tool_init', {
                toolName: config.name
            });
        } catch (error) {
            symphony.startMetric('triple_add_tool_init', {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private assertInitialized(): void {
        if (!this.initialized) {
            throw new Error('Triple Add tool is not initialized');
        }
    }

    private async handler(params: Record<string, any>): Promise<any> {
        const metricId = `triple_add_${Date.now()}`;
        symphony.startMetric(metricId, { params });

        try {
            const numbers = [params.num1, params.num2, params.num3];
            
            // Validate inputs
            for (const num of numbers) {
                if (typeof num !== 'number' || !Number.isInteger(num)) {
                    throw new Error('All inputs must be integers');
                }
            }

            // Perform calculation
            const sum = numbers.reduce((acc, curr) => acc + curr, 0);
            
            // End metric with success
            symphony.endMetric(metricId, {
                success: true,
                result: sum,
                operation: 'addition',
                inputCount: numbers.length
            });

            return {
                success: true,
                result: sum
            };
        } catch (error) {
            // End metric with error
            symphony.endMetric(metricId, {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    async run(params: Record<string, any>): Promise<any> {
        this.assertInitialized();
        return this.tool.run(params);
    }
}

export const tripleAddTool = new TripleAddTool(); 