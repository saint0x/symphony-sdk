import { symphony } from 'symphonic';
import CalculatorAgent from './agents/calculator';
import TransformerAgent from './agents/transformer';
import type { AgentResult } from 'symphonic';

// Define extended result type that includes metadata
interface ExtendedAgentResult extends AgentResult {
    metadata?: Record<string, unknown>;
}

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
        
        // Test Calculator Agent
        console.log('\n[TEST] Testing Calculator Agent...');
        const calculatorAgent = new CalculatorAgent();
        
        const calculatorTests: Array<{
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

        // Run calculator tests
        for (const test of calculatorTests) {
            if (!isTestRunning) break;
            
            console.log(`\n[TEST] Running Calculator: ${test.description}`);
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

        // Test Transformer Agent
        console.log('\n[TEST] Testing Transformer Agent...');
        const transformerAgent = new TransformerAgent();

        const transformerTests: Array<{
            description: string;
            task: string;
            expectedResult?: any;  // Can be any type
            validate: (result: any) => boolean;
        }> = [
            {
                description: 'String Uppercase Test',
                task: 'Transform "hello world" to uppercase',
                expectedResult: 'HELLO WORLD',
                validate: (result: any) => result === 'HELLO WORLD'
            },
            {
                description: 'Object JSON Test',
                task: 'Transform {"name": "test", "value": 123} to json',
                validate: (result: any) => {
                    try {
                        const parsed = JSON.parse(result);
                        return parsed.name === 'test' && parsed.value === 123;
                    } catch {
                        return false;
                    }
                }
            },
            {
                description: 'String Reverse Test',
                task: 'Reverse "typescript"',
                expectedResult: 'tpircsepyt',
                validate: (result: any) => result === 'tpircsepyt'
            },
            {
                description: 'Base64 Encoding Test',
                task: 'Transform "test data" to base64',
                expectedResult: 'dGVzdCBkYXRh',
                validate: (result: any) => result === 'dGVzdCBkYXRh'
            }
        ];

        // Run transformer tests
        for (const test of transformerTests) {
            if (!isTestRunning) break;
            
            console.log(`\n[TEST] Running Transformer: ${test.description}`);
            console.log(`[TEST] Task: ${test.task}`);
            
            const testStartTime = Date.now();
            const result = await transformerAgent.run(test.task) as ExtendedAgentResult;
            console.log(`[TEST] Completed in ${Date.now() - testStartTime}ms`);
            
            if (result.success) {
                console.log(`[TEST] Result: ${result.result}`);
                if (test.expectedResult !== undefined) {
                    console.log(`[TEST] Expected: ${test.expectedResult}`);
                }
                console.log(`[TEST] Status: ${test.validate(result.result) ? '✅ PASSED' : '❌ FAILED'}`);
                if (result.metrics) {
                    console.log('[TEST] Metrics:', {
                        duration: result.metrics.duration,
                        toolCalls: result.metrics.toolCalls,
                        transformations: result.metrics.transformations
                    });
                }
                if (result.metadata) {
                    console.log('[TEST] Metadata:', result.metadata);
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