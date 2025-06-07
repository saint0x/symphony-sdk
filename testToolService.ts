import { symphony } from './src/index';
import { ToolConfig, ToolResult } from './src/types/sdk';
import { ParameterSchema } from './src/utils/verification';
import * as assert from 'assert';

const logger = symphony.logger;

async function runModernToolTests() {
    logger.info('TestRunner', '=== TEST: Modern Tool Service Flows ===');

    // Initialize Symphony to set up all services
    await symphony.initialize();
    const toolService = symphony.tool;

    // --- Tool Definitions for Test ---
    const noSchemaTool: ToolConfig = {
        name: 'noSchemaTool',
        type: 'test',
        description: 'A tool without an input schema',
        config: {},
        handler: async (params: any): Promise<ToolResult> => {
            logger.info('noSchemaTool', `called with: ${JSON.stringify(params)}`);
            return { success: true, result: { received: params } };
        }
    };
    await toolService.create(noSchemaTool);

    const simpleSchema: { [key: string]: ParameterSchema } = {
        name: { type: 'string', required: true, minLength: 3 },
        count: { type: 'number', required: false }
    };

    const withSchemaTool: ToolConfig = {
        name: 'withSchemaTool',
        type: 'test',
        description: 'A tool with an input schema',
        config: {
            inputSchema: simpleSchema
        },
        handler: async (params: any): Promise<ToolResult> => {
            logger.info('withSchemaTool', `called with: ${JSON.stringify(params)}`);
            return { success: true, result: { processed: params } };
        }
    };
    await toolService.create(withSchemaTool);

    // --- Test Cases ---

    // Test Case 1: Call tool without schema - should pass regardless of params
    logger.info('TestRunner', '\n--- Test Case 1: Tool without schema ---');
    const result1 = await toolService.execute('noSchemaTool', { data: 'any_data', value: 123 });
    assert.strictEqual(result1.success, true, 'Test Case 1.1 FAILED: noSchemaTool should succeed');
    assert.deepStrictEqual(result1.result?.received, { data: 'any_data', value: 123 }, 'Test Case 1.2 FAILED: noSchemaTool result mismatch');
    logger.info('TestRunner', 'Test Case 1 PASSED');

    // Test Case 2: Call tool with schema - valid params
    logger.info('TestRunner', '\n--- Test Case 2: Tool with schema, valid params ---');
    const result2 = await toolService.execute('withSchemaTool', { name: 'ValidName', count: 10 });
    assert.strictEqual(result2.success, true, 'Test Case 2.1 FAILED: withSchemaTool valid params should succeed');
    assert.deepStrictEqual(result2.result?.processed, { name: 'ValidName', count: 10 }, 'Test Case 2.2 FAILED: withSchemaTool result mismatch');
    logger.info('TestRunner', 'Test Case 2 PASSED');

    // Test Case 3: Call tool with schema - invalid params (missing required)
    logger.info('TestRunner', '\n--- Test Case 3: Tool with schema, missing required param ---');
    const result3 = await toolService.execute('withSchemaTool', { count: 5 }); // name is missing
    assert.strictEqual(result3.success, false, 'Test Case 3.1 FAILED: withSchemaTool missing required should fail');
    assert.ok(result3.error?.includes('Input validation failed'), 'Test Case 3.2 FAILED: Error message missing validation failure text');
    assert.ok(result3.error?.includes('name: Parameter is required'), 'Test Case 3.3 FAILED: Specific error for missing name not found');
    logger.info('TestRunner', 'Test Case 3 PASSED');

    // Test Case 4: Call tool with schema - invalid params (minLength violation)
    logger.info('TestRunner', '\n--- Test Case 4: Tool with schema, minLength violation ---');
    const result4 = await toolService.execute('withSchemaTool', { name: 'No', count: 20 }); // name 'No' is too short
    assert.strictEqual(result4.success, false, 'Test Case 4.1 FAILED: withSchemaTool minLength violation should fail');
    assert.ok(result4.error?.includes('Input validation failed'), 'Test Case 4.2 FAILED: Error message incorrect');
    assert.ok(result4.error?.includes('name: String is too short'), 'Test Case 4.3 FAILED: Specific error for minLength not found');
    logger.info('TestRunner', 'Test Case 4 PASSED');
    
    // Test Case 5: Call non-existent tool
    logger.info('TestRunner', '\n--- Test Case 5: Call non-existent tool ---');
    const result5 = await toolService.execute('nonExistentTool', {});
    assert.strictEqual(result5.success, false, 'Test Case 5.1 FAILED: Calling non-existent tool should fail');
    assert.ok(result5.error?.includes('not found'), 'Test Case 5.2 FAILED: Error message should indicate tool not found');
    logger.info('TestRunner', 'Test Case 5 PASSED');

    logger.info('TestRunner', '\n🎉🎉🎉 Modern Tool Service Flow Tests PASSED! 🎉🎉🎉');
    process.exitCode = 0;
}

runModernToolTests().catch(err => {
    logger.error('TestRunner', 'Modern Tool Service TEST SCRIPT FAILED:', { message: err.message, stack: err.stack });
    process.exitCode = 1;
}).finally(() => {
    // A brief timeout to allow any async logging to complete.
    setTimeout(() => process.exit(process.exitCode || 0), 500);
}); 