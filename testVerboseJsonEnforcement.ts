// testVerboseJsonEnforcement.ts
import { AgentExecutor } from './src/agents/executor';
import { AgentConfig, LogLevel, ToolResult, ToolConfig } from './src/types/sdk';
import { Logger } from './src/utils/logger';
import { ToolRegistry } from './src/tools/standard/registry';

// Ensure OPENAI_API_KEY is set in your environment

const mockToolName = 'simpleActionTool';

async function runVerboseJsonEnforcementTest() {
    const testLogger = Logger.getInstance('VerboseJsonEnforcementTest');
    testLogger.setMinLevel(LogLevel.DEBUG); // DEBUG to see the full prompt sent to LLM

    testLogger.info('TestInit', '---------------------------------------------------------------------');
    testLogger.info('TestInit', 'Starting Symphony SDK Verbose JSON Enforcement Test');
    testLogger.info('TestInit', '---------------------------------------------------------------------');
    testLogger.info('TestInit', 'This test verifies if the SDKs auto-appended verbose JSON instructions');
    testLogger.info('TestInit', 'ensure correct JSON I/O even with a minimal agent system prompt.');
    testLogger.info('TestInit', 'Ensure your OPENAI_API_KEY environment variable is set.');

    // 1. Define Agent Configuration with a VERY MINIMAL system prompt
    const agentConfig: AgentConfig = {
        name: 'MinimalPromptAgent',
        description: 'An agent with a very basic system prompt to test SDK JSON enforcement.',
        task: "Default task for minimal agent.", // Task will be overridden by executeTask input
        llm: {
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            temperature: 0.0, // Minimum temperature for determinism
        },
        tools: [mockToolName],
        maxCalls: 1,
        systemPrompt: "You are a helpful assistant.", // INTENTIONALLY MINIMAL
    };

    testLogger.info('AgentSetup', 'Agent Configuration:', agentConfig);

    // 2. Create AgentExecutor
    const executor = new AgentExecutor(agentConfig);
    testLogger.info('AgentSetup', 'AgentExecutor instance created.');

    // 3. Mock Tool Implementation & Registration
    const agentRegistry = (executor as any).registry as ToolRegistry;
    const originalExecuteTool = agentRegistry.executeTool.bind(agentRegistry);

    agentRegistry.executeTool = async (toolName: string, parameters: any): Promise<ToolResult> => {
        testLogger.info('[MOCK TOOL DISPATCHER]', `executeTool called for: ${toolName}`, parameters);
        if (toolName === mockToolName) {
            testLogger.info(`[MOCK ${mockToolName}]`, 'Executing with:', parameters);
            return {
                success: true,
                result: { status: "Action completed successfully", details: parameters },
                error: undefined,
            };
        }
        testLogger.warn('[MOCK TOOL DISPATCHER]', `Unexpected tool: ${toolName}. Falling back.`);
        return originalExecuteTool(toolName, parameters);
    };

    const mockToolInfo: ToolConfig = {
        name: mockToolName,
        description: "Performs a simple, well-defined action based on provided data.",
        type: "action",
        config: {
            inputSchema: { 
                type: "object", 
                properties: { 
                    action_name: { type: "string", description: "The specific action to perform." },
                    data: { type: "object", description: "Data payload for the action." }
                }, 
                required: ["action_name", "data"] 
            }
        },
        handler: async () => ({ success: true, result: "Dummy handler for schema" }),
    };

    if (!agentRegistry.getToolInfo(mockToolInfo.name)) {
        agentRegistry.registerTool(mockToolInfo.name, mockToolInfo);
        testLogger.info('[MOCK SETUP]', `Registered mock tool info for '${mockToolInfo.name}'.`, mockToolInfo);
    }
    testLogger.info('AgentSetup', 'Mocked tool execution and registered custom tool schema.');

    // 4. Define Task
    const taskDescription = `Use the '${mockToolName}' to perform the action 'log_event' with data {{ message: "System test event" }}.`;
    testLogger.info('TaskExecution', `Executing task: "${taskDescription}"`);

    let taskResult;
    try {
        // 5. Execute Task
        taskResult = await executor.executeTask(taskDescription);

        testLogger.info('TaskExecution', 'Task execution completed.');
        console.log('\n📋 --- Full Task Result (Verbose JSON Enforcement Test) --- 📋');
        console.log(JSON.stringify(taskResult, null, 2));

        if (taskResult.success && taskResult.result.toolsExecuted && taskResult.result.toolsExecuted.length > 0) {
            const toolCall = taskResult.result.toolsExecuted[0];
            if (toolCall.name === mockToolName && toolCall.success) {
                console.log('\n✅ --- TEST PASSED (Tool Executed Correctly) --- ✅');
                testLogger.info('TestResult', 'LLM correctly called the tool with the enforced JSON structure.', toolCall.result);
            } else {
                console.log('\n❌ --- TEST FAILED (Tool call issue) --- ❌');
                testLogger.error('TestResult', 'Tool was called but name mismatched or failed.', taskResult.result.toolsExecuted);
            }
        } else if (taskResult.success && taskResult.result.response) {
             try {
                const parsedResponse = JSON.parse(taskResult.result.response);
                if ((parsedResponse.tool_name === 'none' || parsedResponse.toolName === 'none') && parsedResponse.response) {
                    console.log('\n⚠️ --- TEST INCONCLUSIVE (LLM Chose No Tool) --- ⚠️');
                    testLogger.warn('TestResult', 'LLM decided no tool was needed, despite the task. This is valid by the JSON spec, but unexpected for this task.', parsedResponse);
                } else {
                    console.log('\n❌ --- TEST FAILED (Unexpected JSON response) --- ❌');
                    testLogger.error('TestResult', "Task succeeded but no tool was called, and response was not a valid 'no tool' JSON.", parsedResponse);
                }
            } catch (e) {
                console.log('\n❌ --- TEST FAILED (Non-JSON response when no tool called) --- ❌');
                testLogger.error('TestResult', 'Task succeeded but no tool was called, and the response was not parseable JSON.', { response: taskResult.result.response, error: e });
            }
        } else {
            console.error('\n❌ --- TEST FAILED (Task Reported Failure or No Tool Execution) --- ❌');
            testLogger.error('TestResult', 'Task execution failed or no tools were executed as expected.', taskResult);
        }

    } catch (error) {
        testLogger.error('CriticalError', 'An unexpected critical error occurred during task execution.', {
            errorMessage: (error instanceof Error) ? error.message : String(error),
            stack: (error instanceof Error) ? (error as Error).stack : undefined,
        });
        console.error('\n❌ --- TEST FAILED (CRITICAL ERROR) --- ❌');
    } finally {
        agentRegistry.executeTool = originalExecuteTool;
        testLogger.info('TestCleanup', 'Restored original executeTool method on agentRegistry.');

        testLogger.info('TestCleanup', '---------------------------------------------------------------------');
        testLogger.info('TestCleanup', 'Verbose JSON Enforcement Test Finished');
        testLogger.info('TestCleanup', '---------------------------------------------------------------------');
    }
}

runVerboseJsonEnforcementTest().catch(criticalError => {
    console.error("\n💥 --- UNHANDLED CRITICAL ERROR IN TEST SCRIPT --- 💥");
    console.error((criticalError instanceof Error) ? criticalError.message : String(criticalError));
    if (criticalError instanceof Error && criticalError.stack) {
        console.error(criticalError.stack);
    }
}); 