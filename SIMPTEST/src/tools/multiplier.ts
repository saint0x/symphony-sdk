import sdkInstance from '../sdk';
import { symphony } from 'symphonic';
import type { Symphony } from 'symphonic';

interface TripleMultParams {
    num1: number;
    num2: number;
    num3: number;
}

interface TripleMultResult {
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

class TripleMultTool {
    private tool: Promise<any>;

    constructor() {
        this.tool = sdkInstance.then(sdk =>
            sdk.tool.create({
                name: 'Triple Multiply Tool',
                description: 'A tool that multiplies three numbers together (num1 * num2 * num3)',
                handler: async ({ num1, num2, num3 }: TripleMultParams): Promise<TripleMultResult> => {
                    try {
                        const startTime = Date.now();
                        const result = num1 * num2 * num3;
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
            })
        );
    }

    async run(params: TripleMultParams): Promise<TripleMultResult> {
        const tool = await this.tool;
        return tool.run(params);
    }
}

export default TripleMultTool;

export const initialize = async (symphony: Symphony): Promise<void> => {
    // Initialization logic here
}; 