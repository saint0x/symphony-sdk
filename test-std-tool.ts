import { symphony } from './src/index';
import fs from 'fs'; // Use ES6 import for fs
import path from 'path'; // For path manipulation if needed

const AGENT_RUN_TIMEOUT_MS = 90000; // 90 seconds timeout

interface ToolTestCase {
    toolName: string;
    agentName: string;
    agentTaskDescription: string;
    systemPrompt: string;
    userRequest: string;
    validation: (result: any, testFiles?: Record<string, string>) => Promise<{ success: boolean; message: string }>;
    setup?: () => Promise<Record<string, string> | void>; // Optional setup, can return paths to files created
    cleanup?: (testFiles?: Record<string, string>) => Promise<void>; // Optional cleanup
}

// Helper to create the common JSON structure prompt
function getToolExecutionSystemPrompt(toolName: string, parametersString: string, exampleParams: string): string {
    return `You are a diligent agent. Your task is to use the "${toolName}" tool.
The "${toolName}" tool requires the following JSON parameters:
${parametersString}

When you decide to use the "${toolName}" tool, your response MUST be a JSON object in the following format:
{
  "tool_name": "${toolName}",
  "parameters": {
${exampleParams}
  }
}
Replace the example values with the actual values derived from the user's request.
Carefully analyze the user's request to extract the correct parameters.
Invoke the tool with these exact parameters in the required JSON format.
Confirm successful operations based on the tool's output.`;
}

// placeholder for all test cases
const testCases: ToolTestCase[] = [
    {
        toolName: 'writeFile',
        agentName: 'FileWritingAgent',
        agentTaskDescription: 'Writes files based on user requests.',
        systemPrompt: getToolExecutionSystemPrompt(
            'writeFile',
            '    - "path": string (the full path or filename for the file)\n    - "content": string (the content to write into the file)',
            '        "path": "PATH_VALUE",\n        "content": "CONTENT_VALUE"'
        ),
        userRequest: 'Please create a new file named "test-write-file.txt" and write the exact text "Hello from writeFileTool!" into it.',
        async setup() {
            // No specific setup needed beyond what the tool does
            return { testFilePath: 'test-write-file.txt' };
        },
        async validation(agentRunResult: any, testFiles?: Record<string, string>) {
            let toolExecutedSuccessfully = false;
            let fileCorrectlyCreated = false;
            let message = '';

            if (agentRunResult.success && agentRunResult.result && agentRunResult.result.toolsExecuted && agentRunResult.result.toolsExecuted.length > 0) {
                const toolOp = agentRunResult.result.toolsExecuted.find((t: any) => t.name === 'writeFile');
                if (toolOp && toolOp.success) {
                    toolExecutedSuccessfully = true;
                    message += 'writeFile tool reported success. ';
                } else {
                    message += `writeFile tool reported failure or was not executed. Error: ${toolOp?.error}. `; 
                }
            } else {
                message += 'Agent task failed or no tools reported. ';
            }

            const filePath = testFiles?.testFilePath || 'test-write-file.txt';
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                if (content === "Hello from writeFileTool!") {
                    fileCorrectlyCreated = true;
                    message += 'File content is CORRECT. ';
                } else {
                    message += `File content is INCORRECT. Expected \"Hello from writeFileTool!\", got \"${content}\". `;
                }
            } else {
                message += 'File was NOT created. ';
            }
            return { success: toolExecutedSuccessfully && fileCorrectlyCreated, message };
        },
        async cleanup(testFiles?: Record<string, string>) {
            const filePath = testFiles?.testFilePath || 'test-write-file.txt';
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🧹 Cleaned up ${filePath}`);
            }
        }
    },
    {
        toolName: 'readFile',
        agentName: 'FileReaderAgent',
        agentTaskDescription: 'Reads files based on user requests.',
        systemPrompt: getToolExecutionSystemPrompt(
            'readFile',
            '    - "path": string (the full path or filename of the file to read)',
            '        "path": "FILE_PATH_VALUE"'
        ),
        userRequest: 'Please read the file named "test-read-file.txt".',
        async setup() {
            const filePath = 'test-read-file.txt';
            const fileContent = "Content to be read by readFileTool.";
            fs.writeFileSync(filePath, fileContent, 'utf-8');
            console.log(`🔧 Created temporary file ${filePath} for readFile test.`);
            return { testFilePath: filePath, expectedContent: fileContent };
        },
        async validation(agentRunResult: any, testFiles?: Record<string, string>) {
            let toolExecutedSuccessfully = false;
            let contentCorrectlyRead = false;
            let message = '';
            const expectedContent = testFiles?.expectedContent || "";

            if (agentRunResult.success && agentRunResult.result && agentRunResult.result.toolsExecuted && agentRunResult.result.toolsExecuted.length > 0) {
                const toolOp = agentRunResult.result.toolsExecuted.find((t: any) => t.name === 'readFile');
                if (toolOp && toolOp.success) {
                    toolExecutedSuccessfully = true;
                    message += 'readFile tool reported success. ';
                    if (toolOp.result && toolOp.result.content === expectedContent) {
                        contentCorrectlyRead = true;
                        message += 'File content read CORRECTLY. ';
                    } else {
                        message += `File content read INCORRECTLY. Expected \"${expectedContent}\", got \"${toolOp.result?.content}\". `;
                    }
                } else {
                    message += `readFile tool reported failure or was not executed. Error: ${toolOp?.error}. `;
                }
            } else {
                message += 'Agent task failed or no tools reported. ';
            }
            return { success: toolExecutedSuccessfully && contentCorrectlyRead, message };
        },
        async cleanup(testFiles?: Record<string, string>) {
            const filePath = testFiles?.testFilePath;
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🧹 Cleaned up ${filePath}`);
            }
        }
    },
    {
        toolName: 'webSearch',
        agentName: 'WebSearchAgent',
        agentTaskDescription: 'Searches the web for information.',
        systemPrompt: getToolExecutionSystemPrompt(
            'webSearch',
            '    - "query": string (the search query)\n    - "type": string (optional, e.g., \"news\", \"images\")',
            '        "query": "SEARCH_QUERY_VALUE",\n        "type": "OPTIONAL_TYPE_VALUE"'
        ),
        userRequest: 'Please search the web for "Symphony SDK framework".',
        async validation(agentRunResult: any) {
            let toolExecutedSuccessfully = false;
            let resultsReceived = false;
            let message = '';

            if (agentRunResult.success && agentRunResult.result && agentRunResult.result.toolsExecuted && agentRunResult.result.toolsExecuted.length > 0) {
                const toolOp = agentRunResult.result.toolsExecuted.find((t: any) => t.name === 'webSearch');
                if (toolOp && toolOp.success) {
                    toolExecutedSuccessfully = true;
                    message += 'webSearch tool reported success. ';
                    if (toolOp.result && (toolOp.result.organic_results || toolOp.result.news_results || toolOp.result.related_searches || toolOp.result.searchParameters)) {
                        resultsReceived = true;
                        message += 'Search results seem to have been received. ';
                    } else {
                        message += `Search result structure looks unexpected or empty: ${JSON.stringify(toolOp.result)}. `;
                    }
                } else {
                    message += `webSearch tool reported failure or was not executed. Error: ${toolOp?.error}. `;
                }
            } else {
                message += 'Agent task failed or no tools reported. ';
            }
            return { success: toolExecutedSuccessfully && resultsReceived, message };
        }
        // No specific setup or cleanup needed for webSearch beyond ensuring SERPER_API_KEY is in .env
    },
    // We will add more test cases here
];

async function runAllStandardToolTests() {
    console.log('🧪 Testing ALL standard tool functionalities...\n');
    let allTestsPassed = true;
    const overallResults: Array<{ toolName: string; passed: boolean; message: string }> = [];

    try {
        console.log('Initializing Symphony...');
        await symphony.initialize();
        console.log('✅ Symphony initialized');

        for (const tc of testCases) {
            console.log(`\n--- Testing Tool: ${tc.toolName} ---`);
            let testPassed = false;
            let validationMessage = 'Test not executed.';
            let testFiles: Record<string, string> | void = undefined;

            try {
                if (tc.setup) {
                    console.log('🔧 Running test setup...');
                    testFiles = await tc.setup();
                    console.log('🔧 Setup complete.');
                }

                console.log('Creating agent...');
        const agent = await symphony.agent.create({
                    name: tc.agentName,
                    description: tc.agentTaskDescription,
                    task: tc.agentTaskDescription, // Simplified, can be same as description
                    tools: [tc.toolName],
                    systemPrompt: tc.systemPrompt,
            llm: {
                model: 'gpt-3.5-turbo',
                        temperature: 0.0
            }
        });
                console.log(`✅ Agent "${tc.agentName}" created for tool "${tc.toolName}".`);

                console.log(`🗣️ User Request: "${tc.userRequest}"`);
        console.log(`⏳ Attempting to run agent task with a ${AGENT_RUN_TIMEOUT_MS / 1000}s timeout...`);
        
                let agentRunResult: any = { success: false, result: { response: 'Agent run not initiated' } };

        try {
                    agentRunResult = await Promise.race([
                        agent.run(tc.userRequest),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Agent execution timed out')), AGENT_RUN_TIMEOUT_MS)
                )
            ]);
                } catch (e: any) {
            if (e.message === 'Agent execution timed out') {
                console.warn('⏰ Agent execution timed out.');
                        agentRunResult = { success: false, result: { response: 'Execution timed out' } };
            } else {
                console.error('❌ Error during agent.run():', e);
                        throw e; // Rethrow critical errors
            }
        }
        
        console.log('\n📊 Agent Result:');
                console.log(`Agent task chain overall success: ${agentRunResult.success}`);
                if (agentRunResult.result && agentRunResult.result.toolsExecuted && agentRunResult.result.toolsExecuted.length > 0) {
                    console.log(`Tools executed by agent: ${agentRunResult.result.toolsExecuted.length}`);
                    agentRunResult.result.toolsExecuted.forEach((tool: any, i: number) => {
                        console.log(`  ${i + 1}. Tool: ${tool.name}`);
                console.log(`     Success: ${tool.success ? '✅' : '❌'}`);
                console.log(`     Result: ${JSON.stringify(tool.result)}`);
                         if(tool.error) console.log(`     Error: ${tool.error}`);
            });
        } else {
            console.log('No tools reported as executed by the agent.');
        }
                 if (agentRunResult.result && agentRunResult.result.response) {
                    const responseStr = typeof agentRunResult.result.response === 'string' ? agentRunResult.result.response : JSON.stringify(agentRunResult.result.response);
                    console.log(`LLM Response: ${responseStr.substring(0, 300)}${responseStr.length > 300 ? '...' : ''}`);
                }


                console.log('\n🔍 Performing validation...');
                const validationResult = await tc.validation(agentRunResult, testFiles || undefined);
                testPassed = validationResult.success;
                validationMessage = validationResult.message;

                if (testPassed) {
                    console.log(`✅ Test for ${tc.toolName}: PASSED. ${validationMessage}`);
                } else {
                    console.error(`❌ Test for ${tc.toolName}: FAILED. ${validationMessage}`);
                    allTestsPassed = false;
                }

            } catch (error: any) {
                console.error(`❌ Test script for ${tc.toolName} failed critically:`, error);
                validationMessage = `Critical error: ${error.message}`;
                allTestsPassed = false;
            } finally {
                if (tc.cleanup) {
                    console.log('🧹 Running test cleanup...');
                    await tc.cleanup(testFiles || undefined);
                    console.log('🧹 Cleanup complete.');
                }
                overallResults.push({ toolName: tc.toolName, passed: testPassed, message: validationMessage });
            }
        }
    } catch (mainError: any) {
        console.error('❌ Main test script failed critically:', mainError);
        allTestsPassed = false;
        overallResults.push({ toolName: 'Framework', passed: false, message: `Main error: ${mainError.message}`});
    } finally {
        console.log('\n--- Overall Test Summary --- ');
        overallResults.forEach(r => {
            console.log(`[${r.passed ? '✅ PASSED' : '❌ FAILED'}] ${r.toolName}: ${r.message}`);
        });

        if (allTestsPassed) {
            console.log('\n🎉🎉🎉 ALL STANDARD TOOL TESTS PASSED! 🎉🎉🎉');
            process.exit(0);
        } else {
            console.error('\n🚫 SOME STANDARD TOOL TESTS FAILED. 🚫');
            process.exit(1);
        }
    }
}

runAllStandardToolTests();
