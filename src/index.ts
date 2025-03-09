import { Symphony } from './symphony';
import { LogLevel } from './types/sdk';

// Export core functionality
export { Symphony, LogLevel };

// Export types and utilities
export type { 
    ISymphony, SymphonyConfig, IComponentManager,
    SymphonyUtils, GlobalMetrics 
} from './symphony/interfaces/types';
export type { 
    Agent, Pipeline, Team, Tool,
    ServiceBaseConfig, ToolConfig, AgentConfig, TeamConfig,
    PipelineConfig, PipelineStep, LLMConfig, ValidationConfig,
    RetryConfig, ToolResult, AgentResult, TeamResult, PipelineResult,
    ErrorStrategy
} from './types/sdk';
export type { 
    Component, ComponentConfig, ComponentType
} from './types/components';
export type { 
    ComponentMetadata, ComponentCapability, ComponentRequirement,
    ComponentInstance, ComponentPath
} from './types/metadata';
export type * from './types/capabilities';
export type { 
    IToolService, IAgentService, ITeamService, 
    IPipelineService 
} from './services/interfaces';
export type { IValidationManager } from './managers/validation';
export { ComponentManager } from './managers/component';

// Add detailed initialization logging
console.log('[Symphony Core] Starting Symphony core initialization...');
const initStartTime = Date.now();

// Create and export the default instance
export const symphony = Symphony.getInstance();

console.log(`[Symphony Core] Symphony core setup completed in ${Date.now() - initStartTime}ms`); 