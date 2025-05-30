import { Symphony } from './src/symphony';
import { Logger } from './src/utils/logger';
import path from 'path';

// Test configuration
const TEST_ITERATIONS = 5;
const MEMORY_OPS_PER_ITERATION = 3;

// Create a test logger
const testLogger = Logger.getInstance('RaceConditionTest');

// Test results tracking
const results = {
    iterations: 0,
    successes: 0,
    failures: 0,
    errors: [] as string[]
};

async function testMemoryOperations(symphony: Symphony, iteration: number): Promise<boolean> {
    const testData = {
        iteration,
        timestamp: Date.now(),
        data: `Test data for iteration ${iteration}`
    };
    
    try {
        // Test 1: Store operation
        testLogger.info('MemoryTest', `[Iteration ${iteration}] Testing memory store...`);
        await symphony.memory.store(`test_key_${iteration}`, testData, 'short_term');
        testLogger.info('MemoryTest', `[Iteration ${iteration}] ✓ Store successful`);
        
        // Test 2: Retrieve operation
        testLogger.info('MemoryTest', `[Iteration ${iteration}] Testing memory retrieve...`);
        const retrieved = await symphony.memory.retrieve(`test_key_${iteration}`, 'short_term');
        
        if (!retrieved || retrieved.data !== testData.data) {
            throw new Error(`Retrieved data mismatch: expected "${testData.data}", got "${retrieved?.data}"`);
        }
        testLogger.info('MemoryTest', `[Iteration ${iteration}] ✓ Retrieve successful`);
        
        // Test 3: Search operation
        testLogger.info('MemoryTest', `[Iteration ${iteration}] Testing memory search...`);
        const searchResults = await symphony.memory.search({
            namespace: undefined,
            type: 'short_term',
            limit: 10
        });
        testLogger.info('MemoryTest', `[Iteration ${iteration}] ✓ Search successful (found ${searchResults.length} entries)`);
        
        // Test 4: Stats operation
        testLogger.info('MemoryTest', `[Iteration ${iteration}] Testing memory stats...`);
        const stats = await symphony.memory.getStats();
        testLogger.info('MemoryTest', `[Iteration ${iteration}] ✓ Stats retrieved: ${stats.totalEntries} total entries`);
        
        return true;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        testLogger.error('MemoryTest', `[Iteration ${iteration}] ✗ Memory operation failed`, { error: errorMsg });
        results.errors.push(`Iteration ${iteration}: ${errorMsg}`);
        
        // Check if it's the specific race condition error
        if (errorMsg.includes('Database not initialized') || errorMsg.includes('DatabaseConnectionError')) {
            testLogger.error('MemoryTest', `[Iteration ${iteration}] RACE CONDITION DETECTED!`);
        }
        
        return false;
    }
}

async function runTest(): Promise<void> {
    testLogger.info('Test', '=== Starting Race Condition Test ===');
    testLogger.info('Test', `Database path: ${path.resolve('./symphony.db')}`);
    
    for (let i = 1; i <= TEST_ITERATIONS; i++) {
        testLogger.info('Test', `\n--- Iteration ${i}/${TEST_ITERATIONS} ---`);
        results.iterations++;
        
        let symphony: Symphony | null = null;
        
        try {
            // Create Symphony instance with database configuration
            symphony = new Symphony({
                db: {
                    type: 'sqlite',
                    path: './symphony.db'
                }
            });
            
            // Initialize Symphony
            testLogger.info('Test', `[Iteration ${i}] Initializing Symphony...`);
            await symphony.initialize();
            testLogger.info('Test', `[Iteration ${i}] Symphony initialized successfully`);
            
            // Immediately run memory operations to test for race condition
            const success = await testMemoryOperations(symphony, i);
            
            if (success) {
                results.successes++;
                testLogger.info('Test', `[Iteration ${i}] ✓ All memory operations completed successfully`);
            } else {
                results.failures++;
                testLogger.warn('Test', `[Iteration ${i}] ✗ Memory operations failed`);
            }
            
            // Also test database health to ensure it's properly initialized
            const dbHealth = await symphony.db.healthCheck();
            testLogger.info('Test', `[Iteration ${i}] Database health:`, {
                status: dbHealth.status,
                tables: dbHealth.database?.tables,
                records: dbHealth.database?.totalRecords
            });
            
        } catch (error) {
            results.failures++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            results.errors.push(`Iteration ${i} (init): ${errorMsg}`);
            testLogger.error('Test', `[Iteration ${i}] Failed during initialization`, { error: errorMsg });
        } finally {
            // Ensure graceful cleanup
            if (symphony) {
                try {
                    // Clean up test data
                    await symphony.memory.clear('short_term');
                    testLogger.info('Test', `[Iteration ${i}] Cleaned up test data`);
                } catch (error) {
                    testLogger.warn('Test', `[Iteration ${i}] Cleanup warning:`, { error });
                }
            }
        }
        
        // Small delay between iterations to avoid connection issues
        if (i < TEST_ITERATIONS) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    // Print final results
    testLogger.info('Test', '\n=== Test Results ===');
    testLogger.info('Test', `Total iterations: ${results.iterations}`);
    testLogger.info('Test', `Successful: ${results.successes} (${(results.successes / results.iterations * 100).toFixed(1)}%)`);
    testLogger.info('Test', `Failed: ${results.failures} (${(results.failures / results.iterations * 100).toFixed(1)}%)`);
    
    if (results.errors.length > 0) {
        testLogger.error('Test', '\nErrors encountered:');
        results.errors.forEach(error => {
            testLogger.error('Test', `  - ${error}`);
        });
    }
    
    // Determine overall test result
    const raceConditionDetected = results.errors.some(e => 
        e.includes('Database not initialized') || e.includes('DatabaseConnectionError')
    );
    
    if (raceConditionDetected) {
        testLogger.error('Test', '\n❌ RACE CONDITION BUG DETECTED!');
        testLogger.error('Test', 'The database/memory service race condition is present.');
        process.exit(1);
    } else if (results.failures > 0) {
        testLogger.warn('Test', '\n⚠️  Some operations failed, but no race condition detected.');
        process.exit(1);
    } else {
        testLogger.info('Test', '\n✅ All tests passed! No race condition detected.');
        testLogger.info('Test', 'The fix appears to be working correctly.');
        process.exit(0);
    }
}

// Run the test
runTest().catch(error => {
    testLogger.error('Test', 'Unexpected test failure:', { error });
    process.exit(1);
}); 