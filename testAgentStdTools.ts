import { symphony } from './src/index';
import { envConfig } from './src/utils/env';
import * as assert from 'assert';

const logger = symphony.logger;

async function runAgentStdToolsTest() {
    logger.info('TestRunner', '=== TEST: Agent Standard Tools (ponder, writeCode) ===');

    // Initialize Symphony
    await symphony.initialize();
    
    // Get agent service
    const agentService = await symphony.getService('agent');
    assert.ok(agentService, 'Agent service should be available');

    // Step 1: Create an agent
    logger.info('TestRunner', 'Step 1: Creating a new agent...');
    const testAgent = await agentService.create({
        name: 'testArchitectAgent',
        description: 'Software Architect',
        task: 'Ponder on software design principles and generate elegant code solutions.',
        tools: ['ponder', 'writeCode'], // Explicitly provide the tools the agent can use
        llm: { model: envConfig.defaultModel } // Add the required LLM configuration
    });
    assert.ok(testAgent, 'Agent creation should be successful');
    logger.info('TestRunner', `Agent '${testAgent.name}' created successfully.`);

    // Step 2: Define a complex prompt and execute it
    logger.info('TestRunner', 'Step 2: Executing a complex task with the agent...');
    const prompt = `
        First, deeply ponder on the design of a robust and scalable cron job system in Node.js. 
        Consider aspects like error handling, logging, and preventing overlapping job executions.
        After pondering, write the TypeScript code for a simple cron job implementation that logs 
        'Executing scheduled task' to the console every 5 seconds. Use the 'node-cron' library.
    `;
    
    // The agent's execute method is now the main entry point for tasks.
    // The AgentExecutor is designed to take the high-level task and orchestrate tool use.
    const result = await testAgent.executeTask(prompt);

    // Step 3: Verify the result
    logger.info('TestRunner', 'Step 3: Verifying the execution result...');
    
    // Debug: Log the full result structure
    logger.info('TestRunner', 'Debug - Full result structure:', {
        success: result.success,
        error: result.error,
        result: result.result
    });
    
    assert.strictEqual(result.success, true, `Agent execution should succeed. Error: ${result.error}`);
    assert.ok(result.result, 'Execution result object should be present');
    
    // Extract the final content from the correct location
    let finalContent: string = '';
    
    // Check if there are tool executions with results
    if (result.result.toolsExecuted && result.result.toolsExecuted.length > 0) {
        // Get content from the first tool execution result
        const toolResult = result.result.toolsExecuted[0];
        if (toolResult.result && toolResult.result.response) {
            finalContent = toolResult.result.response;
        }
    }
    
    // Fallback to the main response if no tool execution found
    if (!finalContent && result.result.response) {
        finalContent = result.result.response;
    }
    
    assert.ok(finalContent, 'The final response content should exist.');
    logger.info('TestRunner', 'Final content extracted:', finalContent.substring(0, 200) + '...');
    
    // Check for the expected cron job implementation
    assert.ok(finalContent.includes('node-cron') && finalContent.includes('Executing scheduled task'), 'The generated code should contain the expected cron job implementation.');

    logger.info('TestRunner', 'Generated Code Snippet:\n' + finalContent);
    logger.info('TestRunner', '\n🎉🎉🎉 Agent Standard Tools Test PASSED! 🎉🎉🎉');
    process.exitCode = 0;
}

runAgentStdToolsTest().catch(err => {
    logger.error('TestRunner', 'Agent Standard Tools TEST SCRIPT FAILED:', { message: err.message, stack: err.stack });
    process.exitCode = 1;
}).finally(() => {
    // A timeout is added to allow any async logging to complete.
    setTimeout(() => process.exit(process.exitCode || 0), 1000);
}); 