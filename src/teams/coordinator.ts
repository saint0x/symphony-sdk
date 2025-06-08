import { TeamConfig, TeamResult, AgentConfig, ToolResult as AgentResult } from '../types/sdk';
import { Logger } from '../utils/logger';
import { AgentExecutor } from '../agents/executor';
import { IAgentService } from '../types/interfaces';

export type TeamExecutionFunction = (task: string, agentConfig: AgentConfig) => Promise<AgentResult>;

export enum TeamStrategy {
    PARALLEL = 'parallel',
    SEQUENTIAL = 'sequential',
    PIPELINE = 'pipeline',
    COLLABORATIVE = 'collaborative', 
    ROLE_BASED = 'role_based'
}

interface SharedContext {
    originalTask: string;
    agentOutputs: Map<string, any>;
    sharedKnowledge: string[];
    iterationCount: number;
    consensusReached: boolean;
}

interface AgentRole {
    name: string;
    responsibilities: string[];
    toolSpecialties: string[];
    taskTypes: string[];
}

export class TeamCoordinator {
  private config: TeamConfig;
  private members: Map<string, AgentExecutor>;
  private logger: Logger;
  private agentService: IAgentService;
  private executeAgentTask: TeamExecutionFunction;
  private sharedContext: SharedContext;
  private agentRoles: Map<string, AgentRole>;

  constructor(
    config: TeamConfig, 
    agentService: IAgentService,
    agentExecutor: TeamExecutionFunction
  ) {
    this.config = config;
    this.members = new Map();
    this.agentService = agentService;
    this.executeAgentTask = agentExecutor;
    this.logger = new Logger(`TeamCoordinator:${config.name}`);
    this.sharedContext = {
      originalTask: '',
      agentOutputs: new Map(),
      sharedKnowledge: [],
      iterationCount: 0,
      consensusReached: false
    };
    this.agentRoles = new Map();
  }

  public async initialize(): Promise<void> {
    this.logger.info('TeamCoordinator', `Initializing team: ${this.config.name}`);
    for (const agentDef of this.config.agents) {
      const agentConfig: AgentConfig = typeof agentDef === 'string' ? { 
        name: agentDef, 
        description: `Member of ${this.config.name}`,
        task: 'Collaborate as a team member.', 
        tools:[], 
        llm: 'default' 
      } : agentDef;
      const agent = await this.agentService.create(agentConfig);
      this.members.set(agent.name, agent);
      
      // Initialize agent roles based on their tools and description
      this.agentRoles.set(agent.name, this.deriveAgentRole(agentConfig));
    }
    this.logger.info('TeamCoordinator', `Team initialized with ${this.members.size} members.`);
  }

  public async execute(task: string, strategy: TeamStrategy = TeamStrategy.PARALLEL): Promise<TeamResult> {
    const startTime = Date.now();
    this.logger.info('TeamCoordinator', `Executing task "${task}" with strategy: ${strategy}`);

    // Initialize shared context
    this.sharedContext = {
      originalTask: task,
      agentOutputs: new Map(),
      sharedKnowledge: [],
      iterationCount: 0,
      consensusReached: false
    };

    let results: AgentResult[] = [];
    let overallSuccess = true;

    switch (strategy) {
      case TeamStrategy.PARALLEL:
        results = await this.executeParallel(task);
        overallSuccess = results.some(r => r.success);
        break;
        
      case TeamStrategy.SEQUENTIAL:
        results = await this.executeSequential(task);
        overallSuccess = results.every(r => r.success);
        break;
        
      case TeamStrategy.PIPELINE:
        results = await this.executePipeline(task);
        overallSuccess = results.every(r => r.success);
        break;
        
      case TeamStrategy.COLLABORATIVE:
        results = await this.executeCollaborative(task);
        overallSuccess = this.sharedContext.consensusReached || results.some(r => r.success);
        break;
        
      case TeamStrategy.ROLE_BASED:
        results = await this.executeRoleBased(task);
        overallSuccess = results.every(r => r.success);
        break;
        
      default:
        this.logger.error('TeamCoordinator', `Unknown strategy: ${strategy}`);
        overallSuccess = false;
    }

    const endTime = Date.now();
    return {
        success: overallSuccess,
        result: {
            details: results,
            strategy: strategy,
            sharedContext: this.sharedContext,
            agentRoles: Array.from(this.agentRoles.entries())
        },
        metrics: {
            duration: endTime - startTime,
            startTime,
            endTime,
            agentCalls: results.length
        }
    };
  }

  private async executeParallel(task: string): Promise<AgentResult[]> {
    this.logger.info('TeamCoordinator', 'Executing PARALLEL strategy');
    const promises = Array.from(this.members.values()).map(agent =>
        this.executeAgentTask(task, agent.getConfig())
            .catch(err => {
                this.logger.error('TeamCoordinator', `Agent ${agent.name} failed during parallel execution`, { error: err.message });
                return { success: false, error: err.message };
            })
    );
    return await Promise.all(promises);
  }

  private async executeSequential(task: string): Promise<AgentResult[]> {
    this.logger.info('TeamCoordinator', 'Executing SEQUENTIAL strategy');
    const results: AgentResult[] = [];
    for (const agent of this.members.values()) {
        const result = await this.executeAgentTask(task, agent.getConfig());
        results.push(result);
        if (!result.success) {
            break; // Stop on first failure
        }
    }
    return results;
  }

  private async executePipeline(task: string): Promise<AgentResult[]> {
    this.logger.info('TeamCoordinator', 'Executing PIPELINE strategy');
    const results: AgentResult[] = [];
    let currentInput = task;
    let pipelineContext = `Original Task: ${task}\n\nPipeline Progress:\n`;

    const agentArray = Array.from(this.members.values());
    for (let i = 0; i < agentArray.length; i++) {
      const agent = agentArray[i];
      const isFirstAgent = i === 0;
      const isLastAgent = i === agentArray.length - 1;
      
      // Create pipeline-aware task
      let pipelineTask;
      if (isFirstAgent) {
        pipelineTask = `${currentInput}\n\nYou are the FIRST agent in a ${agentArray.length}-agent pipeline. Your output will be used by the next agent.`;
      } else if (isLastAgent) {
        pipelineTask = `${currentInput}\n\nYou are the FINAL agent in this pipeline. Provide the complete final deliverable based on all previous work.\n\n${pipelineContext}`;
      } else {
        pipelineTask = `${currentInput}\n\nYou are agent ${i + 1} of ${agentArray.length} in this pipeline. Build upon the previous work and prepare output for the next agent.\n\n${pipelineContext}`;
      }

      this.logger.info('TeamCoordinator', `Pipeline stage ${i + 1}: ${agent.name}`);
      const result = await this.executeAgentTask(pipelineTask, agent.getConfig());
      results.push(result);

      if (!result.success) {
        this.logger.error('TeamCoordinator', `Pipeline broken at stage ${i + 1} (${agent.name})`);
        break;
      }

      // Update context and input for next agent
      if (!isLastAgent && result.result) {
        const output = this.extractMeaningfulOutput(result.result);
        pipelineContext += `Stage ${i + 1} (${agent.name}): ${output}\n`;
        currentInput = `Continue the pipeline with this input from ${agent.name}: ${output}`;
      }
    }

    return results;
  }

  private async executeCollaborative(task: string): Promise<AgentResult[]> {
    this.logger.info('TeamCoordinator', 'Executing COLLABORATIVE strategy');
    const results: AgentResult[] = [];
    const maxIterations = 3;
    
    // Initial collaborative context
    let collaborativeContext = `COLLABORATIVE TASK: ${task}\n\nTeam Members and Roles:\n`;
    this.agentRoles.forEach((role, agentName) => {
      collaborativeContext += `- ${agentName}: ${role.responsibilities.join(', ')}\n`;
    });
    collaborativeContext += '\nCollaboration Instructions: Work together, build upon each other\'s contributions, and aim for consensus.\n\n';

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      this.sharedContext.iterationCount = iteration + 1;
      this.logger.info('TeamCoordinator', `Collaborative iteration ${iteration + 1}/${maxIterations}`);
      
      const iterationResults: AgentResult[] = [];
      
      // Each agent contributes based on shared knowledge
      for (const agent of this.members.values()) {
        let iterativeTask = collaborativeContext;
        
        if (iteration === 0) {
          iterativeTask += `Iteration 1: Provide your initial contribution to this collaborative task.`;
        } else {
          iterativeTask += `Iteration ${iteration + 1}: Review previous contributions and provide refinements, additions, or consensus.\n\nPrevious Work:\n`;
          this.sharedContext.agentOutputs.forEach((output, agentName) => {
            iterativeTask += `${agentName}: ${output}\n`;
          });
        }

        const result = await this.executeAgentTask(iterativeTask, agent.getConfig());
        iterationResults.push(result);
        
        // Update shared context
        if (result.success && result.result) {
          const output = this.extractMeaningfulOutput(result.result);
          this.sharedContext.agentOutputs.set(agent.name, output);
          this.sharedContext.sharedKnowledge.push(`${agent.name}: ${output}`);
        }
      }
      
      results.push(...iterationResults);
      
      // Check for consensus or completion
      if (this.detectConsensus(iterationResults)) {
        this.sharedContext.consensusReached = true;
        this.logger.info('TeamCoordinator', `Consensus reached in iteration ${iteration + 1}`);
        break;
      }
    }

    return results;
  }

  private async executeRoleBased(task: string): Promise<AgentResult[]> {
    this.logger.info('TeamCoordinator', 'Executing ROLE_BASED strategy');
    const results: AgentResult[] = [];
    
    // Analyze task and decompose based on agent roles
    const taskDecomposition = this.decomposeTaskByRoles(task);
    
    this.logger.info('TeamCoordinator', 'Task decomposition:', taskDecomposition);
    
    // Execute specialized tasks in optimal order
    const executionOrder = this.determineExecutionOrder(taskDecomposition);
    
    for (const assignment of executionOrder) {
      const agent = this.members.get(assignment.agentName);
      if (!agent) {
        this.logger.error('TeamCoordinator', `Agent ${assignment.agentName} not found`);
        continue;
      }
      
      const roleBasedTask = `ROLE-BASED ASSIGNMENT for ${assignment.agentName}:
      
Role: ${assignment.role.responsibilities.join(', ')}
Specializations: ${assignment.role.toolSpecialties.join(', ')}

Your specific task: ${assignment.task}

Context from other agents: ${assignment.context}

Focus on leveraging your specialized capabilities for this specific responsibility.`;

      this.logger.info('TeamCoordinator', `Executing role-based task for ${assignment.agentName}`);
      const result = await this.executeAgentTask(roleBasedTask, agent.getConfig());
      results.push(result);
      
      // Update context for subsequent agents
      if (result.success && result.result) {
        const output = this.extractMeaningfulOutput(result.result);
        assignment.context += `\n${assignment.agentName} completed: ${output}`;
      }
    }

    return results;
  }

  private deriveAgentRole(agentConfig: AgentConfig): AgentRole {
    // Analyze agent configuration to determine role
    const toolSpecialties = agentConfig.tools || [];
    const responsibilities: string[] = [];
    const taskTypes: string[] = [];

    // Map tools to responsibilities
    if (toolSpecialties.includes('ponder') || toolSpecialties.includes('webSearch')) {
      responsibilities.push('Research', 'Analysis', 'Strategic Planning');
      taskTypes.push('research', 'analysis', 'investigation');
    }
    
    if (toolSpecialties.includes('writeCode') || toolSpecialties.includes('createPlan')) {
      responsibilities.push('Development', 'Architecture', 'Implementation');
      taskTypes.push('coding', 'planning', 'technical_design');
    }
    
    if (toolSpecialties.includes('writeFile') || toolSpecialties.includes('readFile')) {
      responsibilities.push('Documentation', 'Project Management', 'Quality Assurance');
      taskTypes.push('documentation', 'organization', 'review');
    }

    // Default fallback
    if (responsibilities.length === 0) {
      responsibilities.push('General Support');
      taskTypes.push('general');
    }

    return {
      name: agentConfig.name,
      responsibilities,
      toolSpecialties,
      taskTypes
    };
  }

  private extractMeaningfulOutput(result: any): string {
    if (typeof result === 'string') return result;
    if (result?.response) return result.response;
    if (result?.code) return `Generated code: ${result.code.substring(0, 200)}...`;
    if (result?.analysis) return result.analysis;
    return JSON.stringify(result).substring(0, 300) + '...';
  }

  private detectConsensus(results: AgentResult[]): boolean {
    // Simple consensus detection - all agents succeeded and produced meaningful output
    const successfulResults = results.filter(r => r.success && r.result);
    return successfulResults.length === results.length && results.length >= 2;
  }

  private decomposeTaskByRoles(task: string): Array<{agentName: string, role: AgentRole, task: string, context: string}> {
    const decomposition: Array<{agentName: string, role: AgentRole, task: string, context: string}> = [];
    
    // Analyze task keywords and assign to appropriate roles
    const taskLower = task.toLowerCase();
    
    this.agentRoles.forEach((role, agentName) => {
      let assignedTask = '';
      let relevanceScore = 0;
      
      // Score relevance based on role responsibilities
      if (role.responsibilities.some(r => taskLower.includes(r.toLowerCase()))) {
        relevanceScore += 3;
      }
      
      if (role.toolSpecialties.some(t => taskLower.includes(t.toLowerCase()))) {
        relevanceScore += 2;
      }
      
      if (role.taskTypes.some(t => taskLower.includes(t))) {
        relevanceScore += 1;
      }
      
      // Generate specific task based on role
      if (role.responsibilities.includes('Research')) {
        assignedTask = `Research and analyze requirements for: ${task}`;
        relevanceScore += taskLower.includes('research') ? 3 : 0;
      } else if (role.responsibilities.includes('Development')) {
        assignedTask = `Design and implement solution for: ${task}`;
        relevanceScore += taskLower.includes('develop') || taskLower.includes('code') ? 3 : 0;
      } else if (role.responsibilities.includes('Documentation')) {
        assignedTask = `Document and organize deliverables for: ${task}`;
        relevanceScore += taskLower.includes('document') ? 3 : 0;
      } else {
        assignedTask = `Support the completion of: ${task}`;
      }
      
      if (relevanceScore > 0) {
        decomposition.push({
          agentName,
          role,
          task: assignedTask,
          context: `Original task: ${task}`
        });
      }
    });
    
    return decomposition.sort((a, b) => {
      // Prioritize research first, then development, then documentation
      const order = ['Research', 'Development', 'Documentation'];
      const aIndex = order.findIndex(o => a.role.responsibilities.includes(o));
      const bIndex = order.findIndex(o => b.role.responsibilities.includes(o));
      return aIndex - bIndex;
    });
  }

  private determineExecutionOrder(decomposition: Array<{agentName: string, role: AgentRole, task: string, context: string}>): Array<{agentName: string, role: AgentRole, task: string, context: string}> {
    // Return decomposition already sorted by logical dependency order
    return decomposition;
  }

  public getMembers(): string[] {
    return Array.from(this.members.keys());
  }

  public getConfig(): TeamConfig {
    return this.config;
  }

  public async shutdown(): Promise<void> {
    this.logger.info('TeamCoordinator', `Shutting down team: ${this.config.name}`);
    this.members.clear();
  }
} 