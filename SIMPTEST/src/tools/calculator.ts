import symphony, { initPromise } from '../sdk';

interface TripleAddParams {
    num1: number;
    num2: number;
    num3: number;
}

interface TripleAddResult {
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

class TripleAddTool {
    private tool: Promise<any>;

    constructor() {
        // Wait for initialization before creating tool
        this.tool = initPromise.then(() => 
            symphony.tool.create({
                name: 'Triple Add Tool',
                description: 'A tool that adds three numbers together',
                handler: async ({ num1, num2, num3 }: TripleAddParams): Promise<TripleAddResult> => {
                    const startTime = Date.now();
                    try {
                        return {
                            success: true,
                            result: num1 + num2 + num3,
                            metrics: {
                                startTime,
                                endTime: Date.now(),
                                duration: Date.now() - startTime,
                                memory: process.memoryUsage().heapUsed
                            }
                        };
                    } catch (error) {
                        return {
                            success: false,
                            error: error instanceof Error ? error : new Error(String(error)),
                            result: 0,
                            metrics: {
                                startTime,
                                endTime: Date.now(),
                                duration: Date.now() - startTime,
                                memory: process.memoryUsage().heapUsed
                            }
                        };
                    }
                }
            })
        );
    }

    async run(params: TripleAddParams): Promise<TripleAddResult> {
        const tool = await this.tool;
        return tool.run(params);
    }
}

export default TripleAddTool; 