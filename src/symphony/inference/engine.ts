import { 
    InferencePattern,
    SmartConfig,
    OptimizationStrategy,
    RuntimeOptimization,
    AgentPattern,
    ToolPattern,
    TeamPattern,
    PipelinePattern
} from './types';
import { PatternRegistryImpl } from './registry';
import { logger } from '../../utils/logger';

/**
 * Core inference engine for configuration enhancement
 */
export class InferenceEngine {
    private static instance: InferenceEngine;
    private registry: PatternRegistryImpl<InferencePattern>;
    private optimizationCache: Map<string, RuntimeOptimization> = new Map();

    private constructor() {
        this.registry = PatternRegistryImpl.getInstance();
    }

    public static getInstance(): InferenceEngine {
        if (!InferenceEngine.instance) {
            InferenceEngine.instance = new InferenceEngine();
        }
        return InferenceEngine.instance;
    }

    /**
     * Infer complete configuration from partial input
     */
    public inferConfig<T extends InferencePattern>(
        input: string | Partial<T>,
        type: T['type']
    ): SmartConfig<T> {
        const baseConfig = typeof input === 'string'
            ? this.inferFromString<T>(input, type)
            : this.inferFromPartial<T>(input, type);

        return this.optimizeConfig(baseConfig, type);
    }

    /**
     * Infer configuration from string input
     */
    private inferFromString<T extends InferencePattern>(
        name: string,
        type: T['type']
    ): Partial<T> {
        // Check for predefined pattern
        const pattern = this.registry.getDefault(name);
        if (pattern) {
            return {
                name,
                ...pattern,
                _metadata: { inferredFrom: 'pattern' }
            };
        }

        // Infer from name
        const capabilities = this.inferCapabilitiesFromName(name);
        return {
            name,
            type,
            capabilities,
            ...this.inferDefaultsByType(type, capabilities),
            _metadata: { inferredFrom: 'name' }
        } as Partial<T>;
    }

    /**
     * Infer configuration from partial input
     */
    private inferFromPartial<T extends InferencePattern>(
        partial: Partial<T>,
        type: T['type']
    ): Partial<T> {
        const capabilities = partial.capabilities || 
            this.inferCapabilitiesFromPartial(partial);

        return {
            ...this.inferDefaultsByType(type, capabilities),
            ...partial,
            capabilities,
            _metadata: { inferredFrom: 'partial' }
        };
    }

    /**
     * Optimize configuration based on type and capabilities
     */
    private optimizeConfig<T extends InferencePattern>(
        config: Partial<T>,
        type: T['type']
    ): SmartConfig<T> {
        const cacheKey = this.generateCacheKey(config);
        const cached = this.optimizationCache.get(cacheKey);

        if (cached?.strategy) {
            return this.applyOptimizationStrategy(config, cached.strategy);
        }

        const strategy = this.selectOptimizationStrategy(config, type);
        const optimized = this.applyOptimizationStrategy(config, strategy);

        this.optimizationCache.set(cacheKey, {
            strategy,
            caching: true,
            priority: strategy.priority
        });

        return optimized;
    }

    /**
     * Infer capabilities from component name
     */
    private inferCapabilitiesFromName(name: string): string[] {
        const words = name.toLowerCase().split(/[-_\s]/);
        const capabilities = new Set<string>();

        words.forEach(word => {
            const capabilitySet = this.registry.getCapabilitySet(word);
            if (capabilitySet) {
                capabilitySet.required.forEach(cap => capabilities.add(cap));
            }
        });

        return Array.from(capabilities);
    }

    /**
     * Infer capabilities from partial configuration
     */
    private inferCapabilitiesFromPartial<T extends InferencePattern>(
        partial: Partial<T>
    ): string[] {
        const capabilities = new Set<string>();

        // Infer from type-specific properties
        switch (partial.type) {
            case 'agent':
                this.inferAgentCapabilities(partial as Partial<AgentPattern>, capabilities);
                break;
            case 'tool':
                this.inferToolCapabilities(partial as Partial<ToolPattern>, capabilities);
                break;
            case 'team':
                this.inferTeamCapabilities(partial as Partial<TeamPattern>, capabilities);
                break;
            case 'pipeline':
                this.inferPipelineCapabilities(partial as Partial<PipelinePattern>, capabilities);
                break;
        }

        return Array.from(capabilities);
    }

    /**
     * Infer default configuration by component type
     */
    private inferDefaultsByType(
        type: string,
        capabilities: string[]
    ): Partial<InferencePattern> {
        switch (type) {
            case 'agent':
                return this.inferAgentDefaults(capabilities);
            case 'tool':
                return this.inferToolDefaults(capabilities);
            case 'team':
                return this.inferTeamDefaults(capabilities);
            case 'pipeline':
                return this.inferPipelineDefaults(capabilities);
            default:
                return {};
        }
    }

    /**
     * Type-specific capability inference
     */
    private inferAgentCapabilities(
        partial: Partial<AgentPattern>,
        capabilities: Set<string>
    ): void {
        if (partial.task) {
            const taskWords = partial.task.toLowerCase().split(/\s+/);
            taskWords.forEach(word => {
                const capSet = this.registry.getCapabilitySet(word);
                if (capSet) {
                    capSet.required.forEach(cap => capabilities.add(cap));
                }
            });
        }

        if (partial.tools) {
            partial.tools.forEach(tool => {
                const pattern = this.registry.getDefault(tool);
                if (pattern?.capabilities) {
                    pattern.capabilities.forEach(cap => capabilities.add(cap));
                }
            });
        }
    }

    private inferToolCapabilities(
        partial: Partial<ToolPattern>,
        capabilities: Set<string>
    ): void {
        if (partial.inputs) {
            capabilities.add('input-validation');
        }
        if (partial.outputs) {
            capabilities.add('output-validation');
        }
        capabilities.add('execution');
    }

    private inferTeamCapabilities(
        partial: Partial<TeamPattern>,
        capabilities: Set<string>
    ): void {
        capabilities.add('coordination');
        capabilities.add('communication');
        if (partial.strategy) {
            capabilities.add(`strategy-${partial.strategy}`);
        }
    }

    private inferPipelineCapabilities(
        partial: Partial<PipelinePattern>,
        capabilities: Set<string>
    ): void {
        capabilities.add('sequential-execution');
        capabilities.add('data-flow');
        if (partial.validation) {
            capabilities.add('pipeline-validation');
        }
    }

    /**
     * Type-specific default inference
     */
    private inferAgentDefaults(capabilities: string[]): Partial<AgentPattern> {
        return {
            llm: this.selectOptimalLLM(capabilities),
            tools: this.inferRequiredTools(capabilities),
            task: this.inferTaskFromCapabilities(capabilities)
        };
    }

    private inferToolDefaults(capabilities: string[]): Partial<ToolPattern> {
        return {
            inputs: this.inferRequiredInputs(capabilities),
            outputs: this.inferExpectedOutputs(capabilities),
            validation: this.inferValidationRules(capabilities)
        };
    }

    private inferTeamDefaults(capabilities: string[]): Partial<TeamPattern> {
        return {
            strategy: this.inferOptimalStrategy(capabilities),
            agents: this.inferRequiredAgents(capabilities)
        };
    }

    private inferPipelineDefaults(capabilities: string[]): Partial<PipelinePattern> {
        return {
            steps: this.inferRequiredSteps(capabilities),
            validation: this.inferPipelineValidation(capabilities)
        };
    }

    /**
     * Utility methods for specific inferences
     */
    private selectOptimalLLM(capabilities: string[]): string {
        // Select LLM based on capability requirements
        if (capabilities.includes('complex-reasoning')) {
            return 'gpt-4';
        }
        return 'gpt-3.5-turbo';
    }

    private inferRequiredTools(capabilities: string[]): string[] {
        return capabilities
            .map(cap => this.registry.findByCapability(cap))
            .flat()
            .filter(pattern => pattern.type === 'tool')
            .map(pattern => pattern.name);
    }

    private inferTaskFromCapabilities(capabilities: string[]): string {
        const primaryCapability = capabilities[0];
        return `Perform tasks related to ${primaryCapability}`;
    }

    private inferRequiredInputs(capabilities: string[]): string[] {
        return ['input']; // Simplified - expand based on capabilities
    }

    private inferExpectedOutputs(capabilities: string[]): string[] {
        return ['output']; // Simplified - expand based on capabilities
    }

    private inferValidationRules(capabilities: string[]): any {
        return {}; // Simplified - expand based on capabilities
    }

    private inferOptimalStrategy(capabilities: string[]): string {
        return 'collaborative'; // Simplified - expand based on capabilities
    }

    private inferRequiredAgents(capabilities: string[]): string[] {
        return []; // Simplified - expand based on capabilities
    }

    private inferRequiredSteps(capabilities: string[]): string[] {
        return []; // Simplified - expand based on capabilities
    }

    private inferPipelineValidation(capabilities: string[]): any {
        return {}; // Simplified - expand based on capabilities
    }

    /**
     * Optimization strategy selection and application
     */
    private selectOptimizationStrategy(
        config: Partial<InferencePattern>,
        type: string
    ): OptimizationStrategy {
        // Select optimal strategy based on configuration and type
        return {
            priority: 1,
            condition: () => true,
            enhance: (config) => config as InferencePattern
        };
    }

    private applyOptimizationStrategy<T extends InferencePattern>(
        config: Partial<T>,
        strategy: OptimizationStrategy
    ): SmartConfig<T> {
        if (!strategy.condition(config)) {
            return { base: config };
        }

        const enhanced = strategy.enhance(config);
        return {
            base: enhanced as T,
            advanced: this.inferAdvancedOptions(enhanced)
        };
    }

    private inferAdvancedOptions(
        config: InferencePattern
    ): SmartConfig<InferencePattern>['advanced'] {
        return {
            retry: {
                enabled: true,
                maxAttempts: 3
            },
            metrics: {
                enabled: true,
                detailed: config.capabilities.length > 3
            }
        };
    }

    private generateCacheKey(config: Partial<InferencePattern>): string {
        return JSON.stringify({
            type: config.type,
            capabilities: config.capabilities?.sort(),
            name: config.name
        });
    }
} 