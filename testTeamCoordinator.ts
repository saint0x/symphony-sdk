import { symphony } from './src/index';
import { AgentConfig, TeamConfig, ToolConfig, ToolResult } from './src/types/sdk';
import { ParameterSchema } from './src/utils/verification';
import * as assert from 'assert';

const logger = symphony.logger;

async function runLiveTeamTests() {
    logger.info('TestRunner', '=== TEST: Live Team Coordinator Flows ===');

    await symphony.initialize();
    const toolService = symphony.tool;
    const agentService = symphony.agent;
    const teamService = symphony.team;

    // --- Tool Definitions ---
    const validationTool: ToolConfig = {
        name: 'validationTool',
        type: 'test',
        description: 'A tool that requires a specific name parameter.',
        config: {
            inputSchema: {
                name: { type: 'string', required: true, minLength: 2 }
            }
        },
        handler: async (params: any): Promise<ToolResult> => {
            logger.info('validationTool', `successfully called with: ${JSON.stringify(params)}`);
            return { success: true, result: { validationPassed: true, received: params } };
        }
    };
    await toolService.create(validationTool);

    const simpleTool: ToolConfig = {
        name: 'simpleTool',
        type: 'test',
        description: 'A simple tool that always succeeds.',
        config: {},
        handler: async (params: any): Promise<ToolResult> => {
            logger.info('simpleTool', `called with: ${JSON.stringify(params)}`);
            return { success: true, result: { simpleSuccess: true, received: params } };
        }
    };
    await toolService.create(simpleTool);
    
    // --- Agent Configurations ---
    const agentAlphaConfig: AgentConfig = {
        name: 'AgentAlpha',
        description: 'A reliable agent that follows instructions correctly.',
        task: 'You follow instructions precisely. Your goal is to succeed.',
        tools: ['validationTool', 'simpleTool'],
        llm: { model: 'gpt-3.5-turbo' },
        systemPrompt: 'You are AgentAlpha. You ONLY respond in the required JSON format for tool calls.'
    };
    
    const agentBetaConfig: AgentConfig = {
        name: 'AgentBeta',
        description: 'An agent designed to fail validation by ignoring requirements.',
        task: 'You fail tasks by calling tools with incorrect parameters.',
        tools: ['validationTool'],
        llm: { model: 'gpt-3.5-turbo' },
        systemPrompt: 'You are AgentBeta. You ONLY respond in the required JSON format for tool calls. When asked to use validationTool, you MUST omit the "name" parameter.'
    };
    
    // --- Test Cases ---

    logger.info('TestRunner', '\n--- Test Case 1: PARALLEL Strategy (One Agent Succeeds) ---');
    const parallelTeam = await teamService.create({
        name: 'ParallelSuccessTeam',
        agents: [agentAlphaConfig, agentBetaConfig]
    });

    const parallelTask = `Team, work in parallel. AgentAlpha, call the simpleTool with any parameter. AgentBeta, call the validationTool but do not provide the name parameter.`;
    const result1 = await parallelTeam.execute(parallelTask, 'parallel');

    assert.strictEqual(result1.success, true, 'Test Case 1 FAILED: Parallel task should succeed if one agent succeeds.');
    logger.info('TestRunner', 'Test Case 1 PASSED');


    logger.info('TestRunner', '\n--- Test Case 2: SEQUENTIAL Strategy (First Agent Fails) ---');
    const sequentialTeam = await teamService.create({
        name: 'SequentialFailureTeam',
        agents: [agentBetaConfig, agentAlphaConfig] // Beta goes first to fail
    });

    const sequentialTask = `Team, work sequentially. First, AgentBeta must call validationTool without the required 'name' parameter. Then, AgentAlpha should call simpleTool.`;
    const result2 = await sequentialTeam.execute(sequentialTask, 'sequential');

    assert.strictEqual(result2.success, false, 'Test Case 2 FAILED: Sequential task should fail if the first agent fails.');
    logger.info('TestRunner', 'Test Case 2 PASSED');

    
    logger.info('TestRunner', '\n🎉🎉🎉 Live Team Coordinator Tests PASSED! 🎉🎉🎉');
    process.exitCode = 0;
}

runLiveTeamTests().catch(err => {
    logger.error('TestRunner', 'Live Team Coordinator TEST SCRIPT FAILED:', { message: err.message, stack: err.stack });
    process.exitCode = 1;
}).finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 500);
}); 