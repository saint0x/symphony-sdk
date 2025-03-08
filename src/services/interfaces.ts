import { BaseManager } from '../managers/base';
import { ISymphony as CoreSymphony } from '../symphony/interfaces/types';

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
    create(config: {
        name: string;
        description: string;
        inputs: string[];
        handler: (params: any) => Promise<any>;
    }): Promise<any>;
}

export interface IAgentService extends BaseManager {
    create(config: {
        name: string;
        description: string;
        task: string;
        tools: any[];
        llm: {
            provider: string;
            model: string;
            temperature?: number;
            maxTokens?: number;
        };
        maxCalls?: number;
        requireApproval?: boolean;
        timeout?: number;
    }): Promise<any>;
}

export interface ITeamService extends BaseManager {
    create(config: {
        name: string;
        description: string;
        agents: string[];
    }): Promise<any>;
}

export interface IPipelineService extends BaseManager {
    create(config: {
        name: string;
        description: string;
        steps: {
            name: string;
            description: string;
            handler: (params: any) => Promise<any>;
        }[];
    }): Promise<any>;
}

export class ToolService extends BaseManager implements IToolService {
    constructor(symphony: CoreSymphony) {
        super(symphony as any, 'ToolService');
    }

    async create(_config: {
        name: string;
        description: string;
        inputs: string[];
        handler: (params: any) => Promise<any>;
    }): Promise<any> {
        throw new Error('Not implemented');
    }
}

export class AgentService extends BaseManager implements IAgentService {
    constructor(symphony: CoreSymphony) {
        super(symphony as any, 'AgentService');
    }

    async create(_config: {
        name: string;
        description: string;
        task: string;
        tools: any[];
        llm: {
            provider: string;
            model: string;
            temperature?: number;
            maxTokens?: number;
        };
        maxCalls?: number;
        requireApproval?: boolean;
        timeout?: number;
    }): Promise<any> {
        throw new Error('Not implemented');
    }
}

export class PipelineService extends BaseManager implements IPipelineService {
    constructor(symphony: CoreSymphony) {
        super(symphony as any, 'PipelineService');
    }

    async create(_config: {
        name: string;
        description: string;
        steps: {
            name: string;
            description: string;
            handler: (params: any) => Promise<any>;
        }[];
    }): Promise<any> {
        throw new Error('Not implemented');
    }
} 