import sdkInstance from './sdk';
import CalculatorAgent from './agents/calculator';

interface ProgressUpdate {
    status: string;
    result?: any;
}

async function runComplexTest() {
    try {
        // Wait for SDK to initialize
        await sdkInstance;

        // Create calculator agent
        const calculatorAgent = new CalculatorAgent();

        // Test all operations
        const tests = [
            {
                description: 'Addition Test',
                task: 'Add the numbers 100, 50, and 25',
                expectedResult: 175
            },
            {
                description: 'Subtraction Test',
                task: 'Subtract 25 and 15 and 5 from 100',
                expectedResult: 55  // 100 - 25 - 15 - 5 = 55
            },
            {
                description: 'Multiplication Test',
                task: 'Multiply 5, 4, and 3 together',
                expectedResult: 60
            },
            {
                description: 'Division Test',
                task: 'Divide 100 by 2 and then by 2',
                expectedResult: 25
            }
        ];

        // Run each test
        for (const test of tests) {
            console.log(`\n${test.description}`);
            console.log(`Task: ${test.task}`);
            
            const result = await calculatorAgent.run(test.task);
            
            if (result.success) {
                console.log(`Result: ${result.result}`);
                console.log(`Expected: ${test.expectedResult}`);
                console.log(`Test ${result.result === test.expectedResult ? 'PASSED ✅' : 'FAILED ❌'}`);
            } else {
                console.error('Error:', result.error?.toString());
            }
        }

        // Complex multi-step calculation
        console.log('\nComplex Multi-step Calculation');
        const complexTasks = [
            'Multiply 10, 5, and 2',  // Should be 100
            'Add 30, 20, and 50',     // Should be 100
            'Divide 300 by 2 and 3',  // Should be 50
            'Subtract 10 and 20 and 5 from 100'  // Should be 65
        ];

        console.log('Performing multiple calculations in sequence...');
        
        for (const task of complexTasks) {
            const result = await calculatorAgent.run(task);
            if (result.success) {
                console.log(`${task} = ${result.result}`);
            } else {
                console.error(`Error calculating "${task}":`, result.error?.toString());
            }
        }

        console.log('\nAll tests completed');
    } catch (error) {
        console.error('Test execution error:', error);
        process.exit(1);
    }
}

runComplexTest().catch(error => {
    console.error('Failed to run complex test:', error);
    process.exit(1);
}); 