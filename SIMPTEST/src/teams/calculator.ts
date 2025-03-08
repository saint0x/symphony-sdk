import { symphony } from '../sdk';
import type { Team, TeamResult, AgentConfig } from '../sdk';
import { tripleAddTool } from '../tools/calculator';

class CalculatorTeam {
    private team!: Team;

    constructor() {
        return symphony.componentManager.register({
            id: 'calculatorTeam',
            name: 'Calculator Team',
            type: 'team',
            description: 'A team of calculator agents that work together on complex calculations',
            version: '1.0.0',
            capabilities: [
                {
                    name: symphony.types.CapabilityBuilder.team('COORDINATION'),
                    parameters: {
                        task: { type: 'string', required: true }
                    },
                    returns: {
                        type: 'object',
                        description: 'The results of parallel calculations'
                    }
                },
                {
                    name: symphony.types.CapabilityBuilder.processing('PARALLEL'),
                    parameters: {
                        inputs: { type: 'array', required: true }
                    }
                }
            ],
            requirements: [
                {
                    capability: symphony.types.CapabilityBuilder.agent('TOOL_USE'),
                    required: true
                },
                {
                    capability: symphony.types.CapabilityBuilder.numeric('ADD'),
                    required: true
                }
            ],
            provides: ['team.arithmetic', 'team.parallel_processing'],
            tags: ['math', 'team', 'parallel', 'calculator']
        }, this);
    }

    async initialize() {
        const agentConfig: AgentConfig = {
            name: 'calculator',
            description: 'Performs arithmetic calculations',
            task: 'Add three numbers together',
            tools: [tripleAddTool],
            llm: symphony.types.DEFAULT_LLM_CONFIG,
            maxCalls: 10,
            requireApproval: false,
            timeout: 30000
        };

        this.team = await symphony.team.create({
            name: 'Calculator Team',
            description: 'A team of calculator agents that work together to solve complex calculations',
            agents: [agentConfig.name]
        });
    }

    async run(task: string, options?: { onProgress?: (update: { status: string }) => void }): Promise<TeamResult> {
        return this.team.run(task, options);
    }
}

export const calculatorTeam = new CalculatorTeam(); 