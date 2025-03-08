import { symphony } from '../sdk';
import type { Team, TeamResult, AgentConfig } from '../sdk';
import { tripleAddTool } from '../tools/calculator';

class CalculatorTeam {
    private team!: Team;
    private initialized: boolean = false;

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
                }
            ],
            requirements: [
                {
                    capability: symphony.types.CapabilityBuilder.agent('TOOL_USE'),
                    required: true
                }
            ],
            provides: ['team.arithmetic', 'team.parallel_processing'],
            tags: ['math', 'team', 'parallel', 'calculator']
        }, this);
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        // Ensure team service and tool are initialized
        await Promise.all([
            symphony.team.initialize(),
            tripleAddTool.initialize()
        ]);

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

        this.initialized = true;
    }

    async run(task: string, options?: { onProgress?: (update: { status: string }) => void }): Promise<TeamResult> {
        if (!this.initialized || !this.team) {
            await this.initialize();
        }
        return this.team.run(task, options);
    }
}

export const calculatorTeam = new CalculatorTeam(); 