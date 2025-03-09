import { symphony } from 'symphonic';
import type { 
    Tool, Agent, Team, Pipeline,
    ToolConfig, AgentConfig, TeamConfig, PipelineConfig,
    ToolResult, AgentResult, TeamResult, PipelineResult
} from 'symphonic';

// Initialize Symphony
await symphony.initialize();

// Export core types for better inference
export type {
    Tool, Agent, Team, Pipeline,
    ToolConfig, AgentConfig, TeamConfig, PipelineConfig,
    ToolResult, AgentResult, TeamResult, PipelineResult
};

// Export the pre-initialized symphony instance
export default symphony;

