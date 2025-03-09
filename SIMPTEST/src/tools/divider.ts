import sdkInstance from '../sdk';

interface DividerParams {
    num1: number;
    num2: number;
    num3: number;
}

interface DividerResult {
    success: boolean;
    result: number;
    error?: Error;
    metrics: {
        duration: number;
        startTime: number;
        endTime: number;
    };
}

class TripleDivTool {
    private tool: Promise<any>;

    constructor() {
        this.tool = sdkInstance.then(sdk => 
            sdk.tool.create({
                name: 'tripleDiv',
                description: 'A tool that divides three numbers in sequence',
                inputs: ['num1', 'num2', 'num3'],
                handler: async ({ num1, num2, num3 }: DividerParams): Promise<DividerResult> => {
                    // Check for division by zero
                    if (num2 === 0 || num3 === 0) {
                        return {
                            success: false,
                            error: new Error('Division by zero is not allowed'),
                            result: 0,
                            metrics: {
                                duration: 0,
                                startTime: Date.now(),
                                endTime: Date.now()
                            }
                        };
                    }

                    const startTime = Date.now();
                    const result = num1 / num2 / num3;
                    const endTime = Date.now();

                    return {
                        success: true,
                        result,
                        metrics: {
                            duration: endTime - startTime,
                            startTime,
                            endTime
                        }
                    };
                }
            })
        );
    }

    async run(params: DividerParams): Promise<DividerResult> {
        const tool = await this.tool;
        return tool.run(params);
    }
}

export default TripleDivTool; 