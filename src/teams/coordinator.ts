import { TeamConfig, TeamResult, AgentConfig, ToolResult as AgentResult } from '../types/sdk';
import { Logger } from '../utils/logger';
import { AgentExecutor } from '../agents/executor';
import { IAgentService } from '../types/interfaces';

export type TeamExecutionFunction = (task: string, agentConfig: AgentConfig) => Promise<AgentResult>;

export enum TeamStrategy {
    PARALLEL = 'parallel',
    SEQUENTIAL = 'sequential',
}

export class TeamCoordinator {
  private config: TeamConfig;
  private members: Map<string, AgentExecutor>;
  private logger: Logger;
  private agentService: IAgentService;
  private executeAgentTask: TeamExecutionFunction;

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
    }
    this.logger.info('TeamCoordinator', `Team initialized with ${this.members.size} members.`);
  }

  public async execute(task: string, strategy: TeamStrategy = TeamStrategy.PARALLEL): Promise<TeamResult> {
    const startTime = Date.now();
    this.logger.info('TeamCoordinator', `Executing task "${task}" with strategy: ${strategy}`);

    let results: AgentResult[] = [];
    let overallSuccess = true;

    if (strategy === TeamStrategy.PARALLEL) {
        const promises = Array.from(this.members.values()).map(agent =>
            this.executeAgentTask(task, agent.getConfig())
                .catch(err => {
                    this.logger.error('TeamCoordinator', `Agent ${agent.name} failed during parallel execution`, { error: err.message });
                    return { success: false, error: err.message };
                })
        );
        results = await Promise.all(promises);
        overallSuccess = results.some(r => r.success);
    } else if (strategy === TeamStrategy.SEQUENTIAL) {
        for (const agent of this.members.values()) {
            const result = await this.executeAgentTask(task, agent.getConfig());
            results.push(result);
            if (!result.success) {
                overallSuccess = false;
                break; // Stop on first failure
            }
        }
    }

    const endTime = Date.now();
    return {
        success: overallSuccess,
        result: {
            details: results
        },
        metrics: {
            duration: endTime - startTime,
            startTime,
            endTime,
            agentCalls: results.length
        }
    };
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