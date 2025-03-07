import { symphony } from '../../src';

// Create calculator tool using the standard syntax
const calculatorTool = await symphony.tools.create({
    name: "calculator",
    description: "performs basic math operations",
    inputs: ["operation", "a", "b"],
    handler: async (params) => {
        const { operation, a, b } = params;
        let result;
        
        switch (operation) {
            case 'add':
                result = a + b;
                break;
            case 'subtract':
                result = a - b;
                break;
            case 'multiply':
                result = a * b;
                break;
            case 'divide':
                result = b !== 0 ? a / b : null;
                break;
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }

        return { 
            result,
            success: true
        };
    }
});

// Test harness for the calculator tool
export class ToolTester {
    constructor() {
        // Register the tool
        this.initialize();
    }

    private async initialize() {
        await calculatorTool.register();
    }

    async testCalculator() {
        const tests = [
            { operation: 'add', a: 5, b: 3, expected: 8 },
            { operation: 'subtract', a: 10, b: 4, expected: 6 },
            { operation: 'multiply', a: 6, b: 7, expected: 42 },
            { operation: 'divide', a: 15, b: 3, expected: 5 }
        ];

        for (const test of tests) {
            const response = await calculatorTool.run({
                operation: test.operation,
                a: test.a,
                b: test.b
            });

            console.log(`${test.operation}(${test.a}, ${test.b}) = ${response.result}`);
            
            if (!response.success || response.result !== test.expected) {
                throw new Error(`Test failed: expected ${test.expected}, got ${response.result}`);
            }
        }
    }
} 