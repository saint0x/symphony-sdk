import { BaseManager } from '../managers/base';
import {
    Tool,
    Agent,
    Team,
    Pipeline,
    ToolConfig,
    AgentConfig,
    TeamConfig,
    PipelineConfig,
    ToolResult,
    AgentResult,
    PipelineResult
} from '../types/sdk';

export interface ISymphony extends BaseManager {
    readonly tool: IToolService;
    readonly agent: IAgentService;
    readonly team: ITeamService;
    readonly pipeline: IPipelineService;
    readonly components: BaseManager;
    readonly validation: BaseManager;
    readonly metrics: {
        startTime: number;
        start(id: string, metadata?: Record<string, any>): void;
        end(id: string, metadata?: Record<string, any>): void;
        get(id: string): Record<string, any> | undefined;
        update(id: string, metadata: Record<string, any>): void;
        getAll(): Record<string, any>;
    };
    readonly utils: {
        validation: {
            validate(data: any, schema: string): Promise<any>;
        };
        metrics: {
            start(id: string, metadata?: Record<string, any>): void;
            end(id: string, metadata?: Record<string, any>): void;
            get(id: string): Record<string, any> | undefined;
        };
    };
    readonly logger: {
        debug(category: string, message: string, data?: any): void;
        info(category: string, message: string, data?: any): void;
        warn(category: string, message: string, data?: any): void;
        error(category: string, message: string, data?: any): void;
    };
    getRegistry(): Promise<any>;
    startMetric(metricId: string, metadata?: Record<string, any>): void;
    endMetric(metricId: string, metadata?: Record<string, any>): void;
    getMetric(metricId: string): Record<string, any> | undefined;
}

export interface IToolService extends BaseManager {
    create(input: string | Partial<ToolConfig>): Promise<Tool>;
}

export interface IAgentService extends BaseManager {
    create(input: string | Partial<AgentConfig>): Promise<Agent>;
}

export interface ITeamService extends BaseManager {
    create(input: string | Partial<TeamConfig>): Promise<Team>;
}

export interface IPipelineService extends BaseManager {
    create(input: string | Partial<PipelineConfig>): Promise<Pipeline>;
}

export class ToolService extends BaseManager implements IToolService {
    constructor(symphony: any) {
        super(symphony, 'ToolService');
    }

    async create(input: string | Partial<ToolConfig>): Promise<Tool> {
        const config = typeof input === 'string' ? { 
            name: input,
            description: `Tool ${input}`,
            inputs: []
        } : input;
        
        return {
            id: `tool_${Date.now()}`,
            name: config.name || 'unnamed_tool',
            description: config.description || '',
            run: async (params: any): Promise<ToolResult<any>> => {
                const startTime = Date.now();
                return {
                    success: true,
                    result: { params },
                    metrics: {
                        duration: Date.now() - startTime,
                        startTime,
                        endTime: Date.now()
                    }
                };
            }
        };
    }
}

export class AgentService extends BaseManager implements IAgentService {
    constructor(symphony: any) {
        super(symphony, 'AgentService');
    }

    async create(input: string | Partial<AgentConfig>): Promise<Agent> {
        const config = typeof input === 'string' ? {
            name: input,
            description: `Agent ${input}`,
            task: '',
            tools: [],
            capabilities: []
        } : input;

        return {
            id: `agent_${Date.now()}`,
            name: config.name || 'unnamed_agent',
            description: config.description || '',
            task: config.task || '',
            tools: config.tools || [],
            run: async (task: string): Promise<AgentResult<any>> => {
                const startTime = Date.now();
                return {
                    success: true,
                    result: { completedTask: task },
                    metrics: {
                        duration: Date.now() - startTime,
                        startTime,
                        endTime: Date.now(),
                        toolCalls: 0
                    }
                };
            }
        };
    }
}

export class PipelineService extends BaseManager implements IPipelineService {
    constructor(symphony: any) {
        super(symphony, 'PipelineService');
    }

    async create(input: string | Partial<PipelineConfig>): Promise<Pipeline> {
        const config = typeof input === 'string' ? {
            name: input,
            description: `Pipeline ${input}`,
            steps: []
        } : input;

        return {
            id: `pipeline_${Date.now()}`,
            name: config.name || 'unnamed_pipeline',
            description: config.description || '',
            steps: config.steps || [],
            run: async (input: any): Promise<PipelineResult> => {
                const startTime = Date.now();
                return {
                    success: true,
                    result: { processedInput: input },
                    metrics: {
                        duration: Date.now() - startTime,
                        startTime,
                        endTime: Date.now(),
                        stepResults: {}
                    }
                };
            }
        };
    }
} 