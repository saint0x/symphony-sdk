import { ToolConfig, AgentConfig, TeamConfig, PipelineConfig } from '../../types/sdk';
import { globalMetrics } from '../../utils/metrics';
import { logger } from '../../utils/logger';
import { validateConfig } from '../../utils/validation';

export interface SymphonyUtils {
    metrics: typeof globalMetrics;
    logger: typeof logger;
    validation: {
        validateConfig: typeof validateConfig;
        validateInput: typeof validateConfig;
        validateOutput: typeof validateConfig;
    };
}

export interface ISymphony {
    metrics: typeof globalMetrics;
    startTime: number;
    utils: SymphonyUtils;
    tools: {
        create: (config: ToolConfig) => Promise<any>;
    };
    agent: {
        create: (config: AgentConfig) => Promise<any>;
    };
    team: {
        create: (config: TeamConfig) => Promise<any>;
    };
    pipeline: {
        create: (config: PipelineConfig) => Promise<any>;
    };
} 