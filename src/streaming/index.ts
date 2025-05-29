import { StreamingService } from './service';

// Export streaming service and types
export { StreamingService } from './service';
export type {
    StreamingConfig,
    ProgressUpdate,
    StreamOptions,
    StreamingStats
} from './service';

// Helper functions for common streaming patterns
export class StreamingHelpers {
    static createAgentStream(agentId: string, enableProgress = true) {
        const streaming = StreamingService.getInstance();
        return streaming.createStream({
            id: `agent_${agentId}_${Date.now()}`,
            type: 'agent',
            enableProgress,
            metadata: { agentId }
        });
    }

    static createTeamStream(teamId: string, enableProgress = true) {
        const streaming = StreamingService.getInstance();
        return streaming.createStream({
            id: `team_${teamId}_${Date.now()}`,
            type: 'team',
            enableProgress,
            metadata: { teamId }
        });
    }

    static createPipelineStream(pipelineId: string, enableProgress = true) {
        const streaming = StreamingService.getInstance();
        return streaming.createStream({
            id: `pipeline_${pipelineId}_${Date.now()}`,
            type: 'pipeline',
            enableProgress,
            metadata: { pipelineId }
        });
    }

    static createToolStream(toolName: string, enableProgress = false) {
        const streaming = StreamingService.getInstance();
        return streaming.createStream({
            id: `tool_${toolName}_${Date.now()}`,
            type: 'tool',
            enableProgress,
            metadata: { toolName }
        });
    }

    static createChainStream(chainId: string, enableProgress = true) {
        const streaming = StreamingService.getInstance();
        return streaming.createStream({
            id: `chain_${chainId}_${Date.now()}`,
            type: 'chain',
            enableProgress,
            metadata: { chainId }
        });
    }
}

// Convenience function to get streaming service instance
export function getStreamingService(): StreamingService {
    return StreamingService.getInstance();
} 