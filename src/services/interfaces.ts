import { BaseManager } from '../managers/base';
import { ISymphony as CoreSymphony } from '../symphony/interfaces/types';
import {
    Agent,
    Tool,
    Team,
    Pipeline,
    AgentConfig,
    ToolConfig,
    TeamConfig,
    PipelineConfig
} from '../types/sdk';

export interface ISymphony extends BaseManager {
    readonly tools: IToolService;
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
    constructor(symphony: CoreSymphony) {
        super(symphony as any, 'ToolService');
    }

    async create(input: string | Partial<ToolConfig>): Promise<Tool> {
        throw new Error('Not implemented');
    }
}

export class AgentService extends BaseManager implements IAgentService {
    constructor(symphony: CoreSymphony) {
        super(symphony as any, 'AgentService');
    }

    async create(input: string | Partial<AgentConfig>): Promise<Agent> {
        throw new Error('Not implemented');
    }
}

export class PipelineService extends BaseManager implements IPipelineService {
    constructor(symphony: CoreSymphony) {
        super(symphony as any, 'PipelineService');
    }

    async create(input: string | Partial<PipelineConfig>): Promise<Pipeline> {
        throw new Error('Not implemented');
    }
} 