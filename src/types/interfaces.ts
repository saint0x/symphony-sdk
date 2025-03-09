import { ToolLifecycleState } from './lifecycle';
import { Tool, ToolConfig, Agent, AgentConfig, Team, TeamConfig, Pipeline, PipelineConfig } from './sdk';
import { ComponentInstance, ComponentMetadata, Component, ComponentPath } from './metadata';

export interface IService {
    readonly state: ToolLifecycleState;
    getDependencies(): string[];
}

export interface IToolService extends IService {
    createTool(name: string, config: ToolConfig): Promise<Tool>;
    getTool(name: string): Promise<Tool>;
    listTools(): Promise<string[]>;
}

export interface IAgentService extends IService {
    createAgent(name: string, config: AgentConfig): Promise<Agent>;
    getAgent(name: string): Promise<Agent>;
    listAgents(): Promise<string[]>;
}

export interface ITeamService extends IService {
    createTeam(name: string, config: TeamConfig): Promise<Team>;
    getTeam(name: string): Promise<Team>;
    listTeams(): Promise<string[]>;
}

export interface IPipelineService extends IService {
    createPipeline(name: string, config: PipelineConfig): Promise<Pipeline>;
    getPipeline(name: string): Promise<Pipeline>;
    listPipelines(): Promise<string[]>;
}

export interface IComponentService extends IService {
    createComponent(name: string, config: any): Promise<any>;
    getComponent(name: string): Promise<any>;
    listComponents(): Promise<string[]>;
}

export interface IValidationService extends IService {
    registerSchema(name: string, schema: any): Promise<void>;
    validate(data: any, schemaName: string): Promise<{ isValid: boolean; errors: string[] }>;
}

export interface IMetricsService extends IService {
    readonly startTime: number;
    start(id: string, metadata?: Record<string, any>): void;
    end(id: string, metadata?: Record<string, any>): void;
    get(id: string): any;
    update(id: string, metadata: Record<string, any>): void;
    getAll(): Record<string, any>;
}

export interface IValidationManager extends IValidationService {
    initialized: boolean;
    dependencies: string[];
    symphony: any;
    name: string;
    addSchema(name: string, schema: any): void;
    removeSchema(name: string): void;
    listSchemas(): string[];
}

export interface IRegistryService extends IService {
    register(name: string, service: any): void;
    unregister(name: string): void;
    get(name: string): any;
    list(): string[];
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

export interface IServiceBus extends IService {
    publish(topic: string, message: any, options?: any): Promise<void>;
    subscribe(topic: string, handler: (message: any) => Promise<void>): void;
    unsubscribe(topic: string, handler: (message: any) => Promise<void>): void;
}

export interface IComponentManager {
    register(metadata: ComponentMetadata, instance: Component): Promise<void>;
    findComponents(capability: string): ComponentInstance[];
    findOptimalPath(inputCapability: string, outputCapability: string): ComponentPath | null;
    getComponent(id: string): ComponentInstance | undefined;
    initialize(): Promise<void>;
} 