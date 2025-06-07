import { symphony } from './src/index';
import * as assert from 'assert';

const logger = symphony.logger;

async function runPruningTest() {
    logger.info('TestRunner', '=== TEST: Context Pruning and Learning ===');

    // Initialize Symphony
    await symphony.initialize();
    
    // Get services
    const toolService = await symphony.getService('tool');
    const contextApi = await symphony.getService('context');

    // Step 1: Create and execute a tool to generate context
    logger.info('TestRunner', 'Step 1: Creating and executing a tool to seed context...');
    
    const testTool = await toolService.create({
        name: 'testToolForPruning',
        description: 'A temporary tool for testing context pruning.',
        handler: async () => ({ success: true, result: { message: 'Tool executed' } })
    });

    await testTool.run({}); // Execute the tool to record its execution

    const insightsBefore = await contextApi.useMagic('get_insights', {});
    assert.strictEqual(insightsBefore.success, true, 'get_insights before pruning should succeed');
    const initialExecutions = insightsBefore.result.totalExecutions;
    logger.info('TestRunner', `Context seeded. Initial executions: ${initialExecutions}`);
    assert.ok(initialExecutions > 0, 'Test setup FAILED: Tool execution was not recorded.');

    // Step 2: Run the pruning operation
    logger.info('TestRunner', 'Step 2: Executing context pruning...');
    const pruneResult = await contextApi.useMagic('prune_context', {
        // Using an aggressive maxAge to ensure our test entry is pruned
        maxAge: 1, // 1 millisecond
    });

    assert.strictEqual(pruneResult.success, true, 'Pruning operation should succeed');
    assert.ok(pruneResult.result.pruningCompleted, 'Pruning result should indicate completion');
    logger.info('TestRunner', `Pruning complete. Pruned entries: ${pruneResult.result.prunedEntries}`);

    // Step 3: Verify that the context was pruned
    logger.info('TestRunner', 'Step 3: Verifying context has been pruned...');
    const insightsAfter = await contextApi.useMagic('get_insights', {});
    assert.strictEqual(insightsAfter.success, true, 'get_insights after pruning should succeed');
    const finalExecutions = insightsAfter.result.totalExecutions;
    logger.info('TestRunner', `Verification complete. Final executions: ${finalExecutions}`);
    
    // This assertion is key: it checks if the pruning actually removed the entry.
    assert.ok(finalExecutions < initialExecutions, `Test FAILED: Pruning did not reduce execution count. Before: ${initialExecutions}, After: ${finalExecutions}`);

    logger.info('TestRunner', '\n🎉🎉🎉 Context Pruning Test PASSED! 🎉🎉🎉');
    process.exitCode = 0;
}

runPruningTest().catch(err => {
    logger.error('TestRunner', 'Context Pruning TEST SCRIPT FAILED:', { message: err.message, stack: err.stack });
    process.exitCode = 1;
}).finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 500);
}); 