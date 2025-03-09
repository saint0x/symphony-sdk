import { LLMHandler } from '../llm/handler';
import { ServiceRegistry } from '../services/registry';
import { ContextManager } from '../services/context';
import { ValidationService } from '../services/validation';
import { ServiceBus } from '../services/bus';
import { MetricsService } from '../services/metrics';
import { ToolService } from '../services/tool';
import { AgentService } from '../services/agent';
import { TeamService } from '../services/team';
import { PipelineService } from '../services/pipeline';
import { ComponentManager } from '../symphony/components/component-manager';
import { ISymphony } from '../types/symphony';

export class ServiceFactory {
    private static instances = new Map<string, any>();

    private static getInstance<T>(key: string, factory: () => T): T {
        if (!this.instances.has(key)) {
            this.instances.set(key, factory());
        }
        return this.instances.get(key) as T;
    }

    static createLLMHandler(): LLMHandler {
        return LLMHandler.getInstance();
    }

    static createServiceRegistry(symphony: ISymphony): ServiceRegistry {
        return this.getInstance('ServiceRegistry', () => new ServiceRegistry(symphony));
    }

    static createContextManager(): ContextManager {
        return this.getInstance('ContextManager', () => new ContextManager());
    }

    static createValidationService(symphony: ISymphony): ValidationService {
        return this.getInstance('ValidationService', () => new ValidationService(symphony));
    }

    static createServiceBus(): ServiceBus {
        return this.getInstance('ServiceBus', () => new ServiceBus());
    }

    static createMetricsService(): MetricsService {
        return this.getInstance('MetricsService', () => new MetricsService());
    }

    static createToolService(symphony: ISymphony): ToolService {
        return this.getInstance('ToolService', () => new ToolService(symphony));
    }

    static createAgentService(symphony: ISymphony): AgentService {
        return this.getInstance('AgentService', () => new AgentService(symphony));
    }

    static createTeamService(symphony: ISymphony): TeamService {
        return this.getInstance('TeamService', () => new TeamService(symphony));
    }

    static createPipelineService(symphony: ISymphony): PipelineService {
        return this.getInstance('PipelineService', () => new PipelineService(symphony));
    }

    static createComponentManager(symphony: ISymphony): ComponentManager {
        return ComponentManager.getInstance(symphony);
    }
} 