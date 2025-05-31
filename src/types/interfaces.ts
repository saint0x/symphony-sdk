import { ToolLifecycleState } from './lifecycle';
import { ToolConfig, AgentConfig, TeamConfig, Pipeline, PipelineConfig, ToolResult } from './sdk';
import { ComponentInstance, ComponentMetadata, Component, ComponentPath } from './metadata';
import { AgentExecutor } from '../agents/executor';
import { TeamCoordinator } from '../teams/coordinator';
import { ToolRegistry } from '../tools/standard/registry';

export interface IService {
    readonly state: ToolLifecycleState;
    getDependencies(): string[];
}

export interface IToolService extends IService {
    create(config: ToolConfig): Promise<any>;
    execute(toolName: string, params: any): Promise<ToolResult>;
    getAvailable(): string[];
    getInfo(toolName: string): any;
    register(name: string, tool: any): void;
    get registry(): ToolRegistry;
    initialize(): Promise<void>;
}

export interface IAgentService extends IService {
    create(config: AgentConfig): Promise<AgentExecutor>;
    get(name: string): Promise<AgentExecutor | undefined>;
    initialize(): Promise<void>;
}

export interface ITeamService extends IService {
    create(config: TeamConfig): Promise<TeamCoordinator>;
    get(name: string): Promise<TeamCoordinator | undefined>;
    initialize(): Promise<void>;
}

export interface IPipelineService extends IService {
    create(config: PipelineConfig): Promise<Pipeline>;
    initialize(): Promise<void>;
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

export interface IValidationManager extends IService {
    validate(config: any, type: string): Promise<{ isValid: boolean; errors: string[] }>;
    initialize(): Promise<void>;
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