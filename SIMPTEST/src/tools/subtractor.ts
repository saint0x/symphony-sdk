import sdkInstance from '../sdk';

interface TripleSubParams {
    num1: number;
    num2: number;
    num3: number;
}

interface TripleSubResult {
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

class TripleSubTool {
    private tool: Promise<any>;

    constructor() {
        this.tool = sdkInstance.then(sdk =>
            sdk.tool.create({
                name: 'Triple Subtract Tool',
                description: 'A tool that subtracts three numbers (num1 - num2 - num3)',
                handler: async ({ num1, num2, num3 }: TripleSubParams): Promise<TripleSubResult> => {
                    try {
                        const startTime = Date.now();
                        const result = num1 - num2 - num3;
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

    async run(params: TripleSubParams): Promise<TripleSubResult> {
        const tool = await this.tool;
        return tool.run(params);
    }
}

export default TripleSubTool; 