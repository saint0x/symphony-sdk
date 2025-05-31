import { symphony } from './src/index';
import { ToolConfig, ToolResult } from './src/types/sdk'; // Assuming ToolConfig and ToolResult are accessible

const CUSTOM_TOOL_NAME = 'myCustomTestTool';
let handlerCalled = false;

// 1. Define a simple custom ToolConfig
const customToolConfig: ToolConfig = {
    name: CUSTOM_TOOL_NAME,
    description: 'A custom tool for testing direct execution after creation.',
    type: 'custom',
    inputs: ['message'],
    outputs: ['reply'],
    handler: async (params: { message: string }): Promise<ToolResult<{ reply: string }>> => {
        console.log(`[${CUSTOM_TOOL_NAME}] Handler called with params:`, params);
        handlerCalled = true;
        if (!params || typeof params.message !== 'string') {
            return { success: false, error: 'Message parameter is required and must be a string.' };
        }
        return { success: true, result: { reply: `Handler received: ${params.message}` } };
    },
    config: { // Nested config for other custom properties
        customSetting: 'testValue123'
    }
};

async function testCustomToolCreationAndExecution() {
    console.log(`🧪 Testing custom tool creation and direct execution for: ${CUSTOM_TOOL_NAME}...\n`);
    let exitCode = 0;
    let testPassed = false;

    try {
        console.log('Initializing Symphony...');
        await symphony.initialize();
        console.log('✅ Symphony initialized');

        // 2. Create the custom tool using symphony.tool.create()
        console.log(`Attempting to create custom tool: ${CUSTOM_TOOL_NAME}...`);
        // The returned object from create isn't the registered instance, so we don't strictly need it for this test's execution part.
        await symphony.tool.create(customToolConfig);
        console.log(`✅ Custom tool "${CUSTOM_TOOL_NAME}" should be created and registered via ToolService.`);

        // Verify handler placement via getInfo (optional but good for debugging)
        const registeredToolInfo = symphony.tool.getInfo(CUSTOM_TOOL_NAME);
        if (registeredToolInfo) {
            console.log(`🔍 Registered tool info for ${CUSTOM_TOOL_NAME}:`, JSON.stringify(registeredToolInfo, null, 2));
            if (typeof registeredToolInfo.handler === 'function') {
                console.log(`✅ Handler found at the top level of the registered tool info.`);
            } else {
                console.error(`❌ Handler NOT found at the top level. Found: ${typeof registeredToolInfo.handler}`);
            }
            if (registeredToolInfo.config && registeredToolInfo.config.customSetting === 'testValue123') {
                console.log(`✅ Custom nested config.customSetting found.`);
            } else {
                console.error(`❌ Custom nested config.customSetting NOT found or incorrect.`);
            }
            // Note: The ToolRegistry stores the processed object. Depending on how getInfo retrieves it,
            // it might or might not show the nested config.handler if ToolService.create correctly *doesn't* place it there.
        } else {
            console.error(`❌ Could not retrieve info for registered tool ${CUSTOM_TOOL_NAME}.`);
        }

        // 3. Directly execute the tool using symphony.tool.execute()
        const executionParams = { message: 'Hello, custom world!' };
        console.log(`Attempting to execute custom tool "${CUSTOM_TOOL_NAME}" directly with params:`, executionParams);
        handlerCalled = false; // Reset flag before execution
        const executionResult = await symphony.tool.execute(CUSTOM_TOOL_NAME, executionParams);
        console.log(`Execution result for "${CUSTOM_TOOL_NAME}":`, executionResult);

        // 4. Validate the execution
        if (executionResult.success && executionResult.result?.reply === 'Handler received: Hello, custom world!') {
            if (handlerCalled) {
                console.log('✅ Custom tool executed successfully, handler was called, and result is correct.');
                testPassed = true;
            } else {
                console.error('❌ Custom tool reported success, but the test handler flag was not set!');
                testPassed = false;
            }
        } else {
            console.error(`❌ Custom tool execution failed or result incorrect. Error: ${executionResult.error}`);
            testPassed = false;
        }

    } catch (error: any) {
        console.error(`❌ Test script failed critically:`, error);
        testPassed = false; 
    } finally {
        if (testPassed) {
            console.log(`\n✅ Test Outcome for ${CUSTOM_TOOL_NAME}: PASSED`);
            exitCode = 0;
        } else {
            console.error(`\n❌ Test Outcome for ${CUSTOM_TOOL_NAME}: FAILED`);
            exitCode = 1;
        }
        console.log(`\n🎉 Custom tool creation test script finished with exit code ${exitCode}.`);
        process.exit(exitCode);
    }
}

testCustomToolCreationAndExecution(); 