import { BaseService } from './base';
import { ISymphony } from '../types/symphony';
import { ToolLifecycleState } from '../types/lifecycle';
import { ITeamService } from '../types/interfaces';
import { Team, TeamConfig, ToolLifecycleState as SDKToolLifecycleState } from '../types/sdk';

export class TeamService extends BaseService implements ITeamService {
    private teams: Map<string, Team> = new Map();

    constructor(symphony: ISymphony) {
        super(symphony, 'TeamService');
        this._dependencies = ['AgentService'];
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return this._dependencies;
    }

    async createTeam(name: string, config: TeamConfig): Promise<Team> {
        return this.withErrorHandling('createTeam', async () => {
            this.assertInitialized();
            
            if (this.teams.has(name)) {
                throw new Error(`Team ${name} already exists`);
            }

            // Validate team config
            await this.symphony.validation.validate(config, 'team');

            // Validate agent dependencies and convert agent configs to names
            const agentNames: string[] = [];
            for (const agent of config.agents) {
                if (typeof agent === 'string') {
                    await this.symphony.agent.getAgent(agent);
                    agentNames.push(agent);
                } else {
                    const agentInstance = await this.symphony.agent.createAgent(agent.name, agent);
                    agentNames.push(agentInstance.name);
                }
            }

            const team: Team = {
                name,
                description: config.description || `Team ${name}`,
                state: SDKToolLifecycleState.PENDING,
                agents: agentNames,
                run: async (input: any) => {
                    const startTime = Date.now();
                    try {
                        // Execute team logic
                        const agentResults = new Map<string, any>();
                        
                        // Execute each agent in sequence or parallel based on strategy
                        const maxParallel = config.strategy?.coordinationRules?.maxParallelTasks ?? agentNames.length;
                        const timeout = config.strategy?.coordinationRules?.taskTimeout ?? 30000;

                        // Create execution batches
                        const batches: string[][] = [];
                        for (let i = 0; i < agentNames.length; i += maxParallel) {
                            batches.push(agentNames.slice(i, i + maxParallel));
                        }

                        // Execute batches
                        for (const batch of batches) {
                            const batchPromises = batch.map(agentName => {
                                const agent = this.symphony.agent.getAgent(agentName);
                                return Promise.race([
                                    agent.then(a => a.run(input)),
                                    new Promise((_, reject) => 
                                        setTimeout(() => reject(new Error(`Task timeout for agent ${agentName}`)), timeout)
                                    )
                                ]);
                            });

                            const batchResults = await Promise.allSettled(batchPromises);
                            
                            // Process batch results
                            batch.forEach((agentName, index) => {
                                const result = batchResults[index];
                                if (result.status === 'fulfilled') {
                                    agentResults.set(agentName, result.value);
                                } else {
                                    agentResults.set(agentName, {
                                        success: false,
                                        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
                                    });
                                }
                            });

                            // Check if we should continue after errors
                            const hasErrors = Array.from(agentResults.values()).some(r => !r.success);
                            if (hasErrors && !config.strategy?.coordinationRules?.maxParallelTasks) {
                                break;
                            }
                        }

                        return {
                            success: true,
                            result: Object.fromEntries(agentResults),
                            metrics: {
                                duration: Date.now() - startTime,
                                startTime,
                                endTime: Date.now(),
                                agentResults: Object.fromEntries(agentResults)
                            }
                        };
                    } catch (error) {
                        return {
                            success: false,
                            error: error instanceof Error ? error.message : String(error),
                            metrics: {
                                duration: Date.now() - startTime,
                                startTime,
                                endTime: Date.now(),
                                agentResults: {}
                            }
                        };
                    }
                }
            };

            this.teams.set(name, team);
            return team;
        });
    }

    async getTeam(name: string): Promise<Team> {
        return this.withErrorHandling('getTeam', async () => {
            this.assertInitialized();
            
            const team = this.teams.get(name);
            if (!team) {
                throw new Error(`Team ${name} not found`);
            }
            return team;
        });
    }

    async listTeams(): Promise<string[]> {
        return this.withErrorHandling('listTeams', async () => {
            this.assertInitialized();
            return Array.from(this.teams.keys());
        });
    }

    protected async initializeInternal(): Promise<void> {
        this.logInfo('Initializing team service');
        this._state = ToolLifecycleState.READY;
    }
} 