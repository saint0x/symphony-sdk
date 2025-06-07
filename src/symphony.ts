import { ISymphony, SymphonyConfig, IMetricsAPI } from './types/symphony';
import { ToolLifecycleState, AgentConfig, TeamConfig, ToolResult } from './types/sdk';
import { IToolService, IAgentService, ITeamService, IValidationManager } from './types/interfaces';
import { Logger } from './utils/logger';
import { LLMHandler } from './llm/handler';
// @ts-ignore
import { LLMConfig as RichLLMConfig, LLMFunctionDefinition } from './llm/types';
import { IDatabaseService } from './db/types';
import { DatabaseService } from './db/service';
import { CacheIntelligenceService } from './cache/service';
import { MemoryService } from './memory/service';
import { StreamingService } from './streaming/service';
import { ToolRegistry } from './tools/standard/registry';
import { TeamCoordinator } from './teams/coordinator';
import { AgentExecutor } from './agents/executor';
// import { envConfig } from './utils/env';
import { INlpService, NlpPatternDefinition, ToolConfig as CoreToolConfig } from './types/tool.types';
import { NlpService } from './nlp/NlpService';
import { ContextAPI } from './cache/context-api';
import { IContextAPI } from './api/IContextAPI';
import { SymphonyRuntime, createSymphonyRuntime } from './runtime/SymphonyRuntime';
import { RuntimeDependencies } from './runtime/RuntimeTypes';

// Service implementations
class ToolService implements IToolService {
    private toolRegistry: ToolRegistry;
    private logger: Logger;
    private _state: ToolLifecycleState = ToolLifecycleState.READY;
    private nlpService: INlpService;

    constructor(toolRegistry: ToolRegistry, nlpService: INlpService) {
        this.toolRegistry = toolRegistry;
        this.nlpService = nlpService;
        this.logger = Logger.getInstance('ToolService');
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return ['ToolRegistry', 'NlpService'];
    }

    async create(config: CoreToolConfig): Promise<any> {
        this.logger.info('ToolService', `Creating tool: ${config.name}`);
        
        const toolHandler = config.handler || (() => Promise.resolve({ success: true, result: null }));

        const toolToRegister: CoreToolConfig = {
            name: config.name,
            description: config.description || '',
            type: config.type || 'custom',
            handler: toolHandler,
            nlp: config.nlp,
            apiKey: config.apiKey,
            timeout: config.timeout,
            retryCount: config.retryCount,
            maxSize: config.maxSize,
            inputs: config.inputs,
            outputs: config.outputs,
            capabilities: config.capabilities,
            config: config.config || {},
            inputSchema: config.config?.inputSchema
        };

        this.toolRegistry.registerTool(config.name, toolToRegister);

        if (toolToRegister.nlp) {
            const nlpPatternDef: NlpPatternDefinition = {
                toolName: toolToRegister.name,
                nlpPattern: toolToRegister.nlp,
                source: 'tool_config_init'
            };

            try {
                await this.nlpService.loadPatternToRuntime(nlpPatternDef);
                this.logger.info('ToolService', `NLP pattern for '${toolToRegister.name}' loaded into runtime command map.`);
            } catch (err: any) {
                this.logger.warn('ToolService', `Failed to load NLP pattern for '${toolToRegister.name}' to runtime: ${err.message}. Tool may not respond to NLP commands in this session unless pattern is seeded separately.`);
            }

        } else {
            this.logger.debug('ToolService', `No explicit NLP pattern for tool '${config.name}'. Registering tool name as default runtime NLP trigger.`);
            const nlpPatternDef: NlpPatternDefinition = {
                toolName: toolToRegister.name,
                nlpPattern: toolToRegister.name,
                source: 'tool_name_default_runtime'
            };
            try {
                await this.nlpService.loadPatternToRuntime(nlpPatternDef);
                this.logger.info('ToolService', `Tool name '${toolToRegister.name}' registered as default runtime NLP trigger.`);
            } catch (err: any) {
                this.logger.warn('ToolService', `Failed to load tool name '${toolToRegister.name}' as default runtime NLP trigger: ${err.message}.`);
            }
        }

        const toolObject = {
            name: config.name,
            run: async (params: any) => {
                this.logger.info('ToolService', `Tool ${config.name} executing with params`, {
                    hasParams: !!params,
                    paramKeys: params ? Object.keys(params) : []
                });
                return await this.toolRegistry.executeTool(config.name, params);
            },
            getInfo: () => this.toolRegistry.getToolInfo(config.name),
            config: config 
        };

        this.logger.info('ToolService', `Tool created and registered: ${config.name}`);
        return toolObject;
    }

    async execute(toolName: string, params: any): Promise<any> {
        this.logger.info('ToolService', `Executing tool: ${toolName}`, { params });
        return await this.toolRegistry.executeTool(toolName, params);
    }

    getAvailable(): string[] {
        return this.toolRegistry.getAvailableTools();
    }

    getInfo(toolName: string): any {
        return this.toolRegistry.getToolInfo(toolName);
    }

    register(name: string, tool: CoreToolConfig): void {
        this.logger.info('ToolService', `Registering tool: ${name}`);
        this.toolRegistry.registerTool(name, tool);
    }
    
    async initialize(): Promise<void> {
        this.logger.info('ToolService', 'Tool service initialized');
    }

    get registry(): ToolRegistry {
        return this.toolRegistry;
    }
}

class AgentService implements IAgentService {
    private agents: Map<string, AgentExecutor> = new Map();
    private _state: ToolLifecycleState = ToolLifecycleState.READY;
    private runtime: SymphonyRuntime;

    constructor(runtime: SymphonyRuntime) {
        this.runtime = runtime;
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return ['SymphonyRuntime'];
    }

    async create(config: AgentConfig): Promise<AgentExecutor> {
        // The service now passes a bound execute function to the agent.
        const executeFn = this.runtime.execute.bind(this.runtime);
        const agentExecutor = new AgentExecutor(config, executeFn);
        
        this.agents.set(agentExecutor.name, agentExecutor);
        
        return agentExecutor;
    }
    
    async initialize(): Promise<void> {
        // Simple initialization
    }

    async get(name: string): Promise<AgentExecutor | undefined> {
        return this.agents.get(name);
    }
}

class TeamService implements ITeamService {
    private teams: Map<string, TeamCoordinator> = new Map();
    private logger: Logger;
    private _state: ToolLifecycleState = ToolLifecycleState.READY;
    private agentService: IAgentService;
    private runtime: SymphonyRuntime;

    constructor(agentService: IAgentService, runtime: SymphonyRuntime) {
        this.logger = Logger.getInstance('TeamService');
        this.agentService = agentService;
        this.runtime = runtime;
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return ['AgentService', 'SymphonyRuntime'];
    }

    async create(config: TeamConfig): Promise<TeamCoordinator> {
        this.logger.info('TeamService', `Creating team: ${config.name}`, {
            agentCount: config.agents?.length || 0,
            strategy: config.strategy?.name || 'default'
        });

        // This adapter function makes the runtime compatible with the coordinator's expectation
        const teamExecutor = async (task: string, agentConfig: AgentConfig): Promise<ToolResult> => {
            const runtimeResult = await this.runtime.execute(task, agentConfig);
            // This is a simplified transformation. A real implementation would be more robust.
            return {
                success: runtimeResult.success,
                result: runtimeResult.executionDetails,
                error: runtimeResult.error,
                metrics: {
                    duration: runtimeResult.metrics.totalDuration,
                    startTime: runtimeResult.metrics.startTime,
                    endTime: runtimeResult.metrics.endTime,
                }
            };
        };

        const teamCoordinator = new TeamCoordinator(config, this.agentService, teamExecutor);
        
        // Initialize the team
        await teamCoordinator.initialize();
        
        // Store for management
        this.teams.set(config.name, teamCoordinator);

        return teamCoordinator;
    }
    
    async initialize(): Promise<void> {
        this.logger.info('TeamService', 'Team service initialized');
    }

    async get(name: string): Promise<TeamCoordinator | undefined> {
        return this.teams.get(name);
    }

    async shutdown(): Promise<void> {
        this.logger.info('TeamService', `Shutting down ${this.teams.size} teams`);
        
        const shutdownPromises = Array.from(this.teams.values()).map(team => team.shutdown());
        await Promise.all(shutdownPromises);
        
        this.teams.clear();
        this.logger.info('TeamService', 'All teams shut down successfully');
    }

    getTeams(): string[] {
        return Array.from(this.teams.keys());
    }
}

class ValidationService implements IValidationManager {
    private _state: ToolLifecycleState = ToolLifecycleState.READY;

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return [];
    }

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

class MetricsService implements IMetricsAPI {
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
    private _db: IDatabaseService;
    private _cache: CacheIntelligenceService;
    private _memory: MemoryService;
    private _streaming: StreamingService;
    private _tools: ToolRegistry;
    
    // New services for NLP
    private _contextIntelligenceApi: IContextAPI;
    private _nlpService: INlpService;
    private _runtime: SymphonyRuntime;

    readonly name = 'Symphony';
    readonly initialized = false;
    readonly isInitialized = false;
    
    readonly tool: IToolService;
    readonly agent: IAgentService;
    readonly team: ITeamService;
    readonly validation: IValidationManager;
    
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
        this._metrics = new MetricsService();
        
        // Ensure a default DB config exists if none is provided
        const dbConfig = config.db || {
            adapter: 'sqlite',
            path: ':memory:'
        };

        this._db = new DatabaseService(dbConfig);
        this._cache = CacheIntelligenceService.getInstance(this._db);
        this._memory = MemoryService.getInstance(this._db);
        this._streaming = StreamingService.getInstance();

        // Initialize services needed for NLP and ToolService
        this._contextIntelligenceApi = new ContextAPI(this._db);
        this._nlpService = new NlpService(this._db, this._contextIntelligenceApi);
        
        const sharedToolRegistry = ToolRegistry.getInstance();
        this._tools = sharedToolRegistry;
        sharedToolRegistry.initializeContextIntegration(this._db);
        
        const runtimeDependencies: RuntimeDependencies = {
            toolRegistry: sharedToolRegistry,
            contextAPI: this._contextIntelligenceApi,
            llmHandler: this._llm,
            logger: this._logger,
        };
        this._runtime = createSymphonyRuntime(runtimeDependencies, this._config.runtime);

        // Correctly instantiate services with all their dependencies
        const toolServiceInstance = new ToolService(sharedToolRegistry, this._nlpService);
        const agentServiceInstance = new AgentService(this._runtime);
        const teamServiceInstance = new TeamService(agentServiceInstance, this._runtime);
        const validationServiceInstance = new ValidationService();

        this.tool = toolServiceInstance;
        this.agent = agentServiceInstance;
        this.team = teamServiceInstance;
        this.validation = validationServiceInstance;

        this._logger.info('Symphony', 'Core services instantiated. Context intelligence integration with ToolRegistry prepared.', {
            contextTools: this._tools.getContextTools(),
            totalToolsRegisteredInitially: this._tools.getAvailableTools().length
        });
    }
    
    get state(): ToolLifecycleState { return this._state; }
    get logger(): Logger { return this._logger; }
    get llm(): LLMHandler { return this._llm; }
    get metrics(): IMetricsAPI { return this._metrics; }
    
    get db(): IDatabaseService { return this._db; }
    get cache(): CacheIntelligenceService { return this._cache; }
    get memory(): MemoryService { return this._memory; }
    get streaming(): StreamingService { return this._streaming; }
    get nlp(): INlpService { return this._nlpService; }
    
    getState(): ToolLifecycleState { return this._state; }
    getDependencies(): string[] { return []; }
    getConfig(): SymphonyConfig { return this._config; }
    updateConfig(config: Partial<SymphonyConfig>): void { this._config = { ...this._config, ...config }; }
    startMetric(id: string, metadata?: Record<string, any>): void { this._metrics.start(id, metadata); }
    endMetric(id: string, metadata?: Record<string, any>): void { this._metrics.end(id, metadata); }
    getMetric(id: string): any { return this._metrics.get(id); }
    
    async initialize(): Promise<void> {
        if (this._state === ToolLifecycleState.READY) {
            this.logger.info('Symphony', 'Already initialized.');
            return;
        }
        if (this._state === ToolLifecycleState.INITIALIZING) {
            this.logger.warn('Symphony', 'Initialization already in progress.');
            return;
        }
        
        this._state = ToolLifecycleState.INITIALIZING;
        this._logger.info('Symphony', 'Initializing Symphony SDK...');
        
        try {
            // Initialize DB first as other services depend on it
            await this.db.initialize(this._config.db);
            this._logger.info('Symphony', 'Database initialized');

            // Initialize services that may depend on the database
            await Promise.all([
                this._cache.initialize(this._config.cache),
                this._memory.initialize(this._config.memory),
                this._streaming.initialize(this._config.streaming)
            ]);
            this._logger.info('Symphony', 'Dependent services (cache, memory, streaming) initialized.');

            // Initialize functional services
            await this.tool.initialize();
            await this.agent.initialize();
            await this.team.initialize();
            await this.validation.initialize();
            this._logger.info('Symphony', 'Main functional services (tool, agent, team, validation) initialized.');
            
            const { LLMHandler } = await import('./llm/handler');
            const llmHandler = LLMHandler.getInstance();
            llmHandler.setCacheService(this._cache);
            
            // Initialize NLP service after all other services are ready
            await this._nlpService.loadAllPersistedPatternsToRuntime();
            this._logger.info('Symphony', 'NLP Service loaded persisted patterns.');
            
            this._state = ToolLifecycleState.READY;
            (this as any).initialized = true;
            (this as any).isInitialized = true;
            this._logger.info('Symphony', 'Symphony SDK Initialization complete', {
                toolsAvailable: (this.tool as ToolService).registry.getAvailableTools().length
            });
        } catch (error) {
            this._state = ToolLifecycleState.ERROR;
            this._logger.error('Symphony', 'Symphony SDK Initialization failed', { error });
            throw error;
        }
    }
    
    async getService(name: string): Promise<any> {
        const services: Record<string, any> = {
            tool: this.tool,
            agent: this.agent,
            team: this.team,
            validation: this.validation,
            metrics: this._metrics,
            database: this._db,
            cache: this._cache,
            memory: this._memory,
            streaming: this._streaming,
            context: this._contextIntelligenceApi,
            nlp: this._nlpService
        };
        return services[name];
    }
} 