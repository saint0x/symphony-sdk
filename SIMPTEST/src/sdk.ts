import { symphony } from 'symphonic';
import type { 
    Tool, Agent, Team, Pipeline,
    ToolConfig, AgentConfig, TeamConfig, PipelineConfig,
    ToolResult, AgentResult, TeamResult, PipelineResult
} from 'symphonic';
import { logger } from '../../src/utils/logger';
import { envConfig } from '../../src/utils/env';

// Log the environment configuration
logger.info('Test', 'Loading environment from:', {
    metadata: {
        dirname: __dirname,
        currentDir: process.cwd(),
        openaiKeyLength: envConfig.openaiApiKey?.length,
        openaiKeyPrefix: envConfig.openaiApiKey?.substring(0, 7)
    }
});

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

