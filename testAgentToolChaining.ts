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

    // Step 1: Create an agent with multiple complementary tools including file writing
    logger.info('TestRunner', 'Step 1: Creating agent with chaining capabilities...');
    const chainingAgent = await agentService.create({
        name: 'ChainingAgent',
        description: 'Agent that chains multiple tools together in sequence',
        task: 'Execute multi-step workflows using tool orchestration patterns',
        tools: ['ponder', 'writeCode', 'writeFile'], // Added writeFile tool
        llm: { model: envConfig.defaultModel }
    });
    assert.ok(chainingAgent, 'Chaining agent creation should be successful');
    logger.info('TestRunner', `Agent '${chainingAgent.name}' created successfully.`);

    // Step 2: Test sequential tool chaining with production-ready Rust implementation
    logger.info('TestRunner', 'Step 2: Testing sequential tool chaining with Rust production code...');
    const chainingPrompt = `
        You MUST execute THREE tools in sequence:
        
        1. FIRST: Use the 'ponder' tool to analyze: "Design patterns and best practices for building a high-performance, concurrent web server in Rust with proper error handling, logging, and graceful shutdown"
        2. SECOND: Use the 'writeCode' tool to create a complete, production-ready Rust web server implementation  
        3. THIRD: Use the 'writeFile' tool to save the generated code to 'rust_web_server.rs'
        
        Execute all three tools in sequence. The code should be production-quality with proper error handling, async/await, logging, configuration, and graceful shutdown.
    `;
    
    const chainingResult = await chainingAgent.executeTask(chainingPrompt);

    // Step 3: Verify tool chaining occurred and show generated code
    logger.info('TestRunner', 'Step 3: Verifying tool chaining and displaying generated code...');
    
    // Debug: Log the full result structure to understand it better
    logger.info('TestRunner', 'Debug - Full chaining result:', JSON.stringify(chainingResult, null, 2));
    
    assert.strictEqual(chainingResult.success, true, `Tool chaining should succeed. Error: ${chainingResult.error}`);
    assert.ok(chainingResult.result, 'Chaining result should be present');
    
    // Extract tools from the orchestration result
    const executedTools = [];
    let generatedCode = '';
    let codeExplanation = '';
    
    if (chainingResult.result.toolsExecuted && chainingResult.result.toolsExecuted.length > 0) {
        chainingResult.result.toolsExecuted.forEach(toolExecution => {
            executedTools.push(toolExecution.name);
            
            // Extract the generated code from writeCode tool
            if (toolExecution.name === 'writeCode' && toolExecution.result) {
                if (toolExecution.result.code) {
                    generatedCode = toolExecution.result.code;
                }
                if (toolExecution.result.explanation) {
                    codeExplanation = toolExecution.result.explanation;
                }
            }
        });
    }
    
    // Display the generated code
    if (generatedCode) {
        logger.info('TestRunner', '\n🦀 === GENERATED RUST WEB SERVER CODE === 🦀');
        console.log(generatedCode);
        logger.info('TestRunner', '\n🦀 === END GENERATED CODE === 🦀');
        
        if (codeExplanation) {
            logger.info('TestRunner', '\n📖 === CODE EXPLANATION === 📖');
            console.log(codeExplanation);
            logger.info('TestRunner', '\n📖 === END EXPLANATION === 📖');
        }
    } else {
        logger.warn('TestRunner', 'No generated code found in results');
    }
    
    logger.info('TestRunner', `Tools executed: ${executedTools.join(', ')}`);
    
    // Verify all three tools were used
    assert.ok(executedTools.includes('ponder'), 'Ponder tool should have been executed');
    assert.ok(executedTools.includes('writeCode'), 'WriteCode tool should have been executed');
    assert.ok(executedTools.includes('writeFile'), 'WriteFile tool should have been executed');
    assert.strictEqual(executedTools.length, 3, 'Exactly 3 tools should have been executed');
    
    logger.info('TestRunner', '✅ Tool chaining verification passed!');

    // Step 4: Test contextual chaining with advanced Rust microservice  
    logger.info('TestRunner', 'Step 4: Testing contextual tool chaining with microservice architecture...');
    const contextualPrompt = `
        Chain these tools with context passing for advanced Rust development:
        
        1. Use 'ponder' to analyze: "What are the essential architectural patterns for building scalable, fault-tolerant microservices in Rust with observability, circuit breakers, and distributed tracing?"
        2. Use 'writeCode' to implement a complete Rust microservice with the patterns identified in step 1
        3. Use 'writeFile' to save the microservice code to 'rust_microservice.rs'
        
        The microservice should include: REST API, database connection pooling, metrics, health checks, structured logging, configuration management, and proper error handling.
    `;
    
    const contextualResult = await chainingAgent.executeTask(contextualPrompt);
    
    // Extract and display microservice code
    let microserviceCode = '';
    if (contextualResult.result.toolsExecuted && contextualResult.result.toolsExecuted.length > 0) {
        const writeCodeTool = contextualResult.result.toolsExecuted.find(t => t.name === 'writeCode');
        if (writeCodeTool && writeCodeTool.result && writeCodeTool.result.code) {
            microserviceCode = writeCodeTool.result.code;
            logger.info('TestRunner', '\n🚀 === GENERATED RUST MICROSERVICE CODE === 🚀');
            console.log(microserviceCode);
            logger.info('TestRunner', '\n🚀 === END MICROSERVICE CODE === 🚀');
        }
    }
    
    // Verify contextual chaining
    assert.strictEqual(contextualResult.success, true, `Contextual chaining should succeed. Error: ${contextualResult.error}`);
    
    // Verify the final code references microservice concepts from pondering
    assert.ok(microserviceCode.includes('tokio') || microserviceCode.includes('async') || microserviceCode.includes('Result') || microserviceCode.includes('use '), 
        'Final code should reference Rust microservice concepts from ponder analysis');
    
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