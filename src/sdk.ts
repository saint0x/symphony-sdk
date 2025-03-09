import { Symphony, symphony } from './symphony';
import type { ISymphony, SymphonyConfig } from './symphony/interfaces/types';
import type { IComponentManager } from './symphony/interfaces/types';
import type { IToolService, IAgentService, ITeamService, IPipelineService } from './services/interfaces';
import type { IValidationManager } from './managers/validation';
import type { ComponentManager } from './managers/component';
import type { 
    Component, ComponentConfig, ComponentType,
    Tool, Agent, Team, Pipeline
} from './types/components';
import type {
    ComponentInstance, ComponentPath, ComponentMetadata,
    ComponentCapability, ComponentRequirement
} from './types/metadata';
import type {
    ToolConfig, AgentConfig, TeamConfig, PipelineConfig,
    ToolResult, AgentResult, TeamResult
} from './types/sdk';

// Re-export types
export type {
    ISymphony,
    SymphonyConfig,
    IComponentManager,
    ComponentManager,
    ComponentInstance,
    ComponentMetadata,
    Component,
    ComponentPath,
    Tool,
    Agent,
    Team,
    Pipeline,
    ToolConfig,
    AgentConfig,
    TeamConfig,
    PipelineConfig,
    IToolService,
    IAgentService,
    ITeamService,
    IPipelineService,
    IValidationManager,
    ComponentConfig,
    ComponentType,
    ComponentCapability,
    ComponentRequirement,
    ToolResult,
    AgentResult,
    TeamResult
};

// Export the Symphony class and instance
export { Symphony, symphony }; 