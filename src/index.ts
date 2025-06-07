import { Symphony } from './symphony';
import { LogLevel } from './types/sdk';

// Export core functionality
export { Symphony, LogLevel };

// Export concrete implementation classes for advanced typing
export { AgentExecutor } from './agents/executor';
export { TeamCoordinator } from './teams/coordinator';

// Export types and utilities
export type { 
    SymphonyConfig, IMetricsAPI, ISymphony
} from './types/symphony';
export type { 
    ServiceBaseConfig, ToolConfig, AgentConfig, TeamConfig,
    LLMBaseConfig, ValidationConfig,
    RetryConfig, ToolResult, TeamResult,
    ToolLifecycleState, AgentOptions, TeamOptions,
    TeamStrategy, DelegationStrategy, MemoryConfig
} from './types/sdk';
export type { 
    Component, ComponentConfig, ComponentType
} from './types/components';
export type { 
    ComponentMetadata, ComponentCapability, ComponentRequirement,
    ComponentInstance, ComponentPath
} from './types/metadata';
export type {
    IService, IToolService, IAgentService, ITeamService,
    IValidationService, IMetricsService, IValidationManager,
    IRegistryService, IContextService, ILLMService, IServiceBus,
    IComponentManager, IComponentService
} from './types/interfaces';
export type * from './types/capabilities';

// Add detailed initialization logging
console.log('[Symphony Core] Starting Symphony core initialization...');
const initStartTime = Date.now();

// Create and export the default instance
export const symphony = new Symphony({
    serviceRegistry: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000
    },
    logging: {
        level: LogLevel.INFO,
        format: 'json'
    },
    metrics: { enabled: true, detailed: true }
});

console.log(`[Symphony Core] Symphony core setup completed in ${Date.now() - initStartTime}ms`); 