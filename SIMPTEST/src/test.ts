import { symphony } from './sdk';
import { calculatorAgent } from './agents/calculator';
import { tripleAddTool } from './tools/calculator';
import { tripleSubTool } from './tools/subtractor';
import { tripleMultTool } from './tools/multiplier';
import { tripleDivTool } from './tools/divider';

async function runComplexTest() {
    try {
        // Initialize Symphony and all tools
        await symphony.initialize();
        await Promise.all([
            tripleAddTool.initialize(),
            tripleSubTool.initialize(),
            tripleMultTool.initialize(),
            tripleDivTool.initialize()
        ]);
        await calculatorAgent.initialize();

        console.log('All components initialized successfully');

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
                expectedResult: 60  // 100 - 25 - 15 = 60
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
            
            const result = await calculatorAgent.run(test.task, {
                onProgress: (update) => {
                    console.log(`Progress: ${update.status}`);
                    if (update.result !== undefined) {
                        console.log(`Intermediate result: ${update.result}`);
                    }
                }
            });
            
            if (result.success) {
                console.log(`Result: ${result.result}`);
                console.log(`Expected: ${test.expectedResult}`);
                console.log(`Test ${result.result === test.expectedResult ? 'PASSED ✅' : 'FAILED ❌'}`);
            } else {
                console.error('Error:', result.error?.message);
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
            const result = await calculatorAgent.run(task, {
                onProgress: (update) => {
                    console.log(`Progress for "${task}": ${update.status}`);
                    if (update.result !== undefined) {
                        console.log(`Result: ${update.result}`);
                    }
                }
            });
            if (result.success) {
                console.log(`${task} = ${result.result}`);
            } else {
                console.error(`Error with task "${task}":`, result.error?.message);
            }
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
runComplexTest().catch(console.error); 