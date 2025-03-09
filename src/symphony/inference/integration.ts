import {
    AgentConfig,
    ToolConfig,
    TeamConfig,
    PipelineConfig
} from '../../types/sdk';
import { ComponentType } from '../../types/components';
import { AgentPattern, ToolPattern, TeamPattern, PipelinePattern, InferencePattern } from './types';
import { InferenceEngine } from './engine';
import { patternSystem } from './patterns';

interface NamedConfig {
    name: string;
    [key: string]: any;
}

function isNamedConfig(value: any): value is NamedConfig {
    return value && typeof value === 'object' && typeof value.name === 'string';
}

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
        const capabilities = config.capabilities || [];
        const tools = Array.isArray(config.tools) 
            ? config.tools.map(t => {
                if (typeof t === 'string') return t;
                return isNamedConfig(t as any) ? (t as NamedConfig).name : '';
            }).filter(Boolean)
            : [];
        
        return {
            name: config.name || 'default_agent',
            type: 'agent' as const,
            capabilities,
            metadata: {
                id: config.name || 'default_agent',
                name: config.name || 'default_agent',
                description: config.description || '',
                type: 'agent' as ComponentType,
                version: '1.0.0',
                capabilities: capabilities.map(cap => ({ name: cap })),
                requirements: [],
                provides: [],
                tags: []
            },
            task: config.task || 'default_task',
            tools,
            llm: config.llm || {
                model: 'gpt-4',
                provider: 'openai'
            }
        };
    }

    /**
     * Convert tool config to pattern
     */
    private toToolPattern(config: Partial<ToolConfig>): ToolPattern {
        const inferredTypes = patternSystem.inferTypes(config);
        const capabilities = inferredTypes.capabilities || [];
        
        return {
            name: config.name || 'default_tool',
            type: 'tool' as const,
            capabilities,
            metadata: {
                id: config.name || 'default_tool',
                name: config.name || 'default_tool',
                description: config.description || '',
                type: 'tool' as ComponentType,
                version: '1.0.0',
                capabilities: capabilities.map(cap => ({ name: cap })),
                requirements: [],
                provides: [],
                tags: []
            },
            inputs: ['input'],  // Default input
            outputs: ['output'], // Default output
            apiKey: config.apiKey,
            timeout: config.timeout,
            retryCount: config.retryCount,
            maxSize: config.maxSize,
            config: {}
        };
    }

    /**
     * Convert team config to pattern
     */
    private toTeamPattern(config: Partial<TeamConfig>): TeamPattern {
        const capabilities = config.capabilities || [];
        const agents = Array.isArray(config.agents)
            ? config.agents.map(a => {
                if (typeof a === 'string') return a;
                return isNamedConfig(a as any) ? (a as NamedConfig).name : '';
            }).filter(Boolean)
            : [];
        
        return {
            name: config.name || 'default_team',
            type: 'team' as const,
            capabilities,
            metadata: {
                id: config.name || 'default_team',
                name: config.name || 'default_team',
                description: config.description || '',
                type: 'team' as ComponentType,
                version: '1.0.0',
                capabilities: capabilities.map(cap => ({ name: cap })),
                requirements: [],
                provides: [],
                tags: []
            },
            agents,
            config: {}
        };
    }

    /**
     * Convert pipeline config to pattern
     */
    private toPipelinePattern(config: Partial<PipelineConfig>): PipelinePattern {
        const capabilities: string[] = [];
        const steps = Array.isArray(config.steps)
            ? config.steps.map(s => ({
                name: s.name || 'default_step',
                type: s.type || 'tool',
                tool: s.tool || '',
                agent: s.agent,
                team: s.team,
                input: Array.isArray(s.input) ? s.input : [],
                config: s.config || {},
                retryConfig: s.retryConfig,
                retry: s.retry,
                chained: s.chained,
                expects: s.expects || {},
                outputs: s.outputs || {},
                conditions: s.conditions,
                inputMap: s.inputMap,
                handler: s.handler
            }))
            : [];
        
        return {
            name: config.name || 'default_pipeline',
            type: 'pipeline' as const,
            capabilities,
            metadata: {
                id: config.name || 'default_pipeline',
                name: config.name || 'default_pipeline',
                description: config.description || '',
                type: 'pipeline' as ComponentType,
                version: '1.0.0',
                capabilities: capabilities.map(cap => ({ name: cap })),
                requirements: [],
                provides: [],
                tags: []
            },
            steps,
            onError: config.onError,
            errorStrategy: config.errorStrategy,
            metrics: config.metrics || {
                enabled: true,
                detailed: true,
                trackMemory: true
            },
            config: {}
        };
    }

    /**
     * Convert pattern to agent config
     */
    private fromAgentPattern(pattern: AgentPattern & InferencePattern): AgentConfig {
        return {
            name: pattern.name,
            description: pattern.metadata.description,
            task: pattern.task,
            tools: pattern.tools,
            llm: pattern.llm,
            capabilities: pattern.capabilities
        };
    }

    /**
     * Convert pattern to tool config
     */
    private fromToolPattern(pattern: ToolPattern & InferencePattern): ToolConfig {
        return {
            name: pattern.name,
            description: pattern.metadata.description,
            type: pattern.type,
            apiKey: pattern.apiKey,
            timeout: pattern.timeout,
            retryCount: pattern.retryCount,
            maxSize: pattern.maxSize,
            config: pattern.config || {}
        };
    }

    /**
     * Convert pattern to team config
     */
    private fromTeamPattern(pattern: TeamPattern & InferencePattern): TeamConfig {
        return {
            name: pattern.name,
            description: pattern.metadata.description,
            agents: pattern.agents,
            capabilities: pattern.capabilities
        };
    }

    /**
     * Convert pattern to pipeline config
     */
    private fromPipelinePattern(pattern: PipelinePattern & InferencePattern): PipelineConfig {
        return {
            name: pattern.name,
            description: pattern.metadata.description,
            steps: pattern.steps,
            onError: pattern.onError,
            errorStrategy: pattern.errorStrategy,
            metrics: pattern.metrics || {
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
        const inferredPattern = typeof base === 'string' 
            ? await this.engine.inferConfig<AgentPattern>(base, 'agent')
            : { base: this.toAgentPattern(base) };

        const pattern = inferredPattern.base as AgentPattern & InferencePattern;
        return this.fromAgentPattern(pattern);
    }

    /**
     * Enhance tool configuration
     */
    async enhanceTool(base: string | Partial<ToolConfig>): Promise<ToolConfig> {
        const inferredPattern = typeof base === 'string'
            ? await this.engine.inferConfig<ToolPattern>(base, 'tool')
            : { base: this.toToolPattern(base) };

        const pattern = inferredPattern.base as ToolPattern & InferencePattern;
        return this.fromToolPattern(pattern);
    }

    /**
     * Enhance team configuration
     */
    async enhanceTeam(base: string | Partial<TeamConfig>): Promise<TeamConfig> {
        const inferredPattern = typeof base === 'string'
            ? await this.engine.inferConfig<TeamPattern>(base, 'team')
            : { base: this.toTeamPattern(base) };

        const pattern = inferredPattern.base as TeamPattern & InferencePattern;
        return this.fromTeamPattern(pattern);
    }

    /**
     * Enhance pipeline configuration
     */
    async enhancePipeline(base: string | Partial<PipelineConfig>): Promise<PipelineConfig> {
        const inferredPattern = typeof base === 'string'
            ? await this.engine.inferConfig<PipelinePattern>(base, 'pipeline')
            : { base: this.toPipelinePattern(base) };

        const pattern = inferredPattern.base as PipelinePattern & InferencePattern;
        return this.fromPipelinePattern(pattern);
    }
}

// Export singleton instance
export const symphonyInference = SymphonyInference.getInstance(); 