import { symphony } from './src/index';
import { envConfig } from './src/utils/env';
import * as assert from 'assert';

const logger = symphony.logger;

async function runAgentToolChainingTest() {
    logger.info('TestRunner', '=== TEST: Agent Tool Chaining & Orchestration ===');

    // Initialize Symphony
    await symphony.initialize();
    
    // Get agent service
    const agentService = await symphony.getService('agent');
    assert.ok(agentService, 'Agent service should be available');

    // Step 1: Create an agent with multiple complementary tools
    logger.info('TestRunner', 'Step 1: Creating agent with chaining capabilities...');
    const chainingAgent = await agentService.create({
        name: 'ChainingAgent',
        description: 'Agent that chains multiple tools together in sequence',
        task: 'Execute multi-step workflows using tool orchestration patterns',
        tools: ['ponder', 'writeCode'], // Tools that should work together
        llm: { model: envConfig.defaultModel }
    });
    assert.ok(chainingAgent, 'Chaining agent creation should be successful');
    logger.info('TestRunner', `Agent '${chainingAgent.name}' created successfully.`);

    // Step 2: Test sequential tool chaining
    logger.info('TestRunner', 'Step 2: Testing sequential tool chaining...');
    const chainingPrompt = `
        You MUST execute TWO tools in sequence:
        
        1. FIRST: Use the 'ponder' tool to analyze the concept of a Node.js event loop timer
        2. SECOND: Use the 'writeCode' tool to create a simple setTimeout example
        
        Execute both tools - ponder first, then writeCode. Do not skip either step.
    `;
    
    const chainingResult = await chainingAgent.executeTask(chainingPrompt);

    // Step 3: Verify tool chaining occurred
    logger.info('TestRunner', 'Step 3: Verifying tool chaining...');
    
    // Debug: Log the full result structure
    logger.info('TestRunner', 'Debug - Chaining result structure:', {
        success: chainingResult.success,
        error: chainingResult.error,
        toolsExecuted: chainingResult.result?.toolsExecuted?.map(t => ({ 
            name: t.name, 
            success: t.success 
        }))
    });
    
    assert.strictEqual(chainingResult.success, true, `Tool chaining should succeed. Error: ${chainingResult.error}`);
    assert.ok(chainingResult.result, 'Chaining result should be present');
    
    // Extract tools that were executed
    const executedTools = [];
    if (chainingResult.result.toolsExecuted && chainingResult.result.toolsExecuted.length > 0) {
        chainingResult.result.toolsExecuted.forEach(toolExecution => {
            if (toolExecution.result && toolExecution.result.toolsExecuted) {
                // Handle nested tool executions
                toolExecution.result.toolsExecuted.forEach(nestedTool => {
                    executedTools.push(nestedTool.name);
                });
            } else {
                executedTools.push(toolExecution.name);
            }
        });
    }
    
    logger.info('TestRunner', `Tools executed: ${executedTools.join(', ')}`);
    
    // Verify both tools were used
    assert.ok(executedTools.includes('ponder'), 'Ponder tool should have been executed');
    assert.ok(executedTools.includes('writeCode'), 'WriteCode tool should have been executed');
    assert.strictEqual(executedTools.length, 2, 'Exactly 2 tools should have been executed');
    
    logger.info('TestRunner', '✅ Tool chaining verification passed!');

    // Step 4: Test contextual chaining (output from first tool influences second)
    logger.info('TestRunner', 'Step 4: Testing contextual tool chaining...');
    const contextualPrompt = `
        Chain these tools with context passing:
        
        1. Use 'ponder' to analyze: "What are the key design patterns for database connection pooling?"
        2. Use 'writeCode' to implement ONE of the patterns identified in step 1
        
        The second tool should reference insights from the first tool.
    `;
    
    const contextualResult = await chainingAgent.executeTask(contextualPrompt);
    
    // Verify contextual chaining
    assert.strictEqual(contextualResult.success, true, `Contextual chaining should succeed. Error: ${contextualResult.error}`);
    
    // Extract final content to verify context passing
    let finalContent = '';
    if (contextualResult.result.toolsExecuted && contextualResult.result.toolsExecuted.length > 0) {
        // Get the last tool execution result
        const lastTool = contextualResult.result.toolsExecuted[contextualResult.result.toolsExecuted.length - 1];
        if (lastTool.result && lastTool.result.response) {
            finalContent = lastTool.result.response;
        }
    }
    
    // Verify the final code references concepts from pondering
    assert.ok(finalContent.includes('pool') || finalContent.includes('connection') || finalContent.includes('database'), 
        'Final code should reference database concepts from ponder analysis');
    
    logger.info('TestRunner', '✅ Contextual chaining verification passed!');
    logger.info('TestRunner', '\n🎉🎉🎉 Agent Tool Chaining Test PASSED! 🎉🎉🎉');
    process.exitCode = 0;
}

runAgentToolChainingTest().catch(err => {
    logger.error('TestRunner', 'Agent Tool Chaining TEST SCRIPT FAILED:', { message: err.message, stack: err.stack });
    process.exitCode = 1;
}).finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 1000);
}); 