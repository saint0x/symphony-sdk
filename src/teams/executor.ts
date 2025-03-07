import { TeamConfig, DelegationStrategy } from '../types/sdk';
import { ServiceRegistry } from '../proto/symphonic/core/types';
import { ContextManager } from '../proto/symphonic/core/cache/context';
import { ValidationManager } from '../proto/symphonic/core/cache/validation';
import { logger, LogCategory } from '../utils/logger';

export class TeamExecutor {
    private serviceRegistry: ServiceRegistry;
    private contextManager: ContextManager;
    private validationManager: ValidationManager;

    constructor(
        serviceRegistry: ServiceRegistry,
        contextManager: ContextManager,
        validationManager: ValidationManager
    ) {
        this.serviceRegistry = serviceRegistry;
        this.contextManager = contextManager;
        this.validationManager = validationManager;
    }

    public async execute(config: TeamConfig, input: { task: string } & Record<string, any>): Promise<any> {
        const executionId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            logger.debug(LogCategory.SYSTEM, 'Starting team execution', {
                metadata: {
                    team: config.name,
                    executionId,
                    input: Object.keys(input)
                }
            });

            // Record execution context
            await this.contextManager.recordExecutionContext(config.name, executionId, {
                type: 'TEAM_EXECUTION',
                team: config.name,
                input: Object.keys(input),
                agents: config.agents
            });

            // Validate input
            const validationResult = this.validationManager.validateServiceInput(input, ['task']);
            if (!validationResult.isValid) {
                throw new Error(`Invalid input: ${validationResult.errors[0].message}`);
            }

            // Convert agents to names
            const agentNames = await this.getAgentNames(config.agents);

            // Apply delegation strategy if present
            let selectedAgents = agentNames;
            if (config.delegationStrategy) {
                selectedAgents = await this.applyStrategy(config.delegationStrategy, input.task, agentNames);
            }

            // Execute with selected agents
            const results = [];
            for (const agentName of selectedAgents) {
                const agent = this.serviceRegistry.getService(agentName);
                if (!agent) {
                    throw new Error(`Agent not found: ${agentName}`);
                }

                const result = await this.serviceRegistry.executeCall(
                    agentName,
                    'execute',
                    input
                );

                results.push({
                    agent: agentName,
                    status: result.success ? 'completed' : 'failed',
                    data: result.data,
                    error: result.error
                });
            }

            return {
                success: true,
                agents: selectedAgents,
                results
            };

        } catch (error: any) {
            logger.error(LogCategory.SYSTEM, 'Team execution failed', {
                metadata: {
                    team: config.name,
                    executionId,
                    error: error.message,
                    stack: error.stack
                }
            });

            // Record error context
            await this.contextManager.recordErrorContext(config.name, error, {
                executionId,
                input: Object.keys(input)
            });

            throw error;
        }
    }

    private async getAgentNames(agents: Array<string | { 
        name: string; 
        executeStream?: (input: { task: string } & Record<string, any>) => AsyncGenerator<any>;
    }>): Promise<string[]> {
        return agents.map(agent => typeof agent === 'string' ? agent : agent.name);
    }

    private async applyStrategy(strategy: DelegationStrategy, task: string, agents: string[]): Promise<string[]> {
        if (strategy.type === 'custom' && strategy.customLogic) {
            return strategy.customLogic(task, agents);
        }

        const rules = strategy.rules || [];
        if (rules.length === 0) {
            return agents; // Default to using all agents if no rules
        }

        const matchedRules = rules.filter(rule => {
            return rule.condition.toLowerCase().includes(task.toLowerCase());
        });

        if (matchedRules.length === 0) {
            return agents;
        }

        // Combine assignTo arrays from all matched rules
        const assignedAgents = Array.from(new Set(
            matchedRules.flatMap(rule => rule.assignTo)
        )).filter(agent => typeof agent === 'string');

        return assignedAgents.filter(agent => agents.includes(agent));
    }
} 