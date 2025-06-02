// testCustomModerationAgent.ts
import { AgentExecutor } from './src/agents/executor';
import { AgentConfig, LogLevel, ToolResult, ToolConfig } from './src/types/sdk';
import { Logger } from './src/utils/logger';
import { ToolRegistry } from './src/tools/standard/registry';

// Ensure OPENAI_API_KEY is set in your environment

const sentimentToolName = 'sentimentAnalysisTool';
const keywordToolName = 'keywordDetectionTool';
const moderationActionToolName = 'takeModerationActionTool';

async function runCustomModerationAgentTest() {
    const testLogger = Logger.getInstance('CustomModerationAgentTest');
    testLogger.setMinLevel(LogLevel.DEBUG);

    testLogger.info('TestInit', '-----------------------------------------------------------------');
    testLogger.info('TestInit', 'Starting Symphony SDK Custom Moderation Agent Test');
    testLogger.info('TestInit', '-----------------------------------------------------------------');
    testLogger.info('TestInit', 'This test will verify a custom agent with multiple realistic tools');
    testLogger.info('TestInit', 'using JSON mode and stricter JSON I/O formats.');
    testLogger.info('TestInit', 'Ensure your OPENAI_API_KEY environment variable is set.');

    // 1. Define Agent Configuration
    const agentConfig: AgentConfig = {
        name: 'ContentModerationAgent',
        description: 'An AI agent that analyzes user-generated text for sentiment and keywords, then decides and applies a moderation action using available tools, responding in the required JSON format.',
        task: "Analyze user-generated text, identify issues based on sentiment and keywords, and decide on an appropriate moderation action.",
        llm: {
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            useFunctionCalling: true, 
            temperature: 0.1, 
        },
        tools: [sentimentToolName, keywordToolName, moderationActionToolName],
        maxCalls: 3, // Allow for a few steps if LLM decides to chain tool calls
        systemPrompt: "You are an AI Content Moderator. You must use the provided tools to analyze text and take moderation actions. Follow the SDK's JSON response format requirements precisely for all tool calls or when no tool is needed. When calling a tool, the 'tool_name' in your JSON response MUST EXACTLY MATCH one of the tool names listed: 'sentimentAnalysisTool', 'keywordDetectionTool', 'takeModerationActionTool'.",
    };

    testLogger.info('AgentSetup', 'Agent Configuration:', agentConfig);

    const executor = new AgentExecutor(agentConfig);
    testLogger.info('AgentSetup', 'AgentExecutor instance created.');

    const agentRegistry = (executor as any).registry as ToolRegistry;
    const originalExecuteTool = agentRegistry.executeTool.bind(agentRegistry);

    agentRegistry.executeTool = async (toolName: string, parameters: any): Promise<ToolResult> => {
        testLogger.info('[MOCK DISPATCHER]', `executeTool called for: ${toolName}`, parameters);
        switch (toolName) {
            case sentimentToolName:
                testLogger.info(`[MOCK ${sentimentToolName}]`, 'Executing with:', parameters);
                return {
                    success: true,
                    result: { sentiment: (parameters.text.includes("garbage") ? "negative" : "neutral"), score: (parameters.text.includes("garbage") ? 0.95 : 0.5) },
                    error: undefined,
                };
            case keywordToolName:
                testLogger.info(`[MOCK ${keywordToolName}]`, 'Executing with:', parameters);
                const textToScan = parameters.text.toLowerCase();
                const keywordsToFind = parameters.keyword_list.map((k:string) => k.toLowerCase());
                const detected = keywordsToFind.filter((kw:string) => textToScan.includes(kw));
                return {
                    success: true,
                    result: { detected_keywords: detected, match_count: detected.length },
                    error: undefined,
                };
            case moderationActionToolName:
                testLogger.info(`[MOCK ${moderationActionToolName}]`, 'Executing with:', parameters);
                return {
                    success: true,
                    result: { action_taken: parameters.action_type, status: "success", text_id: parameters.text_id, reason: parameters.reason },
                    error: undefined,
                };
            default:
                testLogger.warn('[MOCK DISPATCHER]', `Unexpected tool: ${toolName}. Falling back to original if exists, or failing.`);
                return originalExecuteTool(toolName, parameters);
        }
    };

    // Register info for each custom tool so SystemPromptService can see them
    const customToolsInfo: ToolConfig[] = [
        {
            name: sentimentToolName,
            description: "Analyzes the sentiment of a given text (e.g., positive, negative, neutral) and provides a confidence score.",
            type: "analysis",
            config: { 
                inputSchema: { type: "object", properties: { text: { type: "string", description: "The text to analyze." } }, required: ["text"] }
            },
            handler: async () => ({ success: true, result: "Dummy handler for schema" }),
        },
        {
            name: keywordToolName,
            description: "Detects predefined problematic keywords in a text from a provided list.",
            type: "analysis",
            config: {
                 inputSchema: { type: "object", properties: { text: { type: "string", description: "The text to scan." }, keyword_list: { type: "array", items: {type: "string"}, description: "List of keywords to detect."}}, required: ["text", "keyword_list"] }
            },
            handler: async () => ({ success: true, result: "Dummy handler for schema" }),
        },
        {
            name: moderationActionToolName,
            description: "Takes a moderation action (e.g., 'flag_content', 'warn_user', 'no_action_needed') on a piece of content, identified by its ID, based on analysis and a provided reason.",
            type: "action",
            config: {
                inputSchema: { type: "object", properties: { text_id: { type: "string", description: "The unique identifier of the text content."}, action_type: { type: "string", enum: ["flag_content", "warn_user", "no_action_needed"], description: "The moderation action to take."}, reason: {type: "string", description: "The reason for taking this action."}}, required: ["text_id", "action_type", "reason"] }
            },
            handler: async () => ({ success: true, result: "Dummy handler for schema" }),
        }
    ];

    customToolsInfo.forEach(toolInfo => {
        if (!agentRegistry.getToolInfo(toolInfo.name)) {
            // ToolConfig itself is the correct type for toolToRegister
            agentRegistry.registerTool(toolInfo.name, toolInfo); 
            testLogger.info('[MOCK SETUP]', `Registered mock tool info for '${toolInfo.name}'.`, toolInfo);
        }
    });
    testLogger.info('AgentSetup', 'Mocked tool execution and registered custom tool schemas.');

    const taskDescription = "Analyze the user comment (ID: 'comment-abc-123'): 'This is an utterly despicable piece of garbage, and anyone who likes it is an idiot. It also mentions a forbidden word: foobar.' First, determine the sentiment of the comment. Second, check for the presence of the banned keywords: ['idiot', 'garbage', 'despicable', 'foobar']. Finally, based on these findings, decide on a moderation action (either 'flag_content', 'warn_user', or 'no_action_needed') for 'comment-abc-123' and provide a brief reason.";
    testLogger.info('TaskExecution', `Executing complex task: "${taskDescription}"`);

    let taskResult;
    try {
        taskResult = await executor.executeTask(taskDescription);

        testLogger.info('TaskExecution', 'Complex task execution completed by AgentExecutor.');
        console.log('\n📋 --- Full Task Result (Custom Moderation Agent) --- 📋');
        console.log(JSON.stringify(taskResult, null, 2));

        if (taskResult.success) {
            testLogger.info('TaskResult', 'Task reported success. Verifying tool interactions or explicit no-tool response.');
            const toolsCalled = taskResult.result.toolsExecuted || [];
            const llmFinalResponse = taskResult.result.response;

            if (toolsCalled.length > 0) {
                console.log(`\n✅ --- TEST PASSED (Tools Executed: ${toolsCalled.length}) --- ✅`);
                testLogger.info('TaskResult', 'The LLM correctly requested one or more tools.');
                toolsCalled.forEach(tool => {
                    testLogger.info('TaskResult', `  - Tool: ${tool.name}, Success: ${tool.success}, Params: ${JSON.stringify(tool.result?.inputParams || tool.result || {})}`);
                });
                const moderationAction = toolsCalled.find(t => t.name === moderationActionToolName);
                if (moderationAction && moderationAction.success) {
                    testLogger.info('TaskResult', `>>> Moderation action '${moderationAction.result.action_taken}' for '${moderationAction.result.text_id}' was successfully simulated.`);
                } else {
                    testLogger.warn('TaskResult', '>>> Moderation action tool was expected but not found or failed among executed tools.');
                }
            } else if (llmFinalResponse) {
                try {
                    const parsedLLMJson = JSON.parse(llmFinalResponse);
                    if ((parsedLLMJson.tool_name === 'none' || parsedLLMJson.toolName === 'none') && parsedLLMJson.response) {
                         console.log('\n✅ --- TEST PASSED (No Tool Indicated by LLM) --- ✅');
                         testLogger.info('TaskResult', 'The LLM explicitly stated no tool was needed and provided a direct response in the correct JSON format.');
                         testLogger.info('TaskResult', 'LLM direct response:', { response: parsedLLMJson.response }); // Ensure data is an object
                    } else {
                        console.log('\n⚠️ --- TEST POTENTIALLY INCONCLUSIVE or FAILED (Unexpected JSON Structure from LLM) --- ⚠️');
                        testLogger.warn('TaskResult', 'Task succeeded, but no tools were called, and the LLM did not explicitly state "no tool" in the expected JSON format.', { llmFinalResponse });
                    }
                } catch (e) {
                     console.log('\n⚠️ --- TEST POTENTIALLY INCONCLUSIVE or FAILED (Non-JSON LLM Final Response) --- ⚠️');
                     testLogger.warn('TaskResult', 'Task succeeded, but no tools were called, and the final response was not the expected JSON for a "no tool" scenario.', { llmFinalResponse });
                }
            } else {
                console.log('\n⚠️ --- TEST INCONCLUSIVE (No Tool Execution and No Clear LLM Final Response) --- ⚠️');
                testLogger.warn('TaskResult', 'Task succeeded, but no tools were executed, and no clear final LLM response was available to parse.');
            }
        } else {
            console.error('\n❌ --- TEST FAILED (Task Reported Failure) --- ❌');
            testLogger.error('TaskResult', 'Task execution was reported as unsuccessful.', { error: String(taskResult.error), response: String(taskResult.result.response) }); // Ensure data is Record<string, any>
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

        testLogger.info('TestCleanup', '-----------------------------------------------------------------');
        testLogger.info('TestCleanup', 'Custom Moderation Agent Test Finished');
        testLogger.info('TestCleanup', '-----------------------------------------------------------------');
    }
}

runCustomModerationAgentTest().catch(criticalError => {
    console.error("\n💥 --- UNHANDLED CRITICAL ERROR IN TEST SCRIPT --- 💥");
    console.error((criticalError instanceof Error) ? criticalError.message : String(criticalError));
    if (criticalError instanceof Error && criticalError.stack) {
        console.error(criticalError.stack);
    }
}); 