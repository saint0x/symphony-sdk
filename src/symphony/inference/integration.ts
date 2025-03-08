import {
    AgentConfig,
    ToolConfig,
    TeamConfig,
    PipelineConfig,
    ToolResult,
    PipelineStep
} from '../../types/sdk';
import { ComponentType } from '../../types/components';
import { AgentPattern, ToolPattern, TeamPattern, PipelinePattern } from './types';
import { InferenceEngine } from './engine';

/**
 * Symphony inference integration
 */
export class SymphonyInference {
    private static instance: SymphonyInference;
    private engine: InferenceEngine;

    private constructor() {
        this.engine = InferenceEngine.getInstance();
    }

    public static getInstance(): SymphonyInference {
        if (!SymphonyInference.instance) {
            SymphonyInference.instance = new SymphonyInference();
        }
        return SymphonyInference.instance;
    }

    /**
     * Convert agent config to pattern
     */
    private toAgentPattern(config: Partial<AgentConfig>): AgentPattern {
        const pattern: AgentPattern = {
            name: config.name || '',
            type: 'agent',
            capabilities: [],
            metadata: {
                id: config.name || '',
                name: config.name || '',
                description: '',
                type: 'agent' as ComponentType,
                version: '1.0.0',
                capabilities: [],
                requirements: [],
                provides: [],
                tags: []
            },
            task: config.task || '',
            tools: (config.tools || []).map(t => typeof t === 'string' ? t : t.name),
            llm: config.llm || 'default'
        };
        return pattern;
    }

    /**
     * Convert tool config to pattern
     */
    private toToolPattern(config: Partial<ToolConfig>): ToolPattern {
        const pattern: ToolPattern = {
            name: config.name || '',
            type: 'tool',
            capabilities: [],
            metadata: {
                id: config.name || '',
                name: config.name || '',
                description: '',
                type: 'tool' as ComponentType,
                version: '1.0.0',
                capabilities: [],
                requirements: [],
                provides: [],
                tags: []
            },
            inputs: config.inputs || [],
            outputs: config.outputs || [],
            validation: config.validation
        };
        return pattern;
    }

    /**
     * Convert team config to pattern
     */
    private toTeamPattern(config: Partial<TeamConfig>): TeamPattern {
        const pattern: TeamPattern = {
            name: config.name || '',
            type: 'team',
            capabilities: [],
            metadata: {
                id: config.name || '',
                name: config.name || '',
                description: '',
                type: 'team' as ComponentType,
                version: '1.0.0',
                capabilities: [],
                requirements: [],
                provides: [],
                tags: []
            },
            agents: (config.agents || []).map(a => typeof a === 'string' ? a : a.name),
            strategy: config.strategy?.name
        };
        return pattern;
    }

    /**
     * Convert pipeline config to pattern
     */
    private toPipelinePattern(config: Partial<PipelineConfig>): PipelinePattern {
        const pattern: PipelinePattern = {
            name: config.name || '',
            type: 'pipeline',
            capabilities: [],
            metadata: {
                id: config.name || '',
                name: config.name || '',
                description: '',
                type: 'pipeline' as ComponentType,
                version: '1.0.0',
                capabilities: [],
                requirements: [],
                provides: [],
                tags: []
            },
            steps: (config.steps || []).map(s => s.name),
            validation: config.validation
        };
        return pattern;
    }

    /**
     * Convert pattern to agent config
     */
    private fromAgentPattern(pattern: AgentPattern): AgentConfig {
        return {
            name: pattern.name,
            description: pattern.metadata.description,
            task: pattern.task,
            tools: pattern.tools,
            llm: typeof pattern.llm === 'string' ? {
                provider: 'openai',
                model: 'gpt-4',
                apiKey: process.env.OPENAI_API_KEY || ''
            } : pattern.llm,
            capabilities: pattern.capabilities,
            handler: async () => ({
                success: true,
                result: {},
                error: undefined
            })
        };
    }

    /**
     * Convert pattern to tool config
     */
    private fromToolPattern(pattern: ToolPattern): ToolConfig {
        return {
            name: pattern.name,
            description: pattern.metadata.description,
            inputs: pattern.inputs,
            outputs: pattern.outputs,
            handler: async () => ({
                success: true,
                result: {},
                error: undefined
            } as ToolResult),
            validation: pattern.validation
        };
    }

    /**
     * Convert pattern to team config
     */
    private fromTeamPattern(pattern: TeamPattern): TeamConfig {
        return {
            name: pattern.name,
            description: pattern.metadata.description,
            agents: pattern.agents,
            strategy: pattern.strategy ? {
                name: pattern.strategy,
                description: `Strategy ${pattern.strategy}`,
                assignmentLogic: async (task: string, agents: string[]) => {
                    // Simple strategy: assign all agents to all tasks
                    console.log(`Assigning task: ${task} to agents: ${agents.join(', ')}`);
                    return agents;
                },
                coordinationRules: {
                    maxParallelTasks: 5,
                    taskTimeout: 30000
                }
            } : undefined,
            manager: false,
            log: {
                inputs: true,
                outputs: true
            }
        };
    }

    /**
     * Convert pattern to pipeline config
     */
    private fromPipelinePattern(pattern: PipelinePattern): PipelineConfig {
        return {
            name: pattern.name,
            description: pattern.metadata.description,
            steps: pattern.steps.map(stepName => ({
                id: stepName,
                name: stepName,
                description: `Step ${stepName}`,
                tool: stepName,
                inputs: {},
                outputs: {},
                chained: 0,
                expects: {},
                handler: async () => ({
                    success: true,
                    result: {},
                    error: undefined
                } as ToolResult)
            } as PipelineStep)),
            validation: pattern.validation,
            metrics: {
                enabled: true,
                detailed: true,
                trackMemory: true
            }
        };
    }

    /**
     * Enhance agent configuration
     */
    async enhanceAgent(base: string | Partial<AgentConfig>): Promise<AgentConfig> {
        const pattern = typeof base === 'string' ? 
            await this.engine.inferConfig<AgentPattern>(base, 'agent').base : 
            this.toAgentPattern(base);
        const enhanced = await this.engine.inferConfig<AgentPattern>(pattern, 'agent').base;
        return this.fromAgentPattern(enhanced);
    }

    /**
     * Enhance tool configuration
     */
    async enhanceTool(base: string | Partial<ToolConfig>): Promise<ToolConfig> {
        const pattern = typeof base === 'string' ? 
            await this.engine.inferConfig<ToolPattern>(base, 'tool').base : 
            this.toToolPattern(base);
        const enhanced = await this.engine.inferConfig<ToolPattern>(pattern, 'tool').base;
        return this.fromToolPattern(enhanced);
    }

    /**
     * Enhance team configuration
     */
    async enhanceTeam(base: string | Partial<TeamConfig>): Promise<TeamConfig> {
        const pattern = typeof base === 'string' ? 
            await this.engine.inferConfig<TeamPattern>(base, 'team').base : 
            this.toTeamPattern(base);
        const enhanced = await this.engine.inferConfig<TeamPattern>(pattern, 'team').base;
        return this.fromTeamPattern(enhanced);
    }

    /**
     * Enhance pipeline configuration
     */
    async enhancePipeline(base: string | Partial<PipelineConfig>): Promise<PipelineConfig> {
        const pattern = typeof base === 'string' ? 
            await this.engine.inferConfig<PipelinePattern>(base, 'pipeline').base : 
            this.toPipelinePattern(base);
        const enhanced = await this.engine.inferConfig<PipelinePattern>(pattern, 'pipeline').base;
        return this.fromPipelinePattern(enhanced);
    }
}

// Export singleton instance
export const symphonyInference = SymphonyInference.getInstance(); 