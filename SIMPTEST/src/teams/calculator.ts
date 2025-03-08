import { symphony } from '../sdk';
import { tripleAddTool } from '../tools/calculator';
import { Team, TeamResult } from 'symphonic/types';
import { SymphonyComponentManager } from '../core/component-manager';
import { CapabilityBuilder, CommonCapabilities } from '../core/component-manager/types/metadata';
import { DEFAULT_LLM_CONFIG } from '../core/component-manager/types/config';

class CalculatorTeam {
    private team: Team;

    constructor() {
        return SymphonyComponentManager.getInstance().register({
            id: 'calculatorTeam',
            name: 'Calculator Team',
            type: 'team',
            description: 'A team of calculator agents that work together on complex calculations',
            version: '1.0.0',
            capabilities: [
                {
                    name: CapabilityBuilder.team('COORDINATION'),
                    parameters: {
                        task: { type: 'string', required: true }
                    },
                    returns: {
                        type: 'object',
                        description: 'The results of parallel calculations'
                    }
                },
                {
                    name: CapabilityBuilder.processing('PARALLEL'),
                    parameters: {
                        inputs: { type: 'array', required: true }
                    }
                }
            ],
            requirements: [
                {
                    capability: CapabilityBuilder.agent('TOOL_USE'),
                    required: true
                },
                {
                    capability: CapabilityBuilder.numeric('ADD'),
                    required: true
                }
            ],
            provides: ['team.arithmetic', 'team.parallel_processing'],
            tags: ['math', 'team', 'parallel', 'calculator']
        }, this);
    }

    async initialize() {
        const agentConfig = {
            name: 'calculator',
            description: 'Performs arithmetic calculations',
            task: 'Add three numbers together',
            tools: [tripleAddTool],
            llm: DEFAULT_LLM_CONFIG
        };

        this.team = await symphony.team.createTeam({
            name: 'Calculator Team',
            description: 'A team of calculator agents that work together to solve complex calculations',
            agents: [agentConfig],
            strategy: {
                type: 'parallel',
                maxConcurrent: 3,
                retryAttempts: 2
            }
        });
    }

    async run(task: string, options?: { onProgress?: (update: { status: string }) => void }): Promise<TeamResult> {
        return this.team.run(task, options);
    }
}

export const calculatorTeam = new CalculatorTeam(); 