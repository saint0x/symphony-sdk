// Common capability patterns
export const CommonCapabilities = {
    NUMERIC: {
        ADD: 'numeric.add',
        MULTIPLY: 'numeric.multiply',
        DIVIDE: 'numeric.divide',
        SUBTRACT: 'numeric.subtract'
    },
    PROCESSING: {
        BATCH: 'processing.batch',
        STREAM: 'processing.stream',
        PARALLEL: 'processing.parallel'
    },
    AGENT: {
        LLM: 'agent.llm',
        TOOL_USE: 'agent.tool_use',
        PLANNING: 'agent.planning'
    },
    TEAM: {
        COORDINATION: 'team.coordination',
        DELEGATION: 'team.delegation'
    },
    PIPELINE: {
        SEQUENTIAL: 'pipeline.sequential',
        CONDITIONAL: 'pipeline.conditional',
        PARALLEL: 'pipeline.parallel'
    }
} as const;

// Type-safe capability builder
export class CapabilityBuilder {
    static numeric(operation: keyof typeof CommonCapabilities.NUMERIC) {
        return CommonCapabilities.NUMERIC[operation];
    }

    static processing(type: keyof typeof CommonCapabilities.PROCESSING) {
        return CommonCapabilities.PROCESSING[type];
    }

    static agent(feature: keyof typeof CommonCapabilities.AGENT) {
        return CommonCapabilities.AGENT[feature];
    }

    static team(feature: keyof typeof CommonCapabilities.TEAM) {
        return CommonCapabilities.TEAM[feature];
    }

    static pipeline(type: keyof typeof CommonCapabilities.PIPELINE) {
        return CommonCapabilities.PIPELINE[type];
    }
} 