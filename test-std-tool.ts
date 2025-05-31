import { symphony } from './src/index';
import fs from 'fs'; // Use ES6 import for fs

const AGENT_RUN_TIMEOUT_MS = 90000; // 90 seconds timeout

async function testStandardTool() {
    console.log('🧪 Testing standard tool functionality...\n');
    const testFilePath = 'std-tool-test.txt';
    let exitCode = 0; 
    let agentTaskSuccessful = false;
    let fileSuccessfullyCreated = false;

    const systemPrompt = `You are TestStdToolAgent, a diligent file management assistant.
    Your primary function is to manage files based on user requests.
    When a user asks you to create or write to a file, you MUST use the "writeFile" tool.
    The "writeFile" tool requires the following JSON parameters: 
    - "path": string (the full path or filename for the file)
    - "content": string (the content to write into the file)
    
    When you decide to use the "writeFile" tool, your response MUST be a JSON object in the following format:
    {
      "tool_name": "writeFile",
      "parameters": {
        "path": "PATH_VALUE",
        "content": "CONTENT_VALUE"
      }
    }
    Replace PATH_VALUE and CONTENT_VALUE with the actual path and content derived from the user's request.
    
    Carefully analyze the user's request to extract the correct values for "path" and "content".
    Then, invoke the "writeFile" tool with these exact parameters in the required JSON format.
    Do not attempt to create files through other means or by saying you've created them without using the tool. 
    Confirm successful file operations based on the tool's output.`;

    try {
        console.log('Initializing Symphony...');
        await symphony.initialize();
        console.log('✅ Symphony initialized');

        console.log('Creating agent with detailed system prompt...');
        const agent = await symphony.agent.create({
            name: 'TestStdToolAgent',
            description: 'Test agent for standard tools, with detailed system prompt for tool parameterization',
            task: 'Use standard tools to write files as per user requests, paying close attention to tool parameters.',
            tools: ['writeFile'],
            systemPrompt: systemPrompt, 
            llm: {
                model: 'gpt-3.5-turbo',
                temperature: 0.0 // Minimal temperature for max adherence to instructions
            }
        });
        console.log('✅ Agent created with writeFile tool and detailed system prompt');

        const userRequest = 'Please create a new file named "std-tool-test.txt" and write the exact text "Standard tools working!" into it.';
        console.log(`
🗣️ User Request: "${userRequest}"`);
        console.log(`⏳ Attempting to run agent task with a ${AGENT_RUN_TIMEOUT_MS / 1000}s timeout...`);
        
        let result: any = { success: false, response: 'Agent run not initiated', toolsExecuted: [] };

        try {
            result = await Promise.race([
                agent.run(userRequest),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Agent execution timed out')), AGENT_RUN_TIMEOUT_MS)
                )
            ]);
            // Check if agent.run() itself indicates success AND if toolsExecuted has a successful writeFile
            // The detailed execution result, including toolsExecuted, is nested in result.result
            if (result.success && result.result && result.result.toolsExecuted && result.result.toolsExecuted.length > 0) {
                const writeFileToolExecution = result.result.toolsExecuted.find((t:any) => t.name === 'writeFile'); // toolsExecuted items have .name
                agentTaskSuccessful = writeFileToolExecution ? writeFileToolExecution.success : false;
            } else {
                agentTaskSuccessful = false;
            }

        } catch (e:any) {
            if (e.message === 'Agent execution timed out') {
                console.warn('⏰ Agent execution timed out.');
                result = { success: false, response: 'Execution timed out', toolsExecuted: [] };
                agentTaskSuccessful = false;
            } else {
                console.error('❌ Error during agent.run():', e);
                agentTaskSuccessful = false;
                throw e; 
            }
        }
        
        console.log('\n📊 Agent Result:');
        console.log(`Agent task chain overall success: ${result.success}`);
        console.log(`Specific writeFile tool success: ${agentTaskSuccessful}`);

        if (result.result && result.result.response) { // Access response from result.result
            const responseStr = typeof result.result.response === 'string' ? result.result.response : JSON.stringify(result.result.response);
            console.log(`LLM Response: ${responseStr.substring(0, 500)}${responseStr.length > 500 ? '...' : ''}`);
        }

        if (result.result && result.result.toolsExecuted && result.result.toolsExecuted.length > 0) { // Access toolsExecuted from result.result
            console.log(`Tools executed by agent: ${result.result.toolsExecuted.length}`);
            result.result.toolsExecuted.forEach((tool:any, i:number) => {
                console.log(`  ${i + 1}. Tool: ${tool.name}`); // toolsExecuted items have .name
                console.log(`     Params: ${JSON.stringify(tool.parameters)}`); // This might be undefined if not explicitly passed through
                console.log(`     Success: ${tool.success ? '✅' : '❌'}`);
                console.log(`     Result: ${JSON.stringify(tool.result)}`);
            });
        } else {
            console.log('No tools reported as executed by the agent.');
        }

    } catch (error) {
        console.error('❌ Test script failed critically:', error);
        exitCode = 1; 
    } finally {
        console.log('\n🔍 Performing cleanup and final validation...');
        const fileExists = fs.existsSync(testFilePath);
        
        if (fileExists) {
            try {
                const content = fs.readFileSync(testFilePath, 'utf-8');
                console.log(`📄 File "${testFilePath}" exists. Content: "${content}"`);
                if (content === "Standard tools working!") {
                    console.log('✅ File content is CORRECT.');
                    fileSuccessfullyCreated = true;
                } else {
                    console.error('❌ File content is INCORRECT.');
                    fileSuccessfullyCreated = false;
                }
                fs.unlinkSync(testFilePath);
                console.log(`🧹 Test file "${testFilePath}" cleaned up.`);
            } catch (cleanupError) {
                console.error(`🧹 Error during file read/cleanup:`, cleanupError);
                fileSuccessfullyCreated = false; 
            }
        } else {
            console.error(`❌ File "${testFilePath}" was NOT created.`);
            fileSuccessfullyCreated = false;
        }

        if (agentTaskSuccessful && fileSuccessfullyCreated) {
            console.log('✅ Test Outcome: PASSED');
            exitCode = 0;
        } else {
            console.error('❌ Test Outcome: FAILED (Agent task or file creation/validation failed).');
            exitCode = 1; 
        }

        console.log(`
🎉 Standard tool test script finished with exit code ${exitCode}.`);
        process.exit(exitCode); 
    }
}

testStandardTool(); 