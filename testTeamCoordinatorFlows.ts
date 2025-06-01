import { TeamCoordinator, TeamExecutionStrategy, TeamConfig, TeamMember } from './src/teams/coordinator';
import { AgentExecutor } from './src/agents/executor';
import { ToolRegistry } from './src/tools/standard/registry';
import { ToolResult, AgentConfig, ToolLifecycleState } from './src/types/sdk';
import { Logger } from './src/utils/logger';
import * as assert from 'assert';

// Mock Logger to prevent console noise and allow for spying if needed
const mockLoggerInstance = {
  info: (..._args: any[]) => { /* console.log('[TEST INFO]', ..._args) */ },
  warn: (..._args: any[]) => { /* console.log('[TEST WARN]', ..._args) */ },
  error: (..._args: any[]) => { /* console.log('[TEST ERROR]', ..._args) */ },
  debug: (..._args: any[]) => { /* console.log('[TEST DEBUG]', ..._args) */ },
};

jest.mock('./src/utils/logger', () => ({
  Logger: {
    getInstance: () => mockLoggerInstance,
  },
}));

// Store original AgentExecutor.prototype.executeTask
const originalExecuteTask = AgentExecutor.prototype.executeTask;

// Helper to create a basic ToolRegistry instance for tests
function createTestToolRegistry(): ToolRegistry {
  // Attempt to get an instance, assuming it might be a singleton or have a static factory
  // This part might need adjustment based on how ToolRegistry is designed to be instantiated/reset for tests
  let registry: ToolRegistry;
  try {
    // If ToolRegistry is a true singleton and holds state, testing can be tricky.
    // For robust tests, you might need a way to reset its state or use a fresh instance.
    // This example assumes ToolRegistry.getInstance() can be called multiple times
    // or that its state doesn't interfere badly between tests (not ideal).
    // A better approach would be to instantiate ToolRegistry directly if possible, or have a reset method.
    registry = new (ToolRegistry as any)(); // Casting to any to bypass private constructor if needed for test
                                          // This is a common workaround if no test-specific factory is provided.
  } catch (e) {
    // Fallback if direct instantiation isn't straightforward or constructor is private without workarounds
    console.warn("Could not create a fresh ToolRegistry; using potential singleton instance. This might affect test isolation.");
    registry = ToolRegistry.getInstance(); 
  }

  // Add dummy tools that agents might try to use.
  // These handlers won't be called if AgentExecutor.executeTask is fully mocked.
  const mockTools = [
    { name: 'mockSuccessTool', desc: 'Always succeeds', succeed: true, result: 'Mock success' },
    { name: 'mockFailureTool', desc: 'Always fails', succeed: false, error: 'Mock failure' },
    { name: 'mockManagerTool', desc: 'For manager agent', succeed: true, result: 'Manager analysis complete' }
  ];

  mockTools.forEach(toolInfo => {
    // A bit verbose to avoid errors if running tests multiple times in the same process
    // A proper test setup might clean the registry before each test run.
    try {
      if (!(registry as any).tools.has(toolInfo.name)) { // Accessing private 'tools' map for check - not ideal
        registry.register({
          name: toolInfo.name,
          description: toolInfo.desc,
          handler: async (_params: any) => ({ 
            success: toolInfo.succeed, 
            result: toolInfo.succeed ? toolInfo.result : undefined,
            error: !toolInfo.succeed ? toolInfo.error : undefined
          }),
        });
      }
    } catch (e) {
      // console.error(`Error registering mock tool ${toolInfo.name}:`, e) 
      // If ToolRegistry is a strict singleton and already configured, this might happen.
    }
  });
  return registry;
}


describe('TeamCoordinator Integrated Flows', () => {
  let toolRegistry: ToolRegistry;
  let mockExecuteTaskImplementation: jest.Mock;

  beforeEach(() => {
    toolRegistry = createTestToolRegistry();
    // Reset the mock implementation for each test
    mockExecuteTaskImplementation = jest.fn();
    AgentExecutor.prototype.executeTask = mockExecuteTaskImplementation;
  });

  afterEach(() => {
    // Restore original method after each test to ensure clean state
    AgentExecutor.prototype.executeTask = originalExecuteTask;
    jest.clearAllMocks();
  });

  const agentConfig1: AgentConfig = { name: 'Agent1', description: 'Test Agent 1', task: 'do things', tools: ['mockSuccessTool'], llm: 'mock-llm' };
  const agentConfig2: AgentConfig = { name: 'Agent2', description: 'Test Agent 2', task: 'do other things', tools: ['mockSuccessTool'], llm: 'mock-llm' };
  const agentConfigManager: AgentConfig = { name: 'ManagerAgent', description: 'Test Manager', task: 'manage', tools: ['mockManagerTool'], llm: 'mock-llm' };


  test('should FAIL task if TeamTaskPayload is invalid (verifyData integration)', async () => {
    const teamConfig: TeamConfig = { name: 'DataValidationTeam', agents: [agentConfig1] };
    const coordinator = new TeamCoordinator(teamConfig, toolRegistry);
    await coordinator.initialize();

    const invalidPayload: any = { id: 'task123' /* missing title */ };
    const result = await coordinator.executeTask(invalidPayload);

    assert.strictEqual(result.success, false, 'Task should fail due to invalid payload');
    assert.ok(result.error?.includes('Invalid task payload'), 'Error message should indicate payload validation failure');
    // The specific error message for title might depend on the exact output of verifyData
    assert.ok(result.error?.includes('title: Parameter is required') || result.error?.includes('title') , 'Error message should specify missing title');
  });

  test('PARALLEL strategy: should SUCCEED if at least one agent succeeds', async () => {
    const teamConfig: TeamConfig = { name: 'ParallelSuccessTeam', agents: [agentConfig1, agentConfig2] };
    const coordinator = new TeamCoordinator(teamConfig, toolRegistry);
    await coordinator.initialize();

    mockExecuteTaskImplementation.mockImplementation(async function(this: AgentExecutor, _task: string): Promise<ToolResult> {
      if (this.config.name === 'Agent1') {
        return { success: true, result: { response: 'Agent1 success' }, agent: 'Agent1' };
      }
      return { success: false, error: 'Agent2 failed', agent: 'Agent2' };
    });

    const taskPayload = { id: 'task-parallel-1', title: 'Execute in parallel, one success' };
    const result = await coordinator.executeTask(taskPayload, { strategy: TeamExecutionStrategy.PARALLEL });

    assert.strictEqual(result.success, true, 'Overall task should succeed');
    assert.ok(result.result?.executionDetails?.individualResults?.length === 2, 'Should have two individual results');
    const agent1Res = result.result?.executionDetails.individualResults.find((r:any) => r.agent === 'Agent1')?.result;
    const agent2Res = result.result?.executionDetails.individualResults.find((r:any) => r.agent === 'Agent2')?.result;
    
    assert.deepStrictEqual(agent1Res, { success: true, result: { response: 'Agent1 success' }, agent: 'Agent1' });
    assert.deepStrictEqual(agent2Res, { success: false, error: 'Agent2 failed', agent: 'Agent2' });
  });

  test('PARALLEL strategy: should FAIL if all agents fail', async () => {
    const teamConfig: TeamConfig = { name: 'ParallelFailTeam', agents: [agentConfig1, agentConfig2] };
    const coordinator = new TeamCoordinator(teamConfig, toolRegistry);
    await coordinator.initialize();

    mockExecuteTaskImplementation.mockImplementation(async function(this: AgentExecutor, _task: string): Promise<ToolResult> {
      return { success: false, error: `${this.config.name} failed`, agent: this.config.name };
    });

    const taskPayload = { id: 'task-parallel-fail', title: 'Execute in parallel, all fail' };
    const result = await coordinator.executeTask(taskPayload, { strategy: TeamExecutionStrategy.PARALLEL });

    assert.strictEqual(result.success, false, 'Overall task should fail');
    assert.ok(result.error?.includes('All 2 participating agents failed'), 'Reason should indicate all agents failed');
  });
  
  test('SEQUENTIAL strategy: should FAIL if an early agent fails', async () => {
    const teamConfig: TeamConfig = { name: 'SequentialFailTeam', agents: [agentConfig1, agentConfig2] };
    const coordinator = new TeamCoordinator(teamConfig, toolRegistry);
    await coordinator.initialize();

    mockExecuteTaskImplementation.mockImplementation(async function(this: AgentExecutor, _task: string): Promise<ToolResult> {
        if (this.config.name === 'Agent1') {
            return { success: false, error: 'Agent1 failed deliberately', agent: 'Agent1' };
        }
        // This agent (Agent2) should still be called based on TeamCoordinator's current sequential logic
        return { success: true, result: { response: 'Agent2 success' }, agent: 'Agent2' };
    });

    const taskPayload = { id: 'task-seq-fail', title: 'Execute sequentially, first fails' };
    const result = await coordinator.executeTask(taskPayload, { strategy: TeamExecutionStrategy.SEQUENTIAL });

    assert.strictEqual(result.success, false, 'Overall task should fail');
    assert.ok(result.error?.includes('agent(s) failed, breaking the sequential'), 'Reason should indicate sequential break');
    
    const individualResults = result.result?.executionDetails.individualResults;
    assert.strictEqual(individualResults?.length, 2, "Should attempt both agents based on current coordinator logic");
    assert.deepStrictEqual(individualResults?.[0]?.result, { success: false, error: 'Agent1 failed deliberately', agent: 'Agent1' });
    // Agent2 result is also captured, even though Agent1 failed.
    assert.deepStrictEqual(individualResults?.[1]?.result, { success: true, result: { response: 'Agent2 success' }, agent: 'Agent2' });
  });

  test('COLLABORATIVE strategy: manager succeeds, one delegate fails - overall SUCCESS (manager-driven)', async () => {
    const teamConfig: TeamConfig = { name: 'CollaborativeMixedTeam', agents: [agentConfigManager, agentConfig1, agentConfig2] };
    const coordinator = new TeamCoordinator(teamConfig, toolRegistry);
    await coordinator.initialize();

    mockExecuteTaskImplementation.mockImplementation(async function(this: AgentExecutor, _task: string): Promise<ToolResult> {
        if (this.config.name === 'ManagerAgent') {
            return { 
                success: true, 
                result: { response: 'Task analyzed. DELEGATIONS: {"delegations": [{"agent": "Agent1", "task": "Sub-task for Agent1"}]}}' 
            };
        }
        if (this.config.name === 'Agent1') { // Agent1 is delegated to
            return { success: false, error: 'Agent1 failed sub-task' };
        }
        // Agent2 is not called in this specific delegation scenario
        return { success: true, result: { response: `${this.config.name} was not directly involved` } };
    });

    const taskPayload = { id: 'task-collab-mixed', title: 'Collaborate, manager delegates, one delegate fails' };
    const result = await coordinator.executeTask(taskPayload, { strategy: TeamExecutionStrategy.COLLABORATIVE });
    
    assert.strictEqual(result.success, true, 'Overall task should succeed as manager was successful and initiated delegations.');
    assert.ok(result.result?.executionDetails?.managerAnalysis?.success === true, "Manager's initial analysis should be successful.");
    
    const contributions = result.result?.executionDetails.individualContributions;
    const managerContribution = contributions.find((c:any) => c.agent === 'ManagerAgent');
    const agent1Contribution = contributions.find((c:any) => c.agent === 'Agent1');

    assert.ok(managerContribution?.result?.success === true, "Manager contribution should show success.");
    assert.ok(agent1Contribution?.result?.success === false, "Agent1 (delegated) contribution should show failure.");
    assert.ok(result.result?.executionDetails.executionSummary.includes('1 manager delegations'), "Summary should reflect delegations");
  });

  test('COLLABORATIVE strategy: manager succeeds, NO delegations, overall SUCCESS', async () => {
    const teamConfig: TeamConfig = { name: 'CollaborativeManagerOnlyTeam', agents: [agentConfigManager] };
    const coordinator = new TeamCoordinator(teamConfig, toolRegistry);
    await coordinator.initialize();

    mockExecuteTaskImplementation.mockImplementation(async function(this: AgentExecutor, _task: string): Promise<ToolResult> {
        if (this.config.name === 'ManagerAgent') {
            return { 
                success: true, 
                result: { response: 'Task analyzed and completed by manager. No delegations needed.' } 
            };
        }
        return { success: false, error: 'Unexpected agent call' }; // Should only be manager
    });

    const taskPayload = { id: 'task-collab-manager-only', title: 'Collaborate, manager handles all' };
    const result = await coordinator.executeTask(taskPayload, { strategy: TeamExecutionStrategy.COLLABORATIVE });
    
    assert.strictEqual(result.success, true, 'Overall task should succeed as manager completed the work.');
    assert.ok(result.result?.executionDetails?.managerAnalysis?.success === true, "Manager's analysis should be successful.");
    assert.strictEqual(result.result?.executionDetails?.delegations?.length, 0, "Should be no delegations.");
    assert.ok(result.result?.executionDetails.executionSummary.includes('0 manager delegations'), "Summary should reflect no delegations");
  });

  // Add more tests for:
  // - SEQUENTIAL (all success)
  // - PIPELINE (success, failure)
  // - ROLE_BASED (success, failure, no suitable agent)
  // - COLLABORATIVE (manager fails)
  // - COLLABORATIVE (manager succeeds, all delegates fail -> overall FAILURE)
}); 