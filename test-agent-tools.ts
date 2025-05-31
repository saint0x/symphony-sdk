import { Symphony } from './src/symphony';
import { Logger } from './src/utils/logger';
import * as fs from 'fs';
import path from 'path';

const testLogger = Logger.getInstance('AgentToolTest');

async function testAgentToolExecution() {
    testLogger.info('Test', 'Starting agent tool execution test');
    
    // Clean up test files
    const testFile = path.join(process.cwd(), 'test-agent-output.txt');
    if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
    }
    
    try {
        // Initialize Symphony
        const symphony = new Symphony({
            llm: {
                provider: 'openai',
                model: 'gpt-3.5-turbo'
            },
            db: {
                type: 'sqlite',
                path: './symphony.db'
            }
        });
        
        await symphony.initialize();
        testLogger.info('Test', 'Symphony initialized');
        
        // Create a test agent with writeFile tool
        const testAgent = await symphony.agent.create({
            name: 'TestFileAgent',
            description: 'writes files to disk',
            task: 'create files based on user requests',
            tools: ['writeFile', 'readFile'],
            llm: {
                model: 'gpt-3.5-turbo',
                temperature: 0.3 // Lower temp for more consistent tool usage
            }
        });
        
        testLogger.info('Test', 'Test agent created with tools: writeFile, readFile');
        
        // Test 1: Simple file creation
        testLogger.info('Test', '=== Test 1: Simple file creation ===');
        const result1 = await testAgent.run('Create a file called test-agent-output.txt with the content "Hello from Symphony Agent!"');
        
        testLogger.info('Test', 'Agent response:', {
            response: result1.response,
            toolsExecuted: result1.toolsExecuted
        });
        
        // Verify file was created
        const fileExists = fs.existsSync(testFile);
        testLogger.info('Test', `File exists: ${fileExists}`);
        
        if (fileExists) {
            const content = fs.readFileSync(testFile, 'utf-8');
            testLogger.info('Test', `File content: "${content}"`);
            testLogger.info('Test', `✅ Test 1 PASSED: File created successfully`);
        } else {
            testLogger.error('Test', '❌ Test 1 FAILED: File was not created');
        }
        
        // Test 2: Multiple tool calls
        testLogger.info('Test', '\n=== Test 2: Multiple tool calls ===');
        const result2 = await testAgent.run('First create a file called test2.txt with "Test 2", then read the test-agent-output.txt file');
        
        testLogger.info('Test', 'Agent response:', {
            response: result2.response.substring(0, 200) + '...',
            toolsExecutedCount: result2.toolsExecuted?.length || 0
        });
        
        if (result2.toolsExecuted && result2.toolsExecuted.length > 1) {
            testLogger.info('Test', `✅ Test 2 PASSED: ${result2.toolsExecuted.length} tools executed`);
        } else {
            testLogger.error('Test', '❌ Test 2 FAILED: Multiple tools were not executed');
        }
        
        // Test 3: Invalid tool handling
        testLogger.info('Test', '\n=== Test 3: Invalid tool handling ===');
        const result3 = await testAgent.run('Use a non-existent tool called fakeToolThatDoesNotExist');
        
        testLogger.info('Test', 'Agent response:', {
            response: result3.response.substring(0, 200) + '...'
        });
        
        // Clean up
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
        if (fs.existsSync('test2.txt')) {
            fs.unlinkSync('test2.txt');
        }
        
        testLogger.info('Test', '\n=== Test Summary ===');
        testLogger.info('Test', 'Agent tool execution tests completed');
        
    } catch (error) {
        testLogger.error('Test', 'Test failed with error:', { error });
        throw error;
    }
}

// Run the test
testAgentToolExecution().catch(error => {
    testLogger.error('Test', 'Fatal error:', { error });
    process.exit(1);
}); 