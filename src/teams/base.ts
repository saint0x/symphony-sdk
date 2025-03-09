import { TeamConfig, AgentConfig, TeamStrategy } from '../types/sdk';
import { BaseAgent } from '../agents/base';
import { createMetricsTracker } from '../utils/metrics';
import { validateTeamConfig } from '../utils/validation';

export class BaseTeam {
    protected name: string;
    protected description: string;
    protected agents: Map<string, BaseAgent>;
    protected manager: boolean;
    protected strategy: TeamStrategy;
    protected log: {
        inputs: boolean;
        outputs: boolean;
        metrics: boolean;
    };
    protected metrics = createMetricsTracker();

    constructor(config: TeamConfig) {
        validateTeamConfig(config);

        this.name = config.name;
        this.description = config.description;
        this.agents = new Map();
        this.manager = config.manager ?? false;
        this.strategy = config.strategy ?? {};
        this.log = {
            inputs: config.log?.inputs ?? true,
            outputs: config.log?.outputs ?? true,
            metrics: config.log?.metrics ?? true
        };

        // Initialize agents
        this.initializeAgents(config.agents);
    }

    private initializeAgents(agents: Array<string | AgentConfig>) {
        for (const agent of agents) {
            if (typeof agent === 'string') {
                throw new Error('Agent must be provided as config object');
            } else {
                const baseAgent = new BaseAgent(agent);
                this.agents.set(agent.name, baseAgent);
            }
        }
    }

    protected async distributeTask(task: string): Promise<string[]> {
        if (!this.strategy?.assignmentLogic) {
            // Default round-robin distribution
            return Array.from(this.agents.keys());
        }

        return this.strategy.assignmentLogic(task, Array.from(this.agents.keys()));
    }

    protected async executeParallel(assignments: Map<string, string>): Promise<any[]> {
        const maxParallel = this.strategy?.coordinationRules?.maxParallelTasks ?? this.agents.size;
        const timeout = this.strategy?.coordinationRules?.taskTimeout ?? 30000;
        const results: any[] = [];

        // Create execution batches
        const batches: Array<[string, string][]> = [];
        const entries = Array.from(assignments.entries());
        
        for (let i = 0; i < entries.length; i += maxParallel) {
            batches.push(entries.slice(i, i + maxParallel));
        }

        // Execute batches
        for (const batch of batches) {
            const batchPromises = batch.map(([agentName, task]) => {
                const agent = this.agents.get(agentName);
                if (!agent) {
                    throw new Error(`Agent '${agentName}' not found`);
                }

                return Promise.race([
                    agent.run(task),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`Task timeout for agent ${agentName}`)), timeout)
                    )
                ]);
            });

            const batchResults = await Promise.allSettled(batchPromises);
            results.push(...batchResults);
        }

        return results;
    }

    async run(task: string): Promise<any> {
        this.metrics.trackOperation('team_start');
        
        try {
            // Log input if enabled
            if (this.log.inputs) {
                console.log(`Team ${this.name} received task: ${task}`);
            }

            // Distribute task among agents
            const assignedAgents = await this.distributeTask(task);
            
            // Create agent-task assignments
            const assignments = new Map<string, string>();
            for (const agentName of assignedAgents) {
                assignments.set(agentName, task);
            }

            // Execute tasks in parallel with coordination
            const results = await this.executeParallel(assignments);

            // Process results
            const successResults = results
                .filter(r => r.status === 'fulfilled')
                .map(r => (r as PromiseFulfilledResult<any>).value)
                .filter(r => r.success);

            const errorResults = results
                .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
                .map(r => r.status === 'rejected' ? r.reason : r.value.error);

            // Log output if enabled
            if (this.log.outputs) {
                console.log(`Team ${this.name} completed task with ${successResults.length} successes and ${errorResults.length} failures`);
            }

            this.metrics.trackOperation('team_complete');
            return {
                success: errorResults.length === 0,
                results: successResults,
                errors: errorResults,
                metrics: this.metrics.end()
            };
        } catch (error) {
            this.metrics.trackOperation('team_error');
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                metrics: this.metrics.end()
            };
        }
    }

    async *executeStream(task: string): AsyncGenerator<any, void, unknown> {
        this.metrics.trackOperation('stream_start');
        
        try {
            // Log input if enabled
            if (this.log.inputs) {
                yield {
                    type: 'input',
                    task
                };
            }

            // Distribute task among agents
            const assignedAgents = await this.distributeTask(task);
            yield {
                type: 'task_distribution',
                agents: assignedAgents
            };

            // Execute tasks and stream results
            for (const agentName of assignedAgents) {
                const agent = this.agents.get(agentName);
                if (!agent) {
                    throw new Error(`Agent '${agentName}' not found`);
                }

                if ('executeStream' in agent && typeof agent.executeStream === 'function') {
                    const agentStream = await agent.executeStream(task);
                    if (agentStream) {
                        for await (const update of agentStream) {
                            yield {
                                type: 'agent_progress',
                                agent: agentName,
                                ...update
                            };
                        }
                    }
                } else {
                    yield {
                        type: 'agent_progress',
                        agent: agentName,
                        message: 'Agent does not support streaming'
                    };
                }
            }

            this.metrics.trackOperation('stream_complete');
            yield {
                type: 'complete',
                metrics: this.metrics.end()
            };
        } catch (error) {
            this.metrics.trackOperation('stream_error');
            yield {
                type: 'error',
                error: error instanceof Error ? error : new Error(String(error)),
                metrics: this.metrics.end()
            };
        }
    }
} 