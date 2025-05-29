import { ISymphony, SymphonyConfig, IMetricsAPI } from './types/symphony';
import { ToolLifecycleState } from './types/sdk';
import { Logger } from './utils/logger';
import { LLMHandler } from './llm/handler';
import { AgentExecutor } from './agents/executor';
import { TeamCoordinator } from './teams/coordinator';
import { PipelineExecutor, PipelineDefinition } from './pipelines/pipeline-executor';

// Simple service interfaces
interface IToolService {
    create(config: any): Promise<any>;
    initialize(): Promise<void>;
}

interface IAgentService {
    create(config: any): Promise<any>;
    initialize(): Promise<void>;
}

interface ITeamService {
    create(config: any): Promise<any>;
    initialize(): Promise<void>;
}

interface IPipelineService {
    create(config: any): Promise<any>;
    initialize(): Promise<void>;
}

interface IValidationManager {
    validate(config: any, type: string): Promise<{ isValid: boolean; errors: string[] }>;
    initialize(): Promise<void>;
}

// Simple implementations
class SimpleToolService implements IToolService {
    async create(config: any): Promise<any> {
        return {
            name: config.name,
            run: config.handler || (() => Promise.resolve({ success: true, result: null }))
        };
    }
    
    async initialize(): Promise<void> {
        // Simple initialization
    }
}

class SimpleAgentService implements IAgentService {
    async create(config: any): Promise<any> {
        // Create an actual AgentExecutor instance with LLM capabilities
        const agentExecutor = new AgentExecutor(config);
        
        return {
            name: config.name,
            run: async (task: string) => {
                // Use the AgentExecutor's executeTask method which includes LLM integration
                return await agentExecutor.executeTask(task);
            },
            selectTool: async (task: string) => {
                // Use the AgentExecutor's intelligent tool selection
                return await agentExecutor.executeToolSelection(task);
            },
            executor: agentExecutor // Expose the executor for advanced usage
        };
    }
    
    async initialize(): Promise<void> {
        // Simple initialization
    }
}

class EnhancedTeamService implements ITeamService {
    private teams: Map<string, TeamCoordinator> = new Map();
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance('EnhancedTeamService');
    }

    async create(config: any): Promise<any> {
        this.logger.info('EnhancedTeamService', `Creating team: ${config.name}`, {
            agentCount: config.agents?.length || 0,
            strategy: config.strategy?.name || 'default'
        });

        // Create TeamCoordinator instance
        const teamCoordinator = new TeamCoordinator(config);
        
        // Initialize the team
        await teamCoordinator.initialize();
        
        // Store for management
        this.teams.set(config.name, teamCoordinator);

        // Return team interface compatible with existing API
        return {
            name: config.name,
            run: async (task: string, options?: any) => {
                this.logger.info('EnhancedTeamService', `Team ${config.name} executing task: ${task}`);
                return await teamCoordinator.executeTask(task, options);
            },
            getStatus: () => teamCoordinator.getTeamStatus(),
            coordinator: teamCoordinator // Expose coordinator for advanced usage
        };
    }
    
    async initialize(): Promise<void> {
        this.logger.info('EnhancedTeamService', 'Enhanced team service initialized');
    }

    async shutdown(): Promise<void> {
        this.logger.info('EnhancedTeamService', `Shutting down ${this.teams.size} teams`);
        
        const shutdownPromises = Array.from(this.teams.values()).map(team => team.shutdown());
        await Promise.all(shutdownPromises);
        
        this.teams.clear();
        this.logger.info('EnhancedTeamService', 'All teams shut down successfully');
    }

    getTeams(): string[] {
        return Array.from(this.teams.keys());
    }

    getTeam(name: string): TeamCoordinator | undefined {
        return this.teams.get(name);
    }
}

class EnhancedPipelineService implements IPipelineService {
    private pipelines: Map<string, PipelineExecutor> = new Map();
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance('EnhancedPipelineService');
    }

    async create(config: any): Promise<any> {
        this.logger.info('EnhancedPipelineService', `Creating pipeline: ${config.name}`, {
            stepCount: config.steps?.length || 0,
            version: config.version || '1.0.0'
        });

        // Convert config to PipelineDefinition
        const definition: PipelineDefinition = {
            id: config.id || `pipeline_${Date.now()}`,
            name: config.name,
            description: config.description || `Pipeline: ${config.name}`,
            version: config.version || '1.0.0',
            steps: config.steps || [],
            variables: config.variables,
            errorHandling: config.errorHandling,
            concurrency: config.concurrency
        };

        // Create PipelineExecutor instance
        const pipelineExecutor = new PipelineExecutor(definition);
        
        // Store for management
        this.pipelines.set(config.name, pipelineExecutor);

        // Return pipeline interface compatible with existing API
        return {
            name: config.name,
            run: async (input?: any) => {
                this.logger.info('EnhancedPipelineService', `Pipeline ${config.name} executing with input`, {
                    hasInput: !!input,
                    inputKeys: input ? Object.keys(input) : []
                });
                return await pipelineExecutor.execute(input);
            },
            getStatus: () => pipelineExecutor.getPipelineStatus(),
            executor: pipelineExecutor // Expose executor for advanced usage
        };
    }
    
    async initialize(): Promise<void> {
        this.logger.info('EnhancedPipelineService', 'Enhanced pipeline service initialized');
    }

    async shutdown(): Promise<void> {
        this.logger.info('EnhancedPipelineService', `Shutting down ${this.pipelines.size} pipelines`);
        // Pipelines don't need special shutdown logic currently
        this.pipelines.clear();
        this.logger.info('EnhancedPipelineService', 'All pipelines shut down successfully');
    }

    getPipelines(): string[] {
        return Array.from(this.pipelines.keys());
    }

    getPipeline(name: string): PipelineExecutor | undefined {
        return this.pipelines.get(name);
    }
}

class SimpleValidationManager implements IValidationManager {
    async validate(config: any, _type: string): Promise<{ isValid: boolean; errors: string[] }> {
        // Simple validation - just check if config has a name
        if (!config || !config.name) {
            return { isValid: false, errors: ['Config must have a name'] };
        }
        return { isValid: true, errors: [] };
    }
    
    async initialize(): Promise<void> {
        // Simple initialization
    }
}

class SimpleMetricsAPI implements IMetricsAPI {
    readonly startTime = Date.now();
    private metrics = new Map<string, any>();
    
    start(id: string, metadata?: Record<string, any>): void {
        this.metrics.set(id, { startTime: Date.now(), metadata });
    }
    
    end(id: string, metadata?: Record<string, any>): void {
        const existing = this.metrics.get(id) || {};
        this.metrics.set(id, { ...existing, endTime: Date.now(), metadata });
    }
    
    get(id: string): any {
        return this.metrics.get(id);
    }
    
    update(id: string, metadata: Record<string, any>): void {
        const existing = this.metrics.get(id) || {};
        this.metrics.set(id, { ...existing, metadata: { ...existing.metadata, ...metadata } });
    }
    
    getAll(): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [key, value] of this.metrics.entries()) {
            result[key] = value;
        }
        return result;
    }
}

export class Symphony implements Partial<ISymphony> {
    private _state: ToolLifecycleState = ToolLifecycleState.PENDING;
    private _logger: Logger;
    private _llm: LLMHandler;
    private _config: SymphonyConfig;
    private _metrics: IMetricsAPI;
    
    readonly name = 'Symphony';
    readonly initialized = false;
    readonly isInitialized = false;
    
    // Services
    readonly tool: IToolService;
    readonly agent: IAgentService;
    readonly team: ITeamService;
    readonly pipeline: IPipelineService;
    readonly validation: IValidationManager;
    readonly validationManager: IValidationManager;
    
    readonly types = {
        CapabilityBuilder: {
            team: (capability: string) => `team:${capability}`,
            agent: (capability: string) => `agent:${capability}`,
            numeric: (capability: string) => `numeric:${capability}`,
            processing: (capability: string) => `processing:${capability}`
        },
        CommonCapabilities: {
            TOOL_USE: 'tool_use',
            COORDINATION: 'coordination',
            PARALLEL: 'parallel',
            ADD: 'add'
        }
    };

    constructor(config: SymphonyConfig) {
        this._config = config;
        this._logger = Logger.getInstance('Symphony');
        this._llm = LLMHandler.getInstance();
        this._metrics = new SimpleMetricsAPI();
        
        // Initialize services
        this.tool = new SimpleToolService();
        this.agent = new SimpleAgentService();
        this.team = new EnhancedTeamService();
        this.pipeline = new EnhancedPipelineService();
        this.validation = new SimpleValidationManager();
        this.validationManager = this.validation;
    }
    
    get state(): ToolLifecycleState {
        return this._state;
    }
    
    get logger(): Logger {
        return this._logger;
    }
    
    get llm(): LLMHandler {
        return this._llm;
    }
    
    get metrics(): IMetricsAPI {
        return this._metrics;
    }
    
    getState(): ToolLifecycleState {
        return this._state;
    }
    
    getDependencies(): string[] {
        return [];
    }
    
    getConfig(): SymphonyConfig {
        return this._config;
    }
    
    updateConfig(config: Partial<SymphonyConfig>): void {
        this._config = { ...this._config, ...config };
    }
    
    startMetric(id: string, metadata?: Record<string, any>): void {
        this._metrics.start(id, metadata);
    }
    
    endMetric(id: string, metadata?: Record<string, any>): void {
        this._metrics.end(id, metadata);
    }
    
    getMetric(id: string): any {
        return this._metrics.get(id);
    }
    
    async initialize(): Promise<void> {
        if (this._state === ToolLifecycleState.READY) {
            return;
        }
        
        this._state = ToolLifecycleState.INITIALIZING;
        this._logger.info('Symphony', 'Initializing...');
        
        try {
            await Promise.all([
                this.tool.initialize(),
                this.agent.initialize(),
                this.team.initialize(),
                this.pipeline.initialize(),
                this.validation.initialize()
            ]);
            
            this._state = ToolLifecycleState.READY;
            this._logger.info('Symphony', 'Initialization complete');
        } catch (error) {
            this._state = ToolLifecycleState.ERROR;
            this._logger.error('Symphony', 'Initialization failed', { error });
            throw error;
        }
    }
    
    async getService(name: string): Promise<any> {
        const services: Record<string, any> = {
            tool: this.tool,
            agent: this.agent,
            team: this.team,
            pipeline: this.pipeline,
            validation: this.validation,
            metrics: this._metrics
        };
        return services[name];
    }
} 