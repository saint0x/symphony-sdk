import { BaseManager } from '../managers/base';

export interface ISymphony {
    validation: any;
    team: any;
    metrics: any;
    tools: any;
    agent: any;
    pipeline: any;
    components: any;
    getRegistry(): Promise<any>;
    startMetric(metricId: string, metadata?: Record<string, any>): void;
    endMetric(metricId: string, metadata?: Record<string, any>): void;
    getMetric(metricId: string): Record<string, any> | undefined;
}

export class ToolService extends BaseManager {
    constructor(symphony: ISymphony) {
        super(symphony as any, 'ToolService');
    }
}

export class AgentService extends BaseManager {
    constructor(symphony: ISymphony) {
        super(symphony as any, 'AgentService');
    }
}

export class PipelineService extends BaseManager {
    constructor(symphony: ISymphony) {
        super(symphony as any, 'PipelineService');
    }
} 