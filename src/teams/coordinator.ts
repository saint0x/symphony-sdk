import { TeamConfig, TeamResult, AgentConfig, ToolLifecycleState } from '../types/sdk';
import { Logger } from '../utils/logger';
import { AgentExecutor } from '../agents/executor';

export interface TeamMember {
  id: string;
  name: string;
  executor: AgentExecutor;
  config: AgentConfig;
  capabilities: string[];
  currentLoad: number;
  status: 'idle' | 'busy' | 'error';
  lastActivity: number;
}

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  task: string;
  priority: number;
  assignedAt: number;
  expectedDuration?: number;
  dependencies?: string[];
}

export interface SharedContext {
  teamId: string;
  workspaceData: Map<string, any>;
  taskHistory: TaskAssignment[];
  agentResults: Map<string, any>;
  globalState: Record<string, any>;
  communicationLog: Array<{
    from: string;
    to: string | 'all';
    message: string;
    timestamp: number;
    type: 'coordination' | 'data_share' | 'status_update';
  }>;
}

export enum TeamExecutionStrategy {
  PARALLEL = 'parallel',          // Execute all tasks simultaneously
  SEQUENTIAL = 'sequential',      // Execute tasks one after another
  PIPELINE = 'pipeline',         // Chain outputs between agents
  COLLABORATIVE = 'collaborative', // Agents work together on single task
  ROLE_BASED = 'role_based'      // Assign based on agent specialization
}

// New comprehensive team context interface
export interface TeamContext {
  // Team identification
  teamId: string;
  teamName: string;
  
  // Current state
  currentTask?: string;
  executionPhase: 'idle' | 'planning' | 'executing' | 'coordinating' | 'completing';
  activeStrategy?: TeamExecutionStrategy;
  
  // Member intelligence
  members: {
    available: Array<{
      name: string;
      capabilities: string[];
      status: 'idle' | 'busy' | 'error';
      currentLoad: number;
      efficiency: number; // calculated from recent performance
    }>;
    optimal: {
      name: string;
      reason: string;
    } | null;
    workload: {
      balanced: boolean;
      distribution: Record<string, number>;
    };
  };
  
  // Task intelligence
  tasks: {
    active: number;
    queued: number;
    completed: number;
    recentHistory: Array<{
      task: string;
      strategy: string;
      duration: number;
      success: boolean;
      participatingAgents: string[];
    }>;
  };
  
  // Shared knowledge
  workspace: {
    sharedData: Record<string, any>;
    recentCommunications: Array<{
      from: string;
      message: string;
      timestamp: number;
      type: string;
    }>;
    knowledgeBase: string[]; // key insights from past tasks
  };
  
  // Intelligence insights
  insights: {
    recommendedStrategy: TeamExecutionStrategy;
    strategyReason: string;
    teamEfficiency: number;
    suggestedOptimizations: string[];
    riskFactors: string[];
  };
  
  // Context metadata
  lastUpdated: number;
  contextVersion: string;
}

export class TeamCoordinator {
  private teamId: string;
  private config: TeamConfig;
  private members: Map<string, TeamMember>;
  private sharedContext: SharedContext;
  private logger: Logger;
  private state: ToolLifecycleState;
  private taskQueue: TaskAssignment[];
  private activeExecutions: Map<string, Promise<any>>;

  constructor(config: TeamConfig) {
    this.teamId = `team_${Date.now()}`;
    this.config = config;
    this.members = new Map();
    this.taskQueue = [];
    this.activeExecutions = new Map();
    this.state = ToolLifecycleState.PENDING;
    this.logger = Logger.getInstance(`TeamCoordinator:${config.name}`);

    this.sharedContext = {
      teamId: this.teamId,
      workspaceData: new Map(),
      taskHistory: [],
      agentResults: new Map(),
      globalState: {},
      communicationLog: []
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('TeamCoordinator', `Initializing team: ${this.config.name}`);
    this.state = ToolLifecycleState.INITIALIZING;

    try {
      // Initialize team members
      await this.initializeTeamMembers();
      
      // Set up coordination strategy
      await this.setupCoordinationStrategy();
      
      this.state = ToolLifecycleState.READY;
      this.logger.info('TeamCoordinator', `Team ${this.config.name} ready with ${this.members.size} members`);
      
    } catch (error) {
      this.state = ToolLifecycleState.ERROR;
      this.logger.error('TeamCoordinator', 'Team initialization failed', { error });
      throw error;
    }
  }

  private async initializeTeamMembers(): Promise<void> {
    for (const agentDef of this.config.agents) {
      try {
        let agentConfig: AgentConfig;
        
        if (typeof agentDef === 'string') {
          // Simple agent reference - create basic config
          agentConfig = {
            name: agentDef,
            description: `Agent ${agentDef} in team ${this.config.name}`,
            task: 'Team coordination and task execution',
            tools: ['webSearch', 'writeFile', 'readFile', 'ponder'],
            llm: 'gpt-4o-mini'
          };
        } else {
          // Full agent configuration
          agentConfig = agentDef;
        }

        // Create agent executor
        const executor = new AgentExecutor(agentConfig);
        
        // Create team member
        const member: TeamMember = {
          id: `${this.teamId}_${agentConfig.name}`,
          name: agentConfig.name,
          executor,
          config: agentConfig,
          capabilities: agentConfig.capabilities || [],
          currentLoad: 0,
          status: 'idle',
          lastActivity: Date.now()
        };

        this.members.set(member.id, member);
        
        this.logger.info('TeamCoordinator', `Initialized team member: ${member.name}`, {
          capabilities: member.capabilities,
          tools: agentConfig.tools
        });

      } catch (error) {
        this.logger.error('TeamCoordinator', `Failed to initialize agent ${agentDef}`, { error });
        throw error;
      }
    }
  }

  private async setupCoordinationStrategy(): Promise<void> {
    // Set up default coordination rules if not specified
    if (!this.config.strategy) {
      this.config.strategy = {
        name: 'balanced_distribution',
        description: 'Distribute tasks based on agent load and capabilities',
        coordinationRules: {
          maxParallelTasks: 3,
          taskTimeout: 300000 // 5 minutes
        }
      };
    }

    this.logger.info('TeamCoordinator', `Using coordination strategy: ${this.config.strategy.name}`);
  }

  async executeTask(task: string, options?: {
    strategy?: TeamExecutionStrategy;
    priority?: number;
    timeout?: number;
    requiredCapabilities?: string[];
  }): Promise<TeamResult> {
    const startTime = Date.now();
    const taskId = `task_${startTime}`;
    
    this.logger.info('TeamCoordinator', `Executing team task: ${task}`, {
      taskId,
      strategy: options?.strategy || 'auto',
      teamSize: this.members.size
    });

    try {
      // Determine execution strategy
      const strategy = options?.strategy || await this.determineOptimalStrategy(task, options);
      
      // Execute based on strategy
      let result;
      switch (strategy) {
        case TeamExecutionStrategy.PARALLEL:
          result = await this.executeParallel(taskId, task, options);
          break;
        case TeamExecutionStrategy.SEQUENTIAL:
          result = await this.executeSequential(taskId, task, options);
          break;
        case TeamExecutionStrategy.PIPELINE:
          result = await this.executePipeline(taskId, task, options);
          break;
        case TeamExecutionStrategy.COLLABORATIVE:
          result = await this.executeCollaborative(taskId, task, options);
          break;
        case TeamExecutionStrategy.ROLE_BASED:
          result = await this.executeRoleBased(taskId, task, options);
          break;
        default:
          result = await this.executeRoleBased(taskId, task, options);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Update shared context
      this.sharedContext.taskHistory.push({
        taskId,
        agentId: 'team_coordination',
        task,
        priority: options?.priority || 1,
        assignedAt: startTime
      });

      this.logger.info('TeamCoordinator', `Team task completed successfully`, {
        taskId,
        duration,
        strategy,
        participatingAgents: result.participatingAgents?.length || 0
      });

      return {
        success: true,
        result: {
          task,
          strategy,
          executionDetails: result,
          sharedContext: this.serializeContext(),
          participatingAgents: result.participatingAgents || []
        },
        metrics: {
          duration,
          startTime,
          endTime,
          agentCalls: result.participatingAgents?.length || 0
        }
      };

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.logger.error('TeamCoordinator', `Team task execution failed`, {
        taskId,
        error: error instanceof Error ? error.message : String(error),
        duration
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          duration,
          startTime,
          endTime,
          agentCalls: 0
        }
      };
    }
  }

  private async determineOptimalStrategy(task: string, options?: any): Promise<TeamExecutionStrategy> {
    // Analyze task to determine best strategy
    const taskLower = task.toLowerCase();
    
    // Check for parallel indicators
    if (taskLower.includes('simultaneously') || taskLower.includes('all at once') || 
        taskLower.includes('in parallel')) {
      return TeamExecutionStrategy.PARALLEL;
    }
    
    // Check for sequential indicators
    if (taskLower.includes('step by step') || taskLower.includes('one after another') ||
        taskLower.includes('in sequence')) {
      return TeamExecutionStrategy.SEQUENTIAL;
    }
    
    // Check for pipeline indicators
    if (taskLower.includes('then pass to') || taskLower.includes('chain') ||
        taskLower.includes('pipeline')) {
      return TeamExecutionStrategy.PIPELINE;
    }
    
    // Check for collaborative indicators
    if (taskLower.includes('work together') || taskLower.includes('collaborate') ||
        taskLower.includes('combine efforts')) {
      return TeamExecutionStrategy.COLLABORATIVE;
    }

    // Check if specific capabilities are required
    if (options?.requiredCapabilities && options.requiredCapabilities.length > 0) {
      return TeamExecutionStrategy.ROLE_BASED;
    }

    // Default to role-based for efficiency
    return TeamExecutionStrategy.ROLE_BASED;
  }

  private async executeParallel(taskId: string, task: string, _options?: any) {
    this.logger.info('TeamCoordinator', `Executing parallel strategy for task: ${taskId}`);
    
    const participatingAgents: string[] = [];
    const results: any[] = [];
    const promises: Promise<any>[] = [];

    // Assign task to all available agents
    for (const [_memberId, member] of this.members) {
      if (member.status === 'idle') {
        participatingAgents.push(member.name);
        
        const promise = this.executeAgentTask(member, task, taskId)
          .catch(error => ({
            agentName: member.name,
            success: false,
            error: error.message
          }));
        
        promises.push(promise);
      }
    }

    // Wait for all agents to complete
    const agentResults = await Promise.allSettled(promises);
    
    // Collect results
    agentResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push({
          agent: participatingAgents[index],
          result: result.value
        });
      } else {
        results.push({
          agent: participatingAgents[index],
          error: result.reason
        });
      }
    });

    // Aggregate results
    const aggregatedResult = await this.aggregateResults(results, 'parallel');

    return {
      strategy: 'parallel',
      participatingAgents,
      individualResults: results,
      aggregatedResult,
      executionSummary: `${participatingAgents.length} agents executed task in parallel`
    };
  }

  private async executeSequential(taskId: string, task: string, _options?: any) {
    this.logger.info('TeamCoordinator', `Executing sequential strategy for task: ${taskId}`);
    
    const participatingAgents: string[] = [];
    const results: any[] = [];

    // Execute task with each agent sequentially
    for (const [_memberId, member] of this.members) {
      if (member.status === 'idle') {
        participatingAgents.push(member.name);
        
        try {
          const result = await this.executeAgentTask(member, task, taskId);
          results.push({
            agent: member.name,
            result
          });

          // Update shared context with intermediate result
          this.sharedContext.agentResults.set(`${taskId}_${member.name}`, result);
          
        } catch (error) {
          results.push({
            agent: member.name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    const aggregatedResult = await this.aggregateResults(results, 'sequential');

    return {
      strategy: 'sequential',
      participatingAgents,
      individualResults: results,
      aggregatedResult,
      executionSummary: `${participatingAgents.length} agents executed task sequentially`
    };
  }

  private async executePipeline(taskId: string, task: string, _options?: any) {
    this.logger.info('TeamCoordinator', `Executing pipeline strategy for task: ${taskId}`);
    
    const participatingAgents: string[] = [];
    const results: any[] = [];
    let currentInput = task;

    // Execute task as pipeline, passing output to next agent
    for (const [_memberId, member] of this.members) {
      if (member.status === 'idle') {
        participatingAgents.push(member.name);
        
        try {
          // Execute with current input (initial task or previous agent's output)
          const result = await this.executeAgentTask(member, currentInput, taskId);
          
          results.push({
            agent: member.name,
            input: currentInput,
            result
          });

          // Use this agent's output as input for next agent
          if (result.success && result.result?.response) {
            currentInput = result.result.response;
          }
          
          // Update shared context
          this.sharedContext.agentResults.set(`${taskId}_${member.name}`, result);
          
        } catch (error) {
          results.push({
            agent: member.name,
            input: currentInput,
            error: error instanceof Error ? error.message : String(error)
          });
          break; // Stop pipeline on error
        }
      }
    }

    return {
      strategy: 'pipeline',
      participatingAgents,
      pipelineResults: results,
      finalOutput: currentInput,
      executionSummary: `${participatingAgents.length} agents executed in pipeline formation`
    };
  }

  private async executeCollaborative(taskId: string, task: string, _options?: any) {
    this.logger.info('TeamCoordinator', `Executing collaborative strategy for task: ${taskId}`);
    
    // Break down task into collaborative subtasks
    const subtasks = await this.decomposeTaskForCollaboration(task);
    const participatingAgents: string[] = [];
    const results: any[] = [];

    // Assign different aspects to different agents
    let agentIndex = 0;
    for (const subtask of subtasks) {
      const members = Array.from(this.members.values());
      if (agentIndex < members.length && members[agentIndex].status === 'idle') {
        const member = members[agentIndex];
        participatingAgents.push(member.name);
        
        try {
          const result = await this.executeAgentTask(member, subtask, taskId);
          results.push({
            agent: member.name,
            subtask,
            result
          });

          // Share result with team
          await this.shareResultWithTeam(member.name, result, 'data_share');
          
        } catch (error) {
          results.push({
            agent: member.name,
            subtask,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        
        agentIndex++;
      }
    }

    // Synthesize collaborative results
    const synthesizedResult = await this.synthesizeCollaborativeResults(results);

    return {
      strategy: 'collaborative',
      participatingAgents,
      subtasks,
      individualContributions: results,
      synthesizedResult,
      executionSummary: `${participatingAgents.length} agents collaborated on task decomposition`
    };
  }

  private async executeRoleBased(taskId: string, task: string, options?: any) {
    this.logger.info('TeamCoordinator', `Executing role-based strategy for task: ${taskId}`);
    
    // Select best agent based on capabilities and current load
    const selectedAgent = await this.selectOptimalAgent(options?.requiredCapabilities);
    
    if (!selectedAgent) {
      throw new Error('No suitable agent available for task');
    }

    const result = await this.executeAgentTask(selectedAgent, task, taskId);

    return {
      strategy: 'role_based',
      participatingAgents: [selectedAgent.name],
      selectedAgent: {
        name: selectedAgent.name,
        capabilities: selectedAgent.capabilities,
        selectionReason: 'Best match for task requirements'
      },
      result,
      executionSummary: `Task assigned to ${selectedAgent.name} based on capabilities`
    };
  }

  private async selectOptimalAgent(requiredCapabilities?: string[]): Promise<TeamMember | null> {
    const availableAgents = Array.from(this.members.values()).filter(member => member.status === 'idle');
    
    if (availableAgents.length === 0) {
      return null;
    }

    // If specific capabilities required, filter by capabilities
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      const capableAgents = availableAgents.filter(agent => 
        requiredCapabilities.some(cap => agent.capabilities.includes(cap))
      );
      
      if (capableAgents.length > 0) {
        // Return agent with most matching capabilities and lowest load
        return capableAgents.sort((a, b) => {
          const aMatches = requiredCapabilities.filter(cap => a.capabilities.includes(cap)).length;
          const bMatches = requiredCapabilities.filter(cap => b.capabilities.includes(cap)).length;
          if (aMatches !== bMatches) return bMatches - aMatches;
          return a.currentLoad - b.currentLoad;
        })[0];
      }
    }

    // Default: return agent with lowest load
    return availableAgents.sort((a, b) => a.currentLoad - b.currentLoad)[0];
  }

  private async executeAgentTask(member: TeamMember, task: string, taskId: string): Promise<any> {
    member.status = 'busy';
    member.currentLoad++;
    member.lastActivity = Date.now();

    try {
      this.logger.info('TeamCoordinator', `Agent ${member.name} executing task`, { taskId });
      
      const result = await member.executor.executeTask(task);
      
      member.status = 'idle';
      member.currentLoad = Math.max(0, member.currentLoad - 1);
      
      return result;

    } catch (error) {
      member.status = 'error';
      member.currentLoad = Math.max(0, member.currentLoad - 1);
      throw error;
    }
  }

  private async decomposeTaskForCollaboration(task: string): Promise<string[]> {
    // Simple task decomposition for collaboration
    // In the future, this could use LLM to intelligently decompose tasks
    
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('research') || taskLower.includes('analyze')) {
      return [
        `Research background information: ${task}`,
        `Analyze current trends: ${task}`,
        `Identify key insights: ${task}`
      ];
    }
    
    if (taskLower.includes('write') || taskLower.includes('create')) {
      return [
        `Create outline for: ${task}`,
        `Draft main content: ${task}`,
        `Review and refine: ${task}`
      ];
    }

    // Default decomposition
    return [
      `Initial analysis: ${task}`,
      `Detailed execution: ${task}`,
      `Final verification: ${task}`
    ];
  }

  private async shareResultWithTeam(agentName: string, result: any, type: 'coordination' | 'data_share' | 'status_update'): Promise<void> {
    this.sharedContext.communicationLog.push({
      from: agentName,
      to: 'all',
      message: JSON.stringify(result),
      timestamp: Date.now(),
      type
    });

    this.logger.info('TeamCoordinator', `Agent ${agentName} shared result with team`, { type });
  }

  private async aggregateResults(results: any[], strategy: string): Promise<any> {
    const successfulResults = results.filter(r => r.result?.success);
    const failedResults = results.filter(r => !r.result?.success || r.error);

    return {
      strategy,
      totalAgents: results.length,
      successfulAgents: successfulResults.length,
      failedAgents: failedResults.length,
      successRate: successfulResults.length / results.length,
      aggregatedResponse: successfulResults.map(r => 
        r.result?.result?.response || r.result?.response || 'No response'
      ).join('\n\n---\n\n'),
      summary: `${successfulResults.length}/${results.length} agents completed successfully using ${strategy} strategy`
    };
  }

  private async synthesizeCollaborativeResults(results: any[]): Promise<any> {
    const contributions = results.map(r => ({
      agent: r.agent,
      subtask: r.subtask,
      contribution: r.result?.result?.response || r.result?.response || 'No contribution'
    }));

    const synthesized = contributions.map(c => 
      `${c.agent} (${c.subtask}): ${c.contribution}`
    ).join('\n\n');

    return {
      collaborationType: 'task_decomposition',
      totalContributors: contributions.length,
      contributions,
      synthesizedResult: synthesized,
      summary: `Collaborative effort by ${contributions.length} agents with task decomposition`
    };
  }

  private serializeContext(): any {
    return {
      teamId: this.sharedContext.teamId,
      taskCount: this.sharedContext.taskHistory.length,
      agentResultCount: this.sharedContext.agentResults.size,
      communicationEntries: this.sharedContext.communicationLog.length,
      globalState: this.sharedContext.globalState
    };
  }

  getTeamStatus(): any {
    const memberStatus = Array.from(this.members.values()).map(member => ({
      name: member.name,
      status: member.status,
      currentLoad: member.currentLoad,
      capabilities: member.capabilities,
      lastActivity: member.lastActivity
    }));

    return {
      teamId: this.teamId,
      name: this.config.name,
      state: this.state,
      memberCount: this.members.size,
      members: memberStatus,
      activeExecutions: this.activeExecutions.size,
      taskQueueLength: this.taskQueue.length,
      strategy: this.config.strategy?.name || 'default'
    };
  }

  // === TEAM CONTEXT INTELLIGENCE API ===

  getContext(): TeamContext {
    const now = Date.now();
    
    // Analyze member efficiency from recent task history
    const memberEfficiencies = this.calculateMemberEfficiencies();
    
    // Build available members with intelligence
    const availableMembers = Array.from(this.members.values()).map(member => ({
      name: member.name,
      capabilities: member.capabilities,
      status: member.status,
      currentLoad: member.currentLoad,
      efficiency: memberEfficiencies[member.name] || 0.8 // default efficiency
    }));

    // Find optimal member for next task
    const optimalMember = this.findOptimalMember(availableMembers);
    
    // Calculate workload distribution
    const workloadDistribution = this.calculateWorkloadDistribution();
    
    // Analyze recent task history
    const recentTasks = this.getRecentTaskHistory(5); // last 5 tasks
    
    // Get recent communications (last 10 entries)
    const recentComms = this.sharedContext.communicationLog
      .slice(-10)
      .map(comm => ({
        from: comm.from,
        message: comm.message.length > 100 ? comm.message.substring(0, 100) + '...' : comm.message,
        timestamp: comm.timestamp,
        type: comm.type
      }));

    // Extract knowledge base from successful tasks
    const knowledgeBase = this.extractKnowledgeBase();
    
    // Generate insights and recommendations
    const insights = this.generateTeamInsights(availableMembers, recentTasks);

    return {
      // Team identification
      teamId: this.teamId,
      teamName: this.config.name,
      
      // Current state
      currentTask: this.getCurrentTask(),
      executionPhase: this.determineExecutionPhase(),
      activeStrategy: this.getCurrentStrategy(),
      
      // Member intelligence
      members: {
        available: availableMembers,
        optimal: optimalMember,
        workload: {
          balanced: this.isWorkloadBalanced(workloadDistribution),
          distribution: workloadDistribution
        }
      },
      
      // Task intelligence
      tasks: {
        active: this.activeExecutions.size,
        queued: this.taskQueue.length,
        completed: this.sharedContext.taskHistory.length,
        recentHistory: recentTasks
      },
      
      // Shared knowledge
      workspace: {
        sharedData: Object.fromEntries(this.sharedContext.workspaceData),
        recentCommunications: recentComms,
        knowledgeBase
      },
      
      // Intelligence insights
      insights,
      
      // Context metadata
      lastUpdated: now,
      contextVersion: '1.0.0'
    };
  }

  // === PRIVATE CONTEXT ANALYSIS METHODS ===

  private calculateMemberEfficiencies(): Record<string, number> {
    const efficiencies: Record<string, number> = {};
    
    // Analyze from task history - calculate success rate and average execution time
    this.sharedContext.taskHistory.forEach(task => {
      if (!efficiencies[task.agentId]) {
        efficiencies[task.agentId] = 0.8; // baseline efficiency
      }
    });

    // For now, simulate efficiency based on current load (inverse relationship)
    Array.from(this.members.values()).forEach(member => {
      const loadFactor = Math.max(0.1, 1 - (member.currentLoad * 0.1));
      const activityFactor = member.lastActivity > Date.now() - 300000 ? 1.0 : 0.9; // 5 min activity
      efficiencies[member.name] = loadFactor * activityFactor;
    });

    return efficiencies;
  }

  private findOptimalMember(availableMembers: any[]): { name: string; reason: string } | null {
    const idleMembers = availableMembers.filter(m => m.status === 'idle');
    
    if (idleMembers.length === 0) {
      return null;
    }

    // Find member with highest efficiency and lowest load
    const optimal = idleMembers.sort((a, b) => {
      const scoreA = a.efficiency - (a.currentLoad * 0.1);
      const scoreB = b.efficiency - (b.currentLoad * 0.1);
      return scoreB - scoreA;
    })[0];

    return {
      name: optimal.name,
      reason: `Highest efficiency (${(optimal.efficiency * 100).toFixed(1)}%) with low load (${optimal.currentLoad})`
    };
  }

  private calculateWorkloadDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    Array.from(this.members.values()).forEach(member => {
      distribution[member.name] = member.currentLoad;
    });

    return distribution;
  }

  private isWorkloadBalanced(distribution: Record<string, number>): boolean {
    const loads = Object.values(distribution);
    if (loads.length === 0) return true;
    
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);
    
    // Consider balanced if difference is less than 2
    return (maxLoad - minLoad) <= 2;
  }

  private getRecentTaskHistory(count: number): Array<{
    task: string;
    strategy: string;
    duration: number;
    success: boolean;
    participatingAgents: string[];
  }> {
    // For now, return simplified task history
    // In the future, we could store more detailed execution results
    return this.sharedContext.taskHistory
      .slice(-count)
      .map(task => ({
        task: task.task,
        strategy: 'role_based', // simplified
        duration: 5000, // estimated duration
        success: true, // assume success for now
        participatingAgents: [task.agentId]
      }));
  }

  private extractKnowledgeBase(): string[] {
    const insights: string[] = [];
    
    // Extract patterns from communication log
    const successfulTasks = this.sharedContext.taskHistory.length;
    if (successfulTasks > 5) {
      insights.push(`Team has successfully completed ${successfulTasks} tasks`);
    }

    // Analyze member specializations
    const capabilityMap: Record<string, number> = {};
    Array.from(this.members.values()).forEach(member => {
      member.capabilities.forEach(cap => {
        capabilityMap[cap] = (capabilityMap[cap] || 0) + 1;
      });
    });

    const topCapabilities = Object.entries(capabilityMap)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([cap]) => cap);

    if (topCapabilities.length > 0) {
      insights.push(`Team specializes in: ${topCapabilities.join(', ')}`);
    }

    return insights;
  }

  private generateTeamInsights(members: any[], recentTasks: any[]): {
    recommendedStrategy: TeamExecutionStrategy;
    strategyReason: string;
    teamEfficiency: number;
    suggestedOptimizations: string[];
    riskFactors: string[];
  } {
    const idleMembers = members.filter(m => m.status === 'idle').length;
    const totalMembers = members.length;
    const averageEfficiency = members.reduce((sum, m) => sum + m.efficiency, 0) / members.length;

    // Recommend strategy based on team state
    let recommendedStrategy: TeamExecutionStrategy;
    let strategyReason: string;

    if (idleMembers >= 3) {
      recommendedStrategy = TeamExecutionStrategy.PARALLEL;
      strategyReason = `${idleMembers} idle agents available for parallel execution`;
    } else if (idleMembers === 1) {
      recommendedStrategy = TeamExecutionStrategy.ROLE_BASED;
      strategyReason = 'Single agent optimization for focused execution';
    } else {
      recommendedStrategy = TeamExecutionStrategy.COLLABORATIVE;
      strategyReason = 'Limited availability requires collaborative approach';
    }

    // Generate optimization suggestions
    const optimizations: string[] = [];
    if (averageEfficiency < 0.7) {
      optimizations.push('Consider reducing agent workload to improve efficiency');
    }
    if (idleMembers === 0) {
      optimizations.push('All agents busy - consider queuing or load balancing');
    }
    if (recentTasks.length === 0) {
      optimizations.push('No recent task history - establish baseline performance');
    }

    // Identify risk factors
    const riskFactors: string[] = [];
    const errorMembers = members.filter(m => m.status === 'error').length;
    if (errorMembers > 0) {
      riskFactors.push(`${errorMembers} agents in error state`);
    }
    if (idleMembers === 0 && this.taskQueue.length > 0) {
      riskFactors.push('Task queue backlog with no available agents');
    }

    return {
      recommendedStrategy,
      strategyReason,
      teamEfficiency: averageEfficiency,
      suggestedOptimizations: optimizations,
      riskFactors
    };
  }

  private getCurrentTask(): string | undefined {
    // Return the most recent task if any active executions
    if (this.activeExecutions.size > 0) {
      const recentTask = this.sharedContext.taskHistory[this.sharedContext.taskHistory.length - 1];
      return recentTask?.task;
    }
    return undefined;
  }

  private determineExecutionPhase(): 'idle' | 'planning' | 'executing' | 'coordinating' | 'completing' {
    if (this.activeExecutions.size === 0 && this.taskQueue.length === 0) {
      return 'idle';
    }
    if (this.activeExecutions.size > 0) {
      return 'executing';
    }
    if (this.taskQueue.length > 0) {
      return 'planning';
    }
    return 'idle';
  }

  private getCurrentStrategy(): TeamExecutionStrategy | undefined {
    // For now, return the default strategy from config
    // In the future, we could track the strategy of the current active task
    if (this.config.strategy?.name) {
      // Map string to enum
      switch (this.config.strategy.name.toLowerCase()) {
        case 'parallel': return TeamExecutionStrategy.PARALLEL;
        case 'sequential': return TeamExecutionStrategy.SEQUENTIAL;
        case 'pipeline': return TeamExecutionStrategy.PIPELINE;
        case 'collaborative': return TeamExecutionStrategy.COLLABORATIVE;
        case 'role_based': return TeamExecutionStrategy.ROLE_BASED;
        default: return TeamExecutionStrategy.ROLE_BASED;
      }
    }
    return undefined;
  }

  async shutdown(): Promise<void> {
    this.logger.info('TeamCoordinator', `Shutting down team: ${this.config.name}`);
    
    // Wait for active executions to complete or timeout
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 30000)); // 30 second timeout
    const executionsPromise = Promise.all(Array.from(this.activeExecutions.values()));
    
    await Promise.race([executionsPromise, timeoutPromise]);
    
    // Clear all data
    this.members.clear();
    this.taskQueue = [];
    this.activeExecutions.clear();
    
    this.state = ToolLifecycleState.PENDING;
    this.logger.info('TeamCoordinator', 'Team shutdown complete');
  }
} 