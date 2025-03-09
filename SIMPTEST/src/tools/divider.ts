import { symphony } from 'symphonic';
import type { Symphony, Tool, ToolConfig } from 'symphonic';

interface TripleDivParams {
    num1: number;
    num2: number;
    num3: number;
}

interface TripleDivResult {
    success: boolean;
    result: number;
    error?: Error;
    metrics: {
        startTime: number;
        endTime: number;
        duration: number;
        memory: number;
    };
}

class TripleDivTool {
    private tool: Tool;

    constructor() {
        const config: ToolConfig = {
            name: 'Triple Divide Tool',
            description: 'A tool that divides three numbers (num1 / num2 / num3)',
            handler: async ({ num1, num2, num3 }: TripleDivParams): Promise<TripleDivResult> => {
                try {
                    const startTime = Date.now();
                    if (num2 === 0 || num3 === 0) {
                        throw new Error('Division by zero');
                    }
                    const result = num1 / num2 / num3;
                    const endTime = Date.now();
                    return {
                        success: true,
                        result,
                        metrics: {
                            startTime,
                            endTime,
                            duration: endTime - startTime,
                            memory: process.memoryUsage().heapUsed
                        }
                    };
                } catch (error) {
                    const timestamp = Date.now();
                    return {
                        success: false,
                        error: error instanceof Error ? error : new Error(String(error)),
                        result: 0,
                        metrics: {
                            startTime: timestamp,
                            endTime: timestamp,
                            duration: 0,
                            memory: process.memoryUsage().heapUsed
                        }
                    };
                }
            }
        };

        this.tool = symphony.tool.create(config);
    }

    async run(params: TripleDivParams): Promise<TripleDivResult> {
        return this.tool.run(params);
    }
}

export default TripleDivTool; 