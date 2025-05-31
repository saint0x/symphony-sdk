import { Symphony } from './src/symphony';
import { ToolConfig, ToolResult } from './src/types/sdk';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

dotenv.config();

const TEST_FILE_DIR = path.join(__dirname, 'test_outputs');
const TEST_FILE_PATH = path.join(TEST_FILE_DIR, 'function_call_test.txt');

async function testFunctionCalling() {
    console.time('Overall testFunctionCalling'); // Overall timer
    console.log('=== Function Calling Test ===\n');

    // Ensure test output directory exists
    console.time('Test File Setup');
    try {
        await fs.mkdir(TEST_FILE_DIR, { recursive: true });
    } catch (e) { /* ignore if exists */ }

    // Clean up previous test file if it exists
    try {
        await fs.unlink(TEST_FILE_PATH);
        console.log('[Setup] Cleaned up previous test file.');
    } catch (e) { /* ignore if not exists */ }
    console.timeEnd('Test File Setup');

    // Initialize Symphony with detailed logging
    console.time('Symphony Initialization FC');
    console.log('[Symphony] Initializing...');
    const symphony = new Symphony({
        llm: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY || 'test-key',
            useFunctionCalling: true,
            temperature: 0.1
        },
        db: {
            enabled: false
        },
        logging: {
            level: 'info' // Reverted to info
        },
        serviceRegistry: {
            enabled: false,
            maxRetries: 0,
            retryDelay: 0
        },
        metrics: {
            enabled: true, // Enable metrics
            detailed: true
        }
    });

    try {
        await symphony.initialize();
        console.timeEnd('Symphony Initialization FC');
        console.log('✓ [Symphony] Initialized successfully.\n');
    } catch (error) {
        console.timeEnd('Symphony Initialization FC');
        console.error('✗ [Symphony] Initialization failed:', error);
        process.exit(1);
    }

    // 1. Define and Register a Custom Tool
    console.log('[Tool] Defining customWriteFile tool...');
    const customWriteFileTool: ToolConfig = {
        name: 'customWriteFile',
        description: 'Writes specified content to a specified file. Use for creating or overwriting files.',
        type: 'filesystem',
        inputs: [
            // Explicitly define parameters for robust function schema generation
            // @ts-ignore - SDE INTERNALLY we would make ToolConfig.inputs more flexible like this
            { name: 'filePath', type: 'string', required: true, description: 'The full path where the file should be written.' },
            // @ts-ignore
            { name: 'content', type: 'string', required: true, description: 'The content to write into the file.' }
        ],
        outputs: ['status', 'fullPath'],
        config: {},
        handler: async (params: { filePath: string; content: string }): Promise<ToolResult> => {
            console.log(`[Tool Handler - customWriteFile] Called with params:`, params);
            if (!params.filePath || !params.content) {
                console.error('[Tool Handler - customWriteFile] Missing filePath or content');
                return { success: false, error: 'Missing filePath or content' };
            }
            try {
                await fs.writeFile(params.filePath, params.content, 'utf-8');
                console.log(`✓ [Tool Handler - customWriteFile] File written to ${params.filePath}`);
                return { success: true, result: { status: 'File written successfully', fullPath: params.filePath } };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`✗ [Tool Handler - customWriteFile] Error writing file:`, errorMessage);
                return { success: false, error: `Failed to write file: ${errorMessage}` };
            }
        }
    };

    const toolRegistry = symphony.tool.registry;
    toolRegistry.registerTool('customWriteFile', customWriteFileTool);
    console.log('✓ [Tool] customWriteFile tool registered.\n');

    // 2. Create an Agent Configured for Function Calling
    console.time('Agent Creation FC');
    console.log('[Agent] Creating function-calling agent...');
    const agentConfig = {
        name: 'FunctionCallerAgent',
        description: 'An agent that exclusively uses function calling to interact with tools.',
        task: 'Perform file operations as requested using available functions.',
        tools: ['customWriteFile'], // Assign the custom tool
        llm: {
            model: 'gpt-4o-mini',
            useFunctionCalling: true,
            temperature: 0.1
        },
        systemPrompt: `You are an AI assistant that responds with a JSON object.
The JSON object MUST contain:
1. A "tool_name" key: a string specifying the tool to use. If no tool is needed, use "none".
2. A "parameters" key: an object containing the parameters for the specified tool. If "tool_name" is "none", this can be an empty object or null.

Available tools and their parameters:
- Tool Name: "customWriteFile"
  - Description: "Writes specified content to a specified file. Use for creating or overwriting files."
  - Parameters:
    - "filePath" (string, required): "The full path where the file should be written."
    - "content" (string, required): "The content to write into the file."

Example Response for writing a file:
{
  "tool_name": "customWriteFile",
  "parameters": {
    "filePath": "/some/path/file.txt",
    "content": "This is the content."
  }
}

Example Response if no tool is needed:
{
  "tool_name": "none",
  "parameters": null
}

User's request will follow. Analyze it and respond ONLY with the JSON object as described.`
    };

    let agent;
    try {
        agent = await symphony.agent.create(agentConfig);
        console.timeEnd('Agent Creation FC');
        console.log(`✓ [Agent] Agent "${agent.name}" created successfully.\n`);
    } catch (error) {
        console.timeEnd('Agent Creation FC');
        console.error('✗ [Agent] Agent creation failed:', error);
        process.exit(1);
    }

    // 3. Run a Task that Requires Function Calling
    const taskDescription = `Please create a file at the path "${TEST_FILE_PATH}" and write the following content into it: "Hello from function call! Symphony SDK test complete."`;
    console.log(`[Task] Attempting to execute: "${taskDescription}"\n`);

    let agentResult;
    console.time('Agent Run FC');
    try {
        agentResult = await agent.run(taskDescription);
        console.timeEnd('Agent Run FC');
        console.log('\n✓ [Task] Agent execution completed.');
        console.log('  Success:', agentResult.success);
        console.log('  Agent Response:', agentResult.result?.response);
        if (agentResult.result?.toolsExecuted && agentResult.result.toolsExecuted.length > 0) {
            console.log('  Tools Executed:', JSON.stringify(agentResult.result.toolsExecuted, null, 2));
        } else {
            console.log('  No tools reported as executed by agent.result.toolsExecuted.');
        }
        if (agentResult.metrics?.duration) {
            console.log(`  Agent Run Duration (from metrics): ${agentResult.metrics.duration}ms`);
        }

    } catch (error) {
        console.timeEnd('Agent Run FC');
        console.error('✗ [Task] Agent execution failed:', error);
        process.exit(1);
    }

    // 4. Verify File Creation
    console.time('File Verification FC');
    console.log('\n[Verification] Checking if file was created...');
    try {
        const fileContent = await fs.readFile(TEST_FILE_PATH, 'utf-8');
        console.log(`✓ [Verification] File found at ${TEST_FILE_PATH}`);
        console.log('  File Content:', fileContent);
        if (fileContent === 'Hello from function call! Symphony SDK test complete.') {
            console.log('✓ [Verification] File content is CORRECT.');
        } else {
            console.error('✗ [Verification] File content MISMATCH.');
        }
    } catch (error) {
        console.error(`✗ [Verification] Failed to read file at ${TEST_FILE_PATH}:`, error);
        console.error('  This indicates the function call likely did not execute correctly or the file was not written as expected.');
    }
    console.timeEnd('File Verification FC');

    // Cleanup test file
    console.time('Test File Cleanup');
    try {
        await fs.unlink(TEST_FILE_PATH);
        console.log('\n[Cleanup] Test file deleted.');
    } catch (e) { /* ignore */ }
    console.timeEnd('Test File Cleanup');

    console.log('\n=== Function Calling Test Complete ===');
    console.timeEnd('Overall testFunctionCalling');
    process.exit(0); // Ensure graceful exit on success
}

// Run the test
testFunctionCalling().catch(error => {
    console.error('Unhandled error during test execution:', error);
    console.timeEnd('Overall testFunctionCalling'); // Ensure timer ends on error too
    process.exit(1);
}); 