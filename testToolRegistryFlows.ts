import { ToolRegistry } from './src/tools/standard/registry';
import { ToolConfig, ToolResult } from './src/types/tool.types';
import { ParameterSchema } from './src/utils/verification';
import * as assert from 'assert';

const logger = {
    log: (message: string, ...args: any[]) => console.log(`[TEST_TOOL_REG_LOG] ${message}`, ...args),
    error: (message: string, ...args: any[]) => console.error(`[TEST_TOOL_REG_ERROR] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[TEST_TOOL_REG_WARN] ${message}`, ...args),
};

// Helper function to simulate getting a clean ToolRegistry instance if possible
// This is tricky with singletons. For true isolation, ToolRegistry might need a reset method or non-singleton option.
function getTestRegistry(): ToolRegistry {
    // This basic approach reuses the singleton. Consider implications for test isolation if state persists.
    // In a real test suite, you might clear/reset the registry or use a fresh instance factory.
    const registry = ToolRegistry.getInstance(); 
    // Potentially clear all tools if a method exists, or re-register for each test suite if needed.
    return registry;
}

async function runToolRegistryTests() {
    logger.log('=== TEST: ToolRegistry executeTool with Validation ===');
    const registry = getTestRegistry();

    // --- Tool Definitions for Test --- 
    const noSchemaTool: ToolConfig = {
        name: 'noSchemaTool',
        type: 'test',
        description: 'A tool without an input schema',
        handler: async (params: any) => {
            logger.log(`noSchemaTool called with: ${JSON.stringify(params)}`);
            return { success: true, result: { received: params } };
        }
    };
    registry.registerTool(noSchemaTool.name, noSchemaTool);

    const simpleSchema: { [key: string]: ParameterSchema } = {
        name: { type: 'string', required: true, minLength: 3 },
        count: { type: 'number', required: false }
    };

    const withSchemaTool: ToolConfig = {
        name: 'withSchemaTool',
        type: 'test',
        description: 'A tool with an input schema',
        inputSchema: simpleSchema,
        handler: async (params: any) => {
            logger.log(`withSchemaTool called with: ${JSON.stringify(params)}`);
            return { success: true, result: { processed: params } };
        }
    };
    registry.registerTool(withSchemaTool.name, withSchemaTool);

    // --- Test Cases --- 

    // Test Case 1: Call tool without schema - should pass regardless of params
    logger.log('\n--- Test Case 1: Tool without schema ---');
    let result1 = await registry.executeTool('noSchemaTool', { data: 'any_data', value: 123 });
    assert.strictEqual(result1.success, true, 'Test Case 1.1 FAILED: noSchemaTool should succeed');
    assert.deepStrictEqual(result1.result?.received, { data: 'any_data', value: 123 }, 'Test Case 1.2 FAILED: noSchemaTool result mismatch');
    logger.log('Test Case 1 PASSED');

    // Test Case 2: Call tool with schema - valid params
    logger.log('\n--- Test Case 2: Tool with schema, valid params ---');
    let result2 = await registry.executeTool('withSchemaTool', { name: 'ValidName', count: 10 });
    assert.strictEqual(result2.success, true, 'Test Case 2.1 FAILED: withSchemaTool valid params should succeed');
    assert.deepStrictEqual(result2.result?.processed, { name: 'ValidName', count: 10 }, 'Test Case 2.2 FAILED: withSchemaTool result mismatch');
    logger.log('Test Case 2 PASSED');

    // Test Case 3: Call tool with schema - invalid params (missing required)
    logger.log('\n--- Test Case 3: Tool with schema, missing required param ---');
    let result3 = await registry.executeTool('withSchemaTool', { count: 5 }); // name is missing
    assert.strictEqual(result3.success, false, 'Test Case 3.1 FAILED: withSchemaTool missing required should fail');
    assert.ok(result3.error?.includes('Input validation failed'), 'Test Case 3.2 FAILED: Error message missing validation failure text');
    assert.ok(result3.error?.includes('name.inputParams: Parameter is required') || result3.error?.includes('name: Parameter is required'), 'Test Case 3.3 FAILED: Specific error for missing name not found');
    assert.ok(Array.isArray(result3.details) && result3.details.length > 0, 'Test Case 3.4 FAILED: Validation details missing or empty');
    if (Array.isArray(result3.details)) {
        assert.ok(result3.details.some((d:any) => d.path?.endsWith('.name') && d.message.includes('required')), 'Test Case 3.5 FAILED: Detailed error for name not found in details array');
    }
    logger.log('Test Case 3 PASSED');

    // Test Case 4: Call tool with schema - invalid params (minLength violation)
    logger.log('\n--- Test Case 4: Tool with schema, minLength violation ---');
    let result4 = await registry.executeTool('withSchemaTool', { name: 'No', count: 20 }); // name 'No' is too short
    assert.strictEqual(result4.success, false, 'Test Case 4.1 FAILED: withSchemaTool minLength violation should fail');
    assert.ok(result4.error?.includes('Input validation failed'), 'Test Case 4.2 FAILED: Error message incorrect');
    assert.ok(result4.error?.includes('name.inputParams: String is too short') || result4.error?.includes('name: String is too short'), 'Test Case 4.3 FAILED: Specific error for minLength not found');
    logger.log('Test Case 4 PASSED');
    
    // Test Case 5: Call non-existent tool
    logger.log('\n--- Test Case 5: Call non-existent tool ---');
    let result5 = await registry.executeTool('nonExistentTool', {});
    assert.strictEqual(result5.success, false, 'Test Case 5.1 FAILED: Calling non-existent tool should fail');
    assert.ok(result5.error?.includes('not found'), 'Test Case 5.2 FAILED: Error message should indicate tool not found');
    logger.log('Test Case 5 PASSED');


    logger.log('\n🎉🎉🎉 ToolRegistry Flow Tests PASSED! 🎉🎉🎉');
    process.exitCode = 0;
}

runToolRegistryTests().catch(err => {
    logger.error('ToolRegistry Flow TEST SCRIPT FAILED:', err.message);
    if (err.stack) logger.error('Stack:', err.stack);
    process.exitCode = 1;
}).finally(() => {
    if (process.exitCode === 0) {
        setTimeout(() => process.exit(0), 500); // Ensure logs are flushed
    } else {
        setTimeout(() => process.exit(process.exitCode || 1), 500);
    }
}); 