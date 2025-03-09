import { ToolResult } from '../../types/sdk';
import { patternSystem } from './patterns';

// Register core implementations
patternSystem.registerImplementation('numeric:operation', {
    handler: async (params: any): Promise<ToolResult<any>> => {
        try {
            const input1 = Number(params.input1);
            const input2 = Number(params.input2);
            
            if (isNaN(input1) || isNaN(input2)) {
                return {
                    success: false,
                    result: undefined,
                    error: 'Both inputs must be valid numbers'
                };
            }

            return {
                success: true,
                result: { result: input1 + input2 },
                error: undefined
            };
        } catch (error) {
            return {
                success: false,
                result: undefined,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    inputMap: {
        'input1': 'a',
        'input2': 'b'
    },
    outputMap: {
        'result': 'sum'
    }
});

patternSystem.registerImplementation('text:transform', {
    handler: async (params: any): Promise<ToolResult<any>> => {
        try {
            const input = String(params.input);
            
            return {
                success: true,
                result: { result: input.split('').reverse().join('') },
                error: undefined
            };
        } catch (error) {
            return {
                success: false,
                result: undefined,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    inputMap: {
        'input': 'text'
    },
    outputMap: {
        'result': 'reversed'
    }
});

// Data processing implementation with smart type handling
patternSystem.registerImplementation('data:process', {
    handler: async (params: any): Promise<ToolResult<any>> => {
        try {
            const data = params.data;
            if (!data) {
                return {
                    success: false,
                    result: undefined,
                    error: 'Data input is required'
                };
            }

            // Smart type detection and processing
            if (Array.isArray(data)) {
                return {
                    success: true,
                    result: { processed: data.map(item => ({ ...item, processed: true })) },
                    error: undefined
                };
            } else if (typeof data === 'object') {
                return {
                    success: true,
                    result: { processed: { ...data, processed: true } },
                    error: undefined
                };
            } else {
                return {
                    success: true,
                    result: { processed: String(data) },
                    error: undefined
                };
            }
        } catch (error) {
            return {
                success: false,
                result: undefined,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
});

// Register triple operation implementation
patternSystem.registerImplementation('triple:operation', {
    handler: async (params: any): Promise<ToolResult<any>> => {
        try {
            const input1 = Number(params.input1);
            const input2 = Number(params.input2);
            const input3 = Number(params.input3);
            
            if (isNaN(input1) || isNaN(input2) || isNaN(input3)) {
                return {
                    success: false,
                    result: undefined,
                    error: 'All inputs must be valid numbers'
                };
            }

            // Default to addition if operation not specified
            const operation = params.operation || 'add';
            let result: number;

            switch (operation) {
                case 'add':
                    result = input1 + input2 + input3;
                    break;
                case 'subtract':
                    result = input1 - input2 - input3;
                    break;
                case 'multiply':
                    result = input1 * input2 * input3;
                    break;
                case 'divide':
                    if (input2 === 0 || input3 === 0) {
                        throw new Error('Division by zero');
                    }
                    result = input1 / input2 / input3;
                    break;
                default:
                    result = input1 + input2 + input3;
            }

            return {
                success: true,
                result: { result },
                error: undefined
            };
        } catch (error) {
            return {
                success: false,
                result: undefined,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    inputMap: {
        'input1': 'a',
        'input2': 'b',
        'input3': 'c'
    },
    outputMap: {
        'result': 'sum'
    }
}); 