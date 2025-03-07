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

    public async execute(config: TeamConfig, input: any): Promise<any> {
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

            // Load team agents
            const agents = await this.loadAgents(config.agents);

            // Determine execution strategy
            const strategy = this.determineStrategy(config);

            // Execute based on strategy
            let result;
            switch (strategy.type) {
                case 'round-robin':
                    result = await this.executeRoundRobin(agents, input, strategy);
                    break;
                case 'capability-based':
                    result = await this.executeCapabilityBased(agents, input, strategy);
                    break;
                case 'load-balanced':
                    result = await this.executeLoadBalanced(agents, input, strategy);
                    break;
                default:
                    throw new Error(`Unknown delegation strategy: ${strategy.type}`);
            }

            return {
                success: true,
                result
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

    private async loadAgents(agentIds: string[]) {
        const agents = [];
        for (const id of agentIds) {
            const agent = this.serviceRegistry.getService(id);
            if (!agent) {
                throw new Error(`Agent not found: ${id}`);
            }
            agents.push(agent);
        }
        return agents;
    }

    private determineStrategy(config: TeamConfig): DelegationStrategy {
        if (!config.delegationStrategy) {
            // Default to round-robin if no strategy specified
            return {
                type: 'round-robin',
                rules: []
            };
        }
        return config.delegationStrategy;
    }

    private async executeRoundRobin(agents: any[], input: any, strategy: DelegationStrategy): Promise<any> {
        const results = [];
        let currentIndex = 0;

        // Filter agents based on strategy rules if any are defined
        const eligibleAgents = strategy.rules.length > 0 
            ? agents.filter(agent => 
                strategy.rules.some(rule => rule.assignTo.includes(agent.metadata.name))
            )
            : agents;

        if (eligibleAgents.length === 0) {
            throw new Error('No eligible agents found for execution');
        }

        // Execute each agent in rotation
        for (let i = 0; i < eligibleAgents.length; i++) {
            // Get next agent in rotation
            const agent = eligibleAgents[currentIndex];
            currentIndex = (currentIndex + 1) % eligibleAgents.length;

            // Execute agent
            const result = await this.serviceRegistry.executeCall(
                agent.metadata.id,
                'run',
                input
            );

            if (!result.success) {
                throw new Error(`Agent execution failed: ${result.error?.message}`);
            }

            results.push({
                agent: agent.metadata.name,
                result: result.data
            });
        }

        return results;
    }

    private async executeCapabilityBased(agents: any[], input: any, strategy: DelegationStrategy): Promise<any> {
        const results = [];

        // Execute agents based on their capabilities and strategy rules
        for (const agent of agents) {
            // Check if agent has required capabilities based on strategy rules
            const capabilities = agent.metadata.customMetadata?.capabilities || [];
            const matchingRules = strategy.rules.filter(r => 
                capabilities.includes(r.condition) && 
                r.assignTo.includes(agent.metadata.name)
            );

            if (matchingRules.length > 0) {
                const result = await this.serviceRegistry.executeCall(
                    agent.metadata.id,
                    'run',
                    input
                );

                if (!result.success) {
                    throw new Error(`Agent execution failed: ${result.error?.message}`);
                }

                results.push({
                    agent: agent.metadata.name,
                    capabilities: matchingRules.map(r => r.condition),
                    appliedRules: matchingRules.length,
                    result: result.data
                });
            }
        }

        return results;
    }

    private async executeLoadBalanced(agents: any[], input: any, strategy: DelegationStrategy): Promise<any> {
        const results = [];
        const loads = new Map<string, number>();

        // Get agent loads
        for (const agent of agents) {
            const health = this.serviceRegistry.getServiceHealth(agent.metadata.id);
            const currentLoad = health?.metrics.averageLatency || 0;
            loads.set(agent.metadata.id, currentLoad);
        }

        // Find agents assigned in the strategy rules
        const assignedAgents = agents.filter(agent => 
            strategy.rules.some(rule => rule.assignTo.includes(agent.metadata.name))
        );

        // If no specific assignments, use all agents
        const eligibleAgents = assignedAgents.length > 0 ? assignedAgents : agents;

        // Sort agents by load and execute
        const sortedAgents = eligibleAgents
            .sort((a, b) => (loads.get(a.metadata.id) || 0) - (loads.get(b.metadata.id) || 0))
            .slice(0, Math.max(1, Math.floor(eligibleAgents.length / 2)));

        for (const agent of sortedAgents) {
            const result = await this.serviceRegistry.executeCall(
                agent.metadata.id,
                'run',
                input
            );

            if (!result.success) {
                throw new Error(`Agent execution failed: ${result.error?.message}`);
            }

            // Update load
            loads.set(agent.metadata.id, (loads.get(agent.metadata.id) || 0) + result.metrics.duration);

            results.push({
                agent: agent.metadata.name,
                load: loads.get(agent.metadata.id),
                result: result.data
            });
        }

        return results;
    }
} 