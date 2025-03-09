import { symphony } from 'symphonic';
import CalculatorAgent from './agents/calculator';
import type { AgentResult } from 'symphonic';

// Track active test state
let isTestRunning = false;

async function testAgent() {
    console.log('[TEST] Starting agent test execution...');
    const startTime = Date.now();

    try {
        isTestRunning = true;
        
        // Initialize Symphony
        console.log('[TEST] Initializing Symphony...');
        await symphony.initialize();
        
        // Create calculator agent
        console.log('[TEST] Creating Calculator Agent...');
        const agentStartTime = Date.now();
        const calculatorAgent = new CalculatorAgent();
        console.log(`[TEST] Calculator Agent created in ${Date.now() - agentStartTime}ms`);

        // Test cases with type inference
        const tests: Array<{
            description: string;
            task: string;
            expectedResult: number;
        }> = [
            {
                description: 'Addition Test',
                task: 'Add the numbers 10, 20, and 30',
                expectedResult: 60
            },
            {
                description: 'Subtraction Test',
                task: 'Subtract 20 and 10 from 100',
                expectedResult: 70
            },
            {
                description: 'Multiplication Test',
                task: 'Multiply 5, 4, and 3',
                expectedResult: 60
            }
        ];

        // Run each test with type inference
        for (const test of tests) {
            if (!isTestRunning) break;
            
            console.log(`\n[TEST] Running: ${test.description}`);
            console.log(`[TEST] Task: ${test.task}`);
            
            const testStartTime = Date.now();
            const result = await calculatorAgent.run(test.task);
            console.log(`[TEST] Completed in ${Date.now() - testStartTime}ms`);
            
            if (result.success) {
                console.log(`[TEST] Result: ${result.result}`);
                console.log(`[TEST] Expected: ${test.expectedResult}`);
                console.log(`[TEST] Status: ${result.result === test.expectedResult ? '✅ PASSED' : '❌ FAILED'}`);
                if (result.metrics) {
                    console.log('[TEST] Metrics:', {
                        duration: result.metrics.duration,
                        toolCalls: result.metrics.toolCalls
                    });
                }
            } else {
                console.error('[TEST] Error:', result.error?.message);
            }
        }

        // Clean exit
        const totalTime = Date.now() - startTime;
        console.log(`\n[TEST] Total test execution time: ${totalTime}ms`);
        process.exit(0);
    } catch (error) {
        console.error('[TEST] Test failed:', error);
        process.exit(1);
    }
}

// Handle SIGINT (Ctrl+C/Shift+C) - immediate exit
process.on('SIGINT', () => {
    process.exit(0);
});

// Other signals still get normal handling
process.on('SIGTERM', () => {
    console.log('\n[TEST] Received SIGTERM...');
    isTestRunning = false;
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('\n[TEST] Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('\n[TEST] Unhandled rejection:', reason);
    process.exit(1);
});

console.log('[TEST] Test script loaded, starting execution...');
testAgent().catch(error => {
    console.error('[TEST] Unhandled error:', error);
    process.exit(1);
}); 