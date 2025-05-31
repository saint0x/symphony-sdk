import { Symphony } from './src/symphony';
import { ToolConfig, ToolResult } from './src/types/sdk';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

dotenv.config();

const TEST_FILE_DIR = path.join(__dirname, 'test_outputs');
// Changed file name for this specific test
const TEST_FILE_PATH = path.join(TEST_FILE_DIR, 'sequential_test_output.txt'); 

async function testSequentialToolCalls() { // Renamed function
    console.log('=== Sequential JSON Tool Calls Test ===\n');

    // Ensure test output directory exists
    try {
        await fs.mkdir(TEST_FILE_DIR, { recursive: true });
    } catch (e) { /* ignore if exists */ }

    // Clean up previous test file if it exists
    try {
        await fs.unlink(TEST_FILE_PATH);
        console.log('[Setup] Cleaned up previous sequential test file.');
    } catch (e) { /* ignore if not exists */ }

    // Initialize Symphony with detailed logging
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
            level: 'debug'
        },
        serviceRegistry: {
            enabled: false,
            maxRetries: 0,
            retryDelay: 0
        },
        metrics: {
            enabled: false,
            detailed: false
        }
    });

    try {
        await symphony.initialize();
        console.log('✓ [Symphony] Initialized successfully.\n');
    } catch (error) {
        console.error('✗ [Symphony] Initialization failed:', error);
        process.exit(1);
    }

    // 1a. Define customWriteFile tool (reused)
    console.log('[Tool] Defining customWriteFile tool...');
    const customWriteFileTool: ToolConfig = {
        name: 'customWriteFile',
        description: 'Writes specified content to a specified file. Use for creating or overwriting files.',
        type: 'filesystem',
        inputs: [
            { name: 'filePath', type: 'string', required: true, description: 'The full path where the file should be written.' },
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

    // 1b. Define capitalizeText tool (new)
    console.log('[Tool] Defining capitalizeText tool...');
    const capitalizeTextTool: ToolConfig = {
        name: 'capitalizeText',
        description: 'Converts a given string to uppercase.',
        type: 'string_manipulation',
        inputs: [
            { name: 'text', type: 'string', required: true, description: 'The text to capitalize.' }
        ],
        outputs: ['capitalizedText'],
        config: {},
        handler: async (params: { text: string }): Promise<ToolResult> => {
            console.log(`[Tool Handler - capitalizeText] Called with params:`, params);
            if (typeof params.text !== 'string') {
                console.error('[Tool Handler - capitalizeText] Missing or invalid text input');
                return { success: false, error: 'Missing or invalid text input for capitalization.' };
            }
            const capitalizedText = params.text.toUpperCase();
            console.log(`✓ [Tool Handler - capitalizeText] Text capitalized: "${capitalizedText}"`);
            return { success: true, result: { capitalizedText } };
        }
    };

    const toolRegistry = symphony.tool.registry;
    toolRegistry.registerTool(customWriteFileTool.name, customWriteFileTool);
    toolRegistry.registerTool(capitalizeTextTool.name, capitalizeTextTool);
    console.log('✓ [Tool] Both customWriteFile and capitalizeText tools registered.\n');

    // 2. Create an Agent Configured for JSON Tool Calling with multiple tools
    console.log('[Agent] Creating sequential-tool-agent...');
    const agentConfig = {
        name: 'SequentialToolAgent',
        description: 'An agent that uses tools sequentially based on JSON responses.',
        task: 'Perform string manipulation and file operations as requested.', // Generic task
        tools: [customWriteFileTool.name, capitalizeTextTool.name], // Assign both tools
        llm: {
            model: 'gpt-4o-mini',
            useFunctionCalling: true,
            temperature: 0.1
        },
        // Updated System Prompt for multiple tools
        systemPrompt: `You are an AI assistant that responds with a JSON object.
The JSON object MUST contain:
1. A "tool_name" key: a string specifying the tool to use. If no tool is needed, use "none".
2. A "parameters" key: an object containing the parameters for the specified tool. If "tool_name" is "none", this can be an empty object or null.

Available tools and their parameters:

- Tool Name: "${customWriteFileTool.name}"
  - Description: "${customWriteFileTool.description}"
  - Parameters:
    - "filePath" (string, required): "The full path where the file should be written."
    - "content" (string, required): "The content to write into the file."

- Tool Name: "${capitalizeTextTool.name}"
  - Description: "${capitalizeTextTool.description}"
  - Parameters:
    - "text" (string, required): "The text to capitalize."

Example Response for writing a file:
{
  "tool_name": "${customWriteFileTool.name}",
  "parameters": {
    "filePath": "/some/path/file.txt",
    "content": "This is the content."
  }
}

Example Response for capitalizing text:
{
  "tool_name": "${capitalizeTextTool.name}",
  "parameters": {
    "text": "sample text to capitalize"
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
        console.log(`✓ [Agent] Agent "${agent.name}" created successfully.\n`);
    } catch (error) {
        console.error('✗ [Agent] Agent creation failed:', error);
        process.exit(1);
    }

    // --- Step 1: Capitalize Text ---
    const textToCapitalize = 'hello from sequential test';
    const task1Description = `Please capitalize the text: "${textToCapitalize}"`;
    console.log(`[Task 1] Attempting to execute: "${task1Description}"\n`);

    let agentResult1;
    let capitalizedTextOutput = '';
    try {
        agentResult1 = await agent.run(task1Description);
        console.log('\n✓ [Task 1] Agent execution completed.');
        console.log('  Success:', agentResult1.success);
        console.log('  Agent Response:', agentResult1.result?.response);
        
        if (agentResult1.success && agentResult1.result?.toolsExecuted && agentResult1.result.toolsExecuted.length > 0) {
            console.log('  Tools Executed (Task 1):', JSON.stringify(agentResult1.result.toolsExecuted, null, 2));
            const capToolResult = agentResult1.result.toolsExecuted.find(t => t.name === capitalizeTextTool.name);
            if (capToolResult?.success && capToolResult.result?.capitalizedText) {
                capitalizedTextOutput = capToolResult.result.capitalizedText;
                console.log(`✓ [Task 1] Successfully extracted capitalized text: "${capitalizedTextOutput}"`);
            } else {
                throw new Error('CapitalizeText tool did not run successfully or return expected output.');
            }
        } else {
            throw new Error(`Task 1 failed or no tools were executed. Response: ${agentResult1.result?.response}`);
        }
    } catch (error) {
        console.error('✗ [Task 1] Agent execution failed:', error);
        process.exit(1);
    }

    if (capitalizedTextOutput !== textToCapitalize.toUpperCase()) {
        console.error(`✗ [Verification Task 1] Capitalized text mismatch. Expected: "${textToCapitalize.toUpperCase()}", Got: "${capitalizedTextOutput}"`);
        process.exit(1);
    }
    console.log('✓ [Verification Task 1] Capitalized text is CORRECT.\n');

    // --- Step 2: Write Capitalized Text to File ---
    const task2Description = `Write the text "${capitalizedTextOutput}" to a file named "${path.basename(TEST_FILE_PATH)}" at the path "${TEST_FILE_PATH}".`;
    console.log(`[Task 2] Attempting to execute: "${task2Description}"\n`);
    
    let agentResult2;
    try {
        agentResult2 = await agent.run(task2Description);
        console.log('\n✓ [Task 2] Agent execution completed.');
        console.log('  Success:', agentResult2.success);
        console.log('  Agent Response:', agentResult2.result?.response);
        if (agentResult2.result?.toolsExecuted && agentResult2.result.toolsExecuted.length > 0) {
            console.log('  Tools Executed (Task 2):', JSON.stringify(agentResult2.result.toolsExecuted, null, 2));
        } else {
             console.log('  No tools reported as executed by agent.result.toolsExecuted (Task 2).');
             if (!agentResult2.success) throw new Error('Task 2 failed and no tools executed.');
        }
    } catch (error) {
        console.error('✗ [Task 2] Agent execution failed:', error);
        process.exit(1);
    }

    // Verify File Creation for Task 2
    console.log('\n[Verification Task 2] Checking if file was created with correct content...');
    try {
        const fileContent = await fs.readFile(TEST_FILE_PATH, 'utf-8');
        console.log(`✓ [Verification Task 2] File found at ${TEST_FILE_PATH}`);
        console.log('  File Content:', fileContent);
        if (fileContent === capitalizedTextOutput) {
            console.log('✓ [Verification Task 2] File content is CORRECT.');
        } else {
            console.error(`✗ [Verification Task 2] File content MISMATCH. Expected: "${capitalizedTextOutput}"`);
        }
    } catch (error) {
        console.error(`✗ [Verification Task 2] Failed to read file at ${TEST_FILE_PATH}:`, error);
        console.error('  This indicates the function call likely did not execute correctly or the file was not written as expected in Task 2.');
    }

    // Cleanup test file
    try {
        await fs.unlink(TEST_FILE_PATH);
        console.log('\n[Cleanup] Sequential test file deleted.');
    } catch (e) { /* ignore */ }

    console.log('\n=== Sequential JSON Tool Calls Test Complete ===');
}

// Run the test
testSequentialToolCalls().catch(error => {
    console.error('Unhandled error during sequential tool call test execution:', error);
    process.exit(1);
}); 