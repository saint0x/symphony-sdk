// Debug calculator tool execution
const calcTool = {
    name: 'calculate',
    type: 'custom',
    description: 'Performs mathematical calculations and arithmetic operations',
    config: {
        handler: async (params: any) => {
            console.log('🧮 Calculator DEBUG - received params:', JSON.stringify(params, null, 2));
            
            try {
                // Try different parameter extraction strategies
                const expression = params.expression || params.query || params.task || '2+2';
                console.log('🧮 Extracted expression:', expression);
                
                // Clean the expression (remove "Calculate" prefix if present)
                const cleanExpression = expression
                    .replace(/^calculate\s*/i, '')
                    .replace(/[^0-9+\-*/().\s]/g, '')
                    .trim();
                
                console.log('🧮 Cleaned expression:', cleanExpression);
                
                if (!cleanExpression) {
                    throw new Error('No valid mathematical expression found');
                }
                
                // Simple evaluation (in real apps, use a safer parser)
                const result = eval(cleanExpression);
                console.log('🧮 Calculation result:', result);
                
                return {
                    success: true,
                    result: {
                        expression: cleanExpression,
                        answer: result,
                        message: `Calculation result: ${result}`
                    }
                };
            } catch (error) {
                console.error('🧮 Calculator error:', error);
                return {
                    success: false,
                    error: `Invalid mathematical expression: ${error.message}`
                };
            }
        }
    }
};

// Test the tool directly
async function testCalculatorDirect() {
    console.log('🧮 DIRECT CALCULATOR TEST\n');
    
    const testCases = [
        { query: "Calculate 15 * 8 + 7" },
        { expression: "15 * 8 + 7" },
        { task: "15 * 8 + 7" },
        {}
    ];
    
    for (let i = 0; i < testCases.length; i++) {
        console.log(`\n--- Test Case ${i + 1} ---`);
        const result = await calcTool.config.handler(testCases[i]);
        console.log('Result:', JSON.stringify(result, null, 2));
    }
}

testCalculatorDirect().catch(console.error); 