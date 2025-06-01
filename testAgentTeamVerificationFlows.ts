import { TeamCoordinator, TeamExecutionStrategy, TeamConfig } from './src/teams/coordinator';
import { AgentExecutor } from './src/agents/executor';
import { ToolRegistry } from './src/tools/standard/registry';
import { ToolConfig, ToolResult, AgentConfig } from './src/types/tool.types'; // Assuming AgentConfig is also in tool.types or imported appropriately
import { ParameterSchema } from './src/utils/verification';
import { Logger } from './src/utils/logger';
import * as assert from 'assert';

// This is the object that will be returned by the mocked Logger.getInstance()
const testLoggerInstance = {
    info: (context: string, message: string, ...args: any[]) => console.log(`[TEST INFO][${context}] ${message}`, ...args.filter(a => a !==undefined)),
    warn: (context: string, message: string, ...args: any[]) => console.warn(`[TEST WARN][${context}] ${message}`, ...args.filter(a => a !==undefined)),
    error: (context: string, message: string, ...args: any[]) => console.error(`[TEST ERROR][${context}] ${message}`, ...args.filter(a => a !==undefined)),
    debug: (context: string, message: string, ...args: any[]) => { console.log(`[TEST DEBUG][${context}] ${message}`, ...args.filter(a => a !==undefined)); }, // Enabled debug
};

// Mock Logger.getInstance directly if it's a static method
if (typeof Logger.getInstance === 'function' && !(Logger as any).__isMockedForAgentTeamTest) {
    (Logger as any).getInstance = (_context?: string) => testLoggerInstance as any;
    (Logger as any).__isMockedForAgentTeamTest = true; 
    console.log('[TEST_SETUP] Logger.getInstance has been mocked for agent/team tests.');
}


async function runAgentTeamVerificationTests() {
    testLoggerInstance.info('TestSetup', '=== TEST: Agent & Team Flow with ToolUsageVerifier Integration ===');

    const toolRegistry = ToolRegistry.getInstance(); // Using singleton, now gets testLoggerInstance

    // --- Tool Definitions --- 
    const toolWithSchemaDefinition: { [key: string]: ParameterSchema } = {
        name: { type: 'string', required: true, minLength: 2 },
        count: { type: 'number', required: false }
    };

    const toolWithSchema: ToolConfig = {
        name: 'toolWithSchema',
        type: 'testSchema',
        description: 'A tool that requires specific inputs',
        inputSchema: toolWithSchemaDefinition,
        handler: async (params: any) => {
            testLoggerInstance.info('toolWithSchema', `successfully called with: ${JSON.stringify(params)}`);
            return { success: true, result: { processed: true, received: params } };
        }
    };
    // Ensure tool is registered (handle re-registration if tests run in same process)
    if (!toolRegistry.getToolInfo(toolWithSchema.name)) {
        toolRegistry.registerTool(toolWithSchema.name, toolWithSchema);
    }

    const simpleTool: ToolConfig = {
        name: 'simpleTool',
        type: 'testSimple',
        description: 'A simple tool without input schema',
        handler: async (params: any) => {
            testLoggerInstance.info('simpleTool', `called with: ${JSON.stringify(params)}`);
            return { success: true, result: { simple: true, received: params } };
        }
    };
    if (!toolRegistry.getToolInfo(simpleTool.name)) {
        toolRegistry.registerTool(simpleTool.name, simpleTool);
    }

    // --- Agent Configurations --- 
    // Note: Actual LLM calls will be made by AgentExecutor if not architected for easy mocking here.
    // For these tests, we rely on specific task prompts to guide the agent.
    const validatorAgentConfig: AgentConfig = {
        name: 'ValidatorAgent',
        description: 'An agent that uses tools with schemas.',
        task: 'Perform tasks using toolWithSchema and simpleTool as instructed.',
        tools: [toolWithSchema.name, simpleTool.name],
        llm: { model: 'gpt-3.5-turbo' }, // Using a real (fast/cheap) model for integration test
        systemPrompt: 'You are a helpful assistant. When asked to call a tool, respond ONLY with the JSON tool call format. Example: {"tool_name": "toolName", "parameters": {"param":"value"}}'
    };

    const anotherAgentConfig: AgentConfig = {
        name: 'AnotherAgent',
        description: 'Another agent.',
        task: 'Assist with tasks.',
        tools: [simpleTool.name, toolWithSchema.name],
        llm: { model: 'gpt-3.5-turbo' },
        systemPrompt: 'You are an assistant. Respond ONLY with JSON tool calls when appropriate. Example: {"tool_name": "toolName", "parameters": {"param":"value"}}'
    };

    // --- Test Cases --- 

    testLoggerInstance.info('TestFlow', '\n--- Test Case A: TeamTaskPayload Validation (by TeamCoordinator) ---');
    const teamConfigA: TeamConfig = { name: 'PayloadTestTeam', agents: [validatorAgentConfig] };
    const coordinatorA = new TeamCoordinator(teamConfigA, toolRegistry);
    await coordinatorA.initialize();
    const invalidTeamPayload: any = { id: 'taskA1' /* title is missing */ };
    const resultA = await coordinatorA.executeTask(invalidTeamPayload);
    assert.strictEqual(resultA.success, false, 'Test A FAILED: Task should fail due to invalid team payload');
    assert.ok(resultA.error?.includes('Invalid task payload'), 'Test A FAILED: Error message should indicate payload validation failure');
    assert.ok(resultA.error?.includes('Parameter is required'), 'Test A FAILED: Error should mention Parameter is required for title');
    testLoggerInstance.info('TestFlow', 'Test Case A PASSED');

    // For Test Cases B and C, making agents predictably call tools with specific valid/invalid params
    // without mocking AgentExecutor.executeTask or the LLM response is the main challenge.
    // The tasks below are crafted to be VERY direct. If these prove flaky due to LLM variability,
    // this part of the test would need a mechanism to inject mock LLM responses for AgentExecutor
    // or a test-specific mode in AgentExecutor to directly trigger tool calls.

    testLoggerInstance.info('TestFlow', '\n--- Test Case B1: Tool Input Validation via Agent (INVALID params) ---');
    const teamConfigB1: TeamConfig = { name: 'AgentToolInvalidTeam', agents: [validatorAgentConfig] };
    const coordinatorB1 = new TeamCoordinator(teamConfigB1, toolRegistry);
    await coordinatorB1.initialize();
    // This task instructs the agent to make a call that will fail schema validation in ToolRegistry
    const taskForAgentInvalidCall = `Please call ${toolWithSchema.name} with only the count parameter set to 7. Do not include the name parameter.`;
    // Using ROLE_BASED for simplicity to target the single agent
    const resultB1 = await coordinatorB1.executeTask(taskForAgentInvalidCall, { strategy: TeamExecutionStrategy.ROLE_BASED }); 
    assert.strictEqual(resultB1.success, false, 'Test B1 FAILED: Team task should fail due to agent failing tool call validation');
    // Check agent's error propagated. The exact error message from ToolRegistry might be nested.
    // We expect the agent's attempt to use the tool to be the point of failure.
    // The error might be in resultB1.result.executionDetails.result.error or similar, depending on TeamCoordinator structure.
    assert.ok(JSON.stringify(resultB1).includes('Input validation failed for toolWithSchema'), 'Test B1 FAILED: Expected input validation error for toolWithSchema not found in results');
    assert.ok(JSON.stringify(resultB1).includes('name: Parameter is required'), 'Test B1 FAILED: Specific error for missing name not found in results');
    testLoggerInstance.info('TestFlow', 'Test Case B1 PASSED (assuming LLM guided agent to make the invalid call)');

    testLoggerInstance.info('TestFlow', '\n--- Test Case B2: Tool Input Validation via Agent (VALID params) ---');
    const teamConfigB2: TeamConfig = { name: 'AgentToolValidTeam', agents: [validatorAgentConfig] };
    const coordinatorB2 = new TeamCoordinator(teamConfigB2, toolRegistry);
    await coordinatorB2.initialize();
    const taskForAgentValidCall = `Call ${toolWithSchema.name} with name parameter 'ValidName' and count parameter 11.`;
    const resultB2 = await coordinatorB2.executeTask(taskForAgentValidCall, { strategy: TeamExecutionStrategy.ROLE_BASED });
    assert.strictEqual(resultB2.success, true, 'Test B2 FAILED: Team task should succeed with valid agent tool call');
    // Check that the toolWithSchema was indeed called successfully within the agent's execution if possible to inspect.
    // This might involve looking into resultB2.result.executionDetails.result (or similar path)
    assert.ok(JSON.stringify(resultB2).includes('processed":true'), 'Test B2 FAILED: toolWithSchema success indicator not found.');
    assert.ok(JSON.stringify(resultB2).includes('ValidName'), 'Test B2 FAILED: ValidName not found in successful result.');
    testLoggerInstance.info('TestFlow', 'Test Case B2 PASSED (assuming LLM guided agent to make the valid call)');


    testLoggerInstance.info('TestFlow', '\n--- Test Case C: verifyTeamTaskOverallSuccess (Parallel: 1 Agent Valid, 1 Agent Invalid Tool Call) ---');
    const teamConfigC: TeamConfig = { 
        name: 'ParallelVerifyTeam', 
        agents: [
            { ...validatorAgentConfig, name: 'AgentAlpha' }, 
            { ...anotherAgentConfig, name: 'AgentBeta' }
        ] 
    };
    const coordinatorC = new TeamCoordinator(teamConfigC, toolRegistry);
    await coordinatorC.initialize();

    // AgentAlpha will be tasked to make a valid call, AgentBeta an invalid one.
    // This requires TeamCoordinator to distribute distinct sub-tasks or for the main task to be interpreted by each agent.
    // For simplicity, let's assume a single task that leads to different behaviors or the coordinator assigns parts.
    // A more robust test might involve mocking agent responses if direct tasking is too flaky.
    // Here, we craft a task that implies multiple actions, hoping the parallel agents pick parts or try the schema tool differently.
    const complexTaskForParallel = `Team, please process data using '${toolWithSchema.name}'. AgentAlpha use name 'AlphaSuccess' and count 1. AgentBeta use only count 2 for '${toolWithSchema.name}'.`;
    
    const resultC = await coordinatorC.executeTask(complexTaskForParallel, { strategy: TeamExecutionStrategy.PARALLEL });

    assert.strictEqual(resultC.success, true, 'Test C FAILED: Overall parallel task should succeed as one agent (Alpha) made a valid call');
    const detailsC = resultC.result?.executionDetails;
    assert.ok(detailsC, 'Test C FAILED: Execution details missing');
    assert.strictEqual(detailsC.participatingAgents?.length, 2, 'Test C FAILED: Should have 2 participating agents');
    
    let alphaSucceeded = false;
    let betaFailedAsExpected = false;

    detailsC.individualResults.forEach((res: any) => {
        if (res.agent === 'AgentAlpha') {
            // AgentAlpha's result (res.result) should show success from toolWithSchema
            if (res.result?.success && JSON.stringify(res.result).includes('AlphaSuccess')) {
                alphaSucceeded = true;
            }
        }
        if (res.agent === 'AgentBeta') {
            // AgentBeta's result (res.result) should show failure from toolWithSchema validation
            if (res.result?.success === false && JSON.stringify(res.result).includes('Input validation failed for toolWithSchema')) {
                betaFailedAsExpected = true;
            }
        }
    });

    assert.ok(alphaSucceeded, 'Test C FAILED: AgentAlpha did not succeed with its valid tool call as expected.');
    assert.ok(betaFailedAsExpected, 'Test C FAILED: AgentBeta did not fail due to input validation as expected.');
    testLoggerInstance.info('TestFlow', 'Test Case C PASSED (assuming LLMs guided agents appropriately)');


    testLoggerInstance.info('TestFlow', '\n🎉🎉🎉 Agent & Team Flow Verification Tests PASSED (with caveats on LLM determinism) 🎉🎉🎉');
    process.exitCode = 0;
}

runAgentTeamVerificationTests().catch(err => {
    testLoggerInstance.error('Agent & Team Flow TEST SCRIPT FAILED:', err.message, err.stack);
    process.exitCode = 1;
}).finally(() => {
    if (process.exitCode === 0) {
        setTimeout(() => process.exit(0), 1000); // Longer timeout for potential async logs
    } else {
        setTimeout(() => process.exit(process.exitCode || 1), 1000);
    }
}); 