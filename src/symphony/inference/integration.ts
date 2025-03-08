import {
    AgentConfig,
    ToolConfig,
    TeamConfig,
    PipelineConfig,
    ToolResult,
    PipelineStep
} from '../../types/sdk';
import { ComponentType } from '../../types/components';
import { ComponentCapability } from '../../types/metadata';
import { AgentPattern, ToolPattern, TeamPattern, PipelinePattern } from './types';
import { InferenceEngine } from './engine';
import { patternSystem } from './patterns';

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
        return {
            name: config.name || '',
            type: 'agent' as const,
            capabilities: [],
            metadata: {
                id: config.name || '',
                name: config.name || '',
                description: '',
                type: 'agent' as ComponentType,
                version: '1.0.0',
                capabilities: [] as ComponentCapability[],
                requirements: [],
                provides: [],
                tags: []
            },
            task: config.task || '',
            tools: (config.tools || []).map(t => typeof t === 'string' ? t : t.name),
            llm: config.llm || 'default'
        };
    }

    /**
     * Convert tool config to pattern
     */
    private toToolPattern(config: Partial<ToolConfig>): ToolPattern {
        const inferredTypes = patternSystem.inferTypes(config);
        
        return {
            name: config.name || '',
            type: 'tool' as const,
            capabilities: inferredTypes.capabilities,
            metadata: {
                id: config.name || '',
                name: config.name || '',
                description: config.description || '',
                type: 'tool' as ComponentType,
                version: '1.0.0',
                capabilities: [] as ComponentCapability[],
                requirements: [],
                provides: [],
                tags: []
            },
            inputs: config.inputs || inferredTypes.inputs,
            outputs: config.outputs || inferredTypes.outputs,
            validation: config.validation
        };
    }

    /**
     * Convert team config to pattern
     */
    private toTeamPattern(config: Partial<TeamConfig>): TeamPattern {
        return {
            name: config.name || '',
            type: 'team' as const,
            capabilities: [],
            metadata: {
                id: config.name || '',
                name: config.name || '',
                description: '',
                type: 'team' as ComponentType,
                version: '1.0.0',
                capabilities: [] as ComponentCapability[],
                requirements: [],
                provides: [],
                tags: []
            },
            agents: (config.agents || []).map(a => typeof a === 'string' ? a : a.name),
            strategy: config.strategy?.name
        };
    }

    /**
     * Convert pipeline config to pattern
     */
    private toPipelinePattern(config: Partial<PipelineConfig>): PipelinePattern {
        return {
            name: config.name || '',
            type: 'pipeline' as const,
            capabilities: [],
            metadata: {
                id: config.name || '',
                name: config.name || '',
                description: '',
                type: 'pipeline' as ComponentType,
                version: '1.0.0',
                capabilities: [] as ComponentCapability[],
                requirements: [],
                provides: [],
                tags: []
            },
            steps: (config.steps || []).map(s => s.name),
            validation: config.validation
        };
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
        const detectedPattern = patternSystem.detectPattern({
            name: pattern.name,
            inputs: pattern.inputs,
            outputs: pattern.outputs
        });

        const implementation = detectedPattern 
            ? patternSystem.getImplementation(detectedPattern.name)
            : undefined;

        return {
            name: pattern.name,
            description: pattern.metadata?.description || `A ${pattern.name} tool`,
            inputs: pattern.inputs || [],
            outputs: pattern.outputs || [],
            handler: implementation?.handler || (async () => ({
                success: true,
                result: {},
                error: undefined
            })),
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
            (await this.engine.inferConfig<AgentPattern>(base, 'agent')).base : 
            this.toAgentPattern(base);
        const enhanced = await this.engine.inferConfig<AgentPattern>({
            ...pattern,
            type: 'agent' as const
        }, 'agent').base;
        return this.fromAgentPattern(enhanced as AgentPattern);
    }

    /**
     * Enhance tool configuration
     */
    async enhanceTool(base: string | Partial<ToolConfig>): Promise<ToolConfig> {
        const pattern = typeof base === 'string' ? 
            (await this.engine.inferConfig<ToolPattern>(base, 'tool')).base : 
            this.toToolPattern(base);
        const enhanced = await this.engine.inferConfig<ToolPattern>({
            ...pattern,
            type: 'tool' as const
        }, 'tool').base;
        return this.fromToolPattern(enhanced as ToolPattern);
    }

    /**
     * Enhance team configuration
     */
    async enhanceTeam(base: string | Partial<TeamConfig>): Promise<TeamConfig> {
        const pattern = typeof base === 'string' ? 
            (await this.engine.inferConfig<TeamPattern>(base, 'team')).base : 
            this.toTeamPattern(base);
        const enhanced = await this.engine.inferConfig<TeamPattern>({
            ...pattern,
            type: 'team' as const
        }, 'team').base;
        return this.fromTeamPattern(enhanced as TeamPattern);
    }

    /**
     * Enhance pipeline configuration
     */
    async enhancePipeline(base: string | Partial<PipelineConfig>): Promise<PipelineConfig> {
        const pattern = typeof base === 'string' ? 
            (await this.engine.inferConfig<PipelinePattern>(base, 'pipeline')).base : 
            this.toPipelinePattern(base);
        const enhanced = await this.engine.inferConfig<PipelinePattern>({
            ...pattern,
            type: 'pipeline' as const
        }, 'pipeline').base;
        return this.fromPipelinePattern(enhanced as PipelinePattern);
    }
}

// Export singleton instance
export const symphonyInference = SymphonyInference.getInstance(); 