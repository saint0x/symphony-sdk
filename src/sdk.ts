import { Symphony } from './symphony';
import { symphony } from './symphony';

// Export all types
export type {
    Tool,
    Agent,
    Team,
    Pipeline,
    ISymphony,
    IMetricsAPI,
    ComponentConfig,
    ComponentType,
    ComponentCapability,
    ComponentRequirement,
    ComponentInstance,
    ComponentMetadata,
    Component,
    ComponentPath
} from './types';

// Export service interfaces
export type {
    IService,
    IToolService,
    IAgentService,
    ITeamService,
    IPipelineService,
    IComponentService,
    IRegistryService,
    IValidationService,
    IContextService,
    ILLMService,
    IMetricsService,
    IServiceBus
} from './types/interfaces';

// Export core services
export * from './services';

// Export the Symphony class and instance
export { Symphony, symphony };

// Re-export core types
export type {
    ToolConfig,
    AgentConfig,
    TeamConfig,
    PipelineConfig,
    ToolResult,
    AgentResult,
    TeamResult,
    PipelineResult,
    PipelineStep,
    ToolLifecycleState,
    ToolStateEvent
} from './types/sdk';

// Re-export lifecycle types
export type {
    ToolStateChangeHandler,
    ILifecycleManager
} from './types/lifecycle';

// Re-export logging types
export type {
    ILogger,
    Logger,
    LogLevel
} from './types/logging';

// Re-export interfaces
export * from './types/interfaces';
export * from './types/components';
export * from './types/metadata';
export * from './types/symphony'; 