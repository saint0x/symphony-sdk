import { ToolLifecycleState } from '../types/lifecycle';
import { Tool, Agent, Team, Pipeline } from '../types/sdk';

export interface IService {
    readonly state: ToolLifecycleState;
    initialize(): Promise<void>;
    getDependencies(): string[];
}

export interface IToolService extends IService {
    createTool(name: string, config: any): Promise<Tool>;
    getTool(name: string): Promise<Tool>;
    listTools(): Promise<string[]>;
}

export interface IAgentService extends IService {
    createAgent(name: string, config: any): Promise<Agent>;
    getAgent(name: string): Promise<Agent>;
    listAgents(): Promise<string[]>;
}

export interface ITeamService extends IService {
    createTeam(name: string, config: any): Promise<Team>;
    getTeam(name: string): Promise<Team>;
    listTeams(): Promise<string[]>;
}

export interface IPipelineService extends IService {
    createPipeline(name: string, config: any): Promise<Pipeline>;
    getPipeline(name: string): Promise<Pipeline>;
    listPipelines(): Promise<string[]>;
}

export interface IComponentService extends IService {
    createComponent(name: string, config: any): Promise<any>;
    getComponent(name: string): Promise<any>;
    listComponents(): Promise<string[]>;
}

export interface IRegistryService extends IService {
    register(name: string, service: any): void;
    unregister(name: string): void;
    get(name: string): any;
    list(): string[];
}

export interface IValidationService extends IService {
    validate(data: any, schema: string): Promise<boolean>;
    addSchema(name: string, schema: any): void;
    removeSchema(name: string): void;
    listSchemas(): string[];
}

export interface IContextService extends IService {
    set(key: string, value: any): void;
    get(key: string): any;
    delete(key: string): void;
    clear(): void;
}

export interface ILLMService extends IService {
    complete(prompt: string, options?: any): Promise<string>;
    stream(prompt: string, options?: any): AsyncIterableIterator<string>;
}

export interface IMetricsService extends IService {
    readonly startTime: number;
    start(id: string, metadata?: Record<string, any>): void;
    end(id: string, metadata?: Record<string, any>): void;
    get(id: string): any;
    update(id: string, metadata: Record<string, any>): void;
    getAll(): Record<string, any>;
    clear(): void;
}

export interface IServiceBus extends IService {
    publish(topic: string, message: any, options?: any): Promise<void>;
    subscribe(topic: string, handler: (message: any) => Promise<void>): void;
    unsubscribe(topic: string, handler: (message: any) => Promise<void>): void;
} 