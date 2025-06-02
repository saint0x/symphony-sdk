// testStrictJsonToolAgent.ts
import { AgentExecutor } from './src/agents/executor';
import { AgentConfig, LogLevel, ToolResult } from './src/types/sdk';
import { Logger } from './src/utils/logger';
import { ToolRegistry } from './src/tools/standard/registry';

// Ensure OPENAI_API_KEY is set in your environment

async function runStrictJsonToolAgentTest() {
    const testLogger = Logger.getInstance('StrictJsonToolAgentTest');
    testLogger.setMinLevel(LogLevel.INFO); // Or LogLevel.DEBUG for more verbose SDK logs

    testLogger.info('-------------------------------------------------------------');
    testLogger.info('Starting Symphony SDK Strict JSON Tool Agent Test');
    testLogger.info('-------------------------------------------------------------');
    testLogger.info('This test will verify if an agent with a tool, using JSON mode,');
    testLogger.info('correctly interacts with the LLM using the stricter JSON format.');
    testLogger.info('Ensure your OPENAI_API_KEY environment variable is set.');

    const mockToolName = 'simpleTaskTool';

    // 1. Define Agent Configuration
    const agentConfig: AgentConfig = {
        name: 'ToolAgentJsonTest',
        role: 'Task Performer with Tools',
        goal: 'To perform a simple task, potentially using a provided tool, and respond in the specified JSON format.',
        llm: {
            provider: 'openai',
            model: 'gpt-3.5-turbo', // Or your preferred model
            useFunctionCalling: true, // Enables JSON mode logic in AgentExecutor
            temperature: 0.1, // Low temperature for predictability
        },
        tools: [mockToolName], // Configure the agent with the mock tool
        maxLoops: 1,
        // The system prompt is now heavily augmented by AgentExecutor for JSON mode,
        // but we can still provide a base.
        systemPrompt: "You are an assistant that can use tools. Follow the SDK's JSON response format requirements precisely.",
    };

    testLogger.info('Agent Configuration:', JSON.stringify(agentConfig, null, 2));

    // 2. Create AgentExecutor
    const executor = new AgentExecutor(agentConfig);
    testLogger.info('AgentExecutor instance created.');

    // 3. Mock the tool execution for this test
    // Get the actual registry instance used by the executor
    const agentRegistry = (executor as any).registry as ToolRegistry; 
    
    // Store the original method
    const originalExecuteTool = agentRegistry.executeTool.bind(agentRegistry);

    agentRegistry.executeTool = async (toolName: string, parameters: any): Promise<ToolResult> => {
        testLogger.info(`[MOCK TOOL] Attempting to execute tool: ${toolName}`);
        if (toolName === mockToolName) {
            testLogger.info(`[MOCK TOOL ${mockToolName}] Executing with parameters:`, parameters);
            // Simulate a successful tool execution
            return {
                success: true,
                result: {
                    message: `Mock tool '${mockToolName}' successfully processed task.`,
                    inputParams: parameters,
                },
                error: null,
            };
        }
        // If it's not our mock tool, call the original (though for this test, it shouldn't happen)
        testLogger.warn(`[MOCK TOOL] Call to unexpected tool: ${toolName}. Falling back to original.`);
        return originalExecuteTool(toolName, parameters);
    };
    // Ensure the mock tool is "known" to the registry for prompt generation purposes, if necessary.
    // The SystemPromptService might look up tool descriptions.
    if (!agentRegistry.getToolInfo(mockToolName)) {
        agentRegistry.registerTool(
            mockToolName,
            {
                name: mockToolName,
                description: "A simple mock tool that performs a basic task based on input parameters like 'action' and 'details'.",
                type: "mock",
                inputSchema: {
                    type: "object",
                    properties: {
                        action: { type: "string", description: "The action to perform." },
                        details: { type: "string", description: "Details for the action." }
                    },
                    required: ["action"]
                },
                handler: async (params: any) => {
                    testLogger.info(`[MOCK TOOL REGISTRY HANDLER ${mockToolName}] Executing with parameters:`, params);
                    return { 
                        success: true, 
                        result: `Actual registry handler for ${mockToolName} with ${JSON.stringify(params)}` 
                    };
                },
                config: {}
            }
        );
        testLogger.info(`[MOCK TOOL] Registered mock tool info for '${mockToolName}' for prompt generation.`);
    }


    testLogger.info('Mocked executeTool method on the agent\'s ToolRegistry instance.');

    // 4. Define Task
    const taskDescription = "Use the simpleTaskTool to perform the action 'greet' with details 'world'. If you cannot use the tool, explain why.";
    testLogger.info(`Executing task: "${taskDescription}"`);

    let taskResult;
    try {
        // 5. Execute Task
        taskResult = await executor.executeTask(taskDescription);

        testLogger.info('Task execution completed by AgentExecutor.');
        console.log('\n📋 --- Full Task Result --- 📋');
        console.log(JSON.stringify(taskResult, null, 2));

        if (taskResult.success) {
            testLogger.info('Task reported success. Verifying tool interaction or explicit no-tool response.');
            
            const reasoning = taskResult.result.reasoning || "";
            const llmResponse = taskResult.result.response; // This would be the final response string.

            if (reasoning.includes(`Processed 1 tool actions. First tool: ${mockToolName}`) || llmResponse.includes(`Tool ${mockToolName} executed. Success: true`)) {
                console.log('\n✅ --- TEST PASSED (Tool Executed) --- ✅');
                testLogger.info('The LLM correctly requested the tool, and the mock tool execution was reflected in the result.');
            } else if (llmResponse) {
                try {
                    const parsedLLMJson = JSON.parse(llmResponse); // This assumes direct LLM response is JSON.
                    if ((parsedLLMJson.tool_name === 'none' || parsedLLMJson.toolName === 'none') && parsedLLMJson.response) {
                         console.log('\n✅ --- TEST PASSED (No Tool Indicated by LLM) --- ✅');
                         testLogger.info('The LLM explicitly stated no tool was needed and provided a direct response in the correct JSON format.');
                         testLogger.info('LLM direct response:', parsedLLMJson.response);
                    } else {
                        console.log('\n⚠️ --- TEST POTENTIALLY INCONCLUSIVE or FAILED (Unexpected JSON Structure) --- ⚠️');
                        testLogger.warn('Task succeeded, but tool was not clearly executed, nor did the LLM explicitly state "no tool" in the expected JSON format.', { llmResponse });
                    }
                } catch (e) {
                     console.log('\n⚠️ --- TEST POTENTIALLY INCONCLUSIVE or FAILED (Non-JSON LLM Response) --- ⚠️');
                     testLogger.warn('Task succeeded, but the final response was not the expected JSON for a "no tool" scenario, nor was the tool executed.', { llmResponse });
                }
            } else {
                console.log('\n⚠️ --- TEST INCONCLUSIVE (No Clear Tool Execution or No-Tool Indication) --- ⚠️');
                testLogger.warn('Task succeeded, but reasoning or response did not clearly indicate tool execution or an explicit no-tool decision.');
            }
        } else {
            console.error('\n❌ --- TEST FAILED (Task Reported Failure) --- ❌');
            testLogger.error('Task execution was reported as unsuccessful.', { error: taskResult.error, response: taskResult.result.response });
        }

    } catch (error) {
        testLogger.error('An unexpected critical error occurred during task execution.', {
            errorMessage: (error instanceof Error) ? error.message : String(error),
            stack: (error instanceof Error) ? (error as Error).stack : undefined
        });
        console.error('\n❌ --- TEST FAILED (CRITICAL ERROR) --- ❌');
    } finally {
        // Restore original executeTool method
        agentRegistry.executeTool = originalExecuteTool;
        testLogger.info('Restored original executeTool method.');
        
        testLogger.info('-------------------------------------------------------------');
        testLogger.info('Strict JSON Tool Agent Test Finished');
        testLogger.info('-------------------------------------------------------------');
    }
}

runStrictJsonToolAgentTest().catch(criticalError => {
    console.error("\n💥 --- UNHANDLED CRITICAL ERROR IN TEST SCRIPT --- 💥");
    console.error((criticalError instanceof Error) ? criticalError.message : String(criticalError));
    if (criticalError instanceof Error && criticalError.stack) {
        console.error(criticalError.stack);
    }
}); 