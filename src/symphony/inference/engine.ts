import { 
    InferencePattern,
    SmartConfig,
    OptimizationStrategy,
    RuntimeOptimization,
    AgentPattern,
    ToolPattern,
    TeamPattern,
    PipelinePattern,
    InferenceValidationConfig
} from './types';
import { LLMConfig } from '../../types/sdk';
import { PatternRegistryImpl } from './registry';
import { PipelineStep } from '../../types/sdk';

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

        // Apply type-specific defaults if not already set
        const defaults = this.inferDefaultsByType(type, baseConfig.capabilities || []);
        const mergedConfig = {
            ...defaults,
            ...baseConfig,
            type,
            capabilities: [...(defaults.capabilities || []), ...(baseConfig.capabilities || [])]
        };

        return this.optimizeConfig(mergedConfig, type);
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
                metadata: { inferredFrom: 'pattern' }
            } as unknown as Partial<T>;
        }

        // Infer from name
        const capabilities = this.inferCapabilitiesFromName(name);
        return {
            name,
            type,
            capabilities,
            ...this.inferDefaultsByType(type, capabilities),
            metadata: { inferredFrom: 'name' }
        } as unknown as Partial<T>;
    }

    /**
     * Infer configuration from partial input
     */
    private inferFromPartial<T extends InferencePattern>(
        partial: Partial<T>,
        type: T['type']
    ): Partial<T> {
        const withType = { ...partial, type };
        const capabilities = partial.capabilities || 
            this.inferCapabilitiesFromPartial(withType);

        const defaults = this.inferDefaultsByType(type, capabilities);
        
        return {
            ...defaults,
            ...partial,
            type,
            capabilities,
            metadata: { inferredFrom: 'partial' }
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

        const strategy = this.selectOptimizationStrategy(type);
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
        const defaults: Partial<ToolPattern> = {
            type: 'tool',
            capabilities: [...capabilities],
            inputs: [],
            outputs: []
        };

        // Infer IO patterns based on capabilities
        if (capabilities.includes('arithmetic') || capabilities.includes('calculation')) {
            defaults.inputs = ['input1', 'input2'];
            defaults.outputs = ['result'];
            defaults.capabilities?.push('numeric-operation');
        } else if (capabilities.includes('string-manipulation') || capabilities.includes('text-processing')) {
            defaults.inputs = ['input'];
            defaults.outputs = ['result'];
            defaults.capabilities?.push('text-operation');
        } else if (capabilities.includes('data-processing')) {
            defaults.inputs = ['data'];
            defaults.outputs = ['processed'];
            defaults.capabilities?.push('data-operation');
        } else if (capabilities.includes('file-operations')) {
            defaults.inputs = ['path'];
            defaults.outputs = ['content'];
            defaults.capabilities?.push('io-operation');
        }

        defaults.validation = this.inferValidationRules(capabilities);
        return defaults;
    }

    private inferTeamDefaults(capabilities: string[]): Partial<TeamPattern> {
        return {
            type: 'team',
            strategy: this.inferOptimalStrategy(capabilities) as TeamPattern['strategy'],
            agents: this.inferRequiredAgents(capabilities)
        };
    }

    private inferPipelineDefaults(capabilities: string[]): Partial<PipelinePattern> {
        return {
            type: 'pipeline',
            steps: this.inferRequiredSteps(capabilities).map(name => ({
                name,
                type: 'tool',
                tool: name
            })) as PipelineStep[],
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

    private inferValidationRules(capabilities: string[]): InferenceValidationConfig {
        const rules: InferenceValidationConfig = {
            schema: {}
        };
        
        if (capabilities.includes('input-validation')) {
            rules.schema.input = {
                type: 'object',
                required: true
            };
        }
        if (capabilities.includes('output-validation')) {
            rules.schema.output = {
                type: 'object',
                required: true
            };
        }
        return rules;
    }

    private inferOptimalStrategy(capabilities: string[]): string {
        if (capabilities.includes('parallel-execution')) {
            return 'parallel';
        }
        if (capabilities.includes('load-balancing')) {
            return 'load-balanced';
        }
        return 'collaborative';
    }

    private inferRequiredAgents(capabilities: string[]): string[] {
        return capabilities
            .map(cap => this.registry.findByCapability(cap))
            .flat()
            .filter(pattern => pattern.type === 'agent')
            .map(pattern => pattern.name);
    }

    private inferRequiredSteps(capabilities: string[]): string[] {
        return capabilities
            .map(cap => this.registry.findByCapability(cap))
            .flat()
            .filter(pattern => pattern.type === 'tool')
            .map(pattern => pattern.name);
    }

    private inferPipelineValidation(capabilities: string[]): InferenceValidationConfig {
        const validation: InferenceValidationConfig = {
            schema: {}
        };
        
        if (capabilities.includes('input-validation')) {
            validation.schema.input = {
                type: 'object',
                required: true
            };
        }
        if (capabilities.includes('output-validation')) {
            validation.schema.output = {
                type: 'object',
                required: true
            };
        }
        if (capabilities.includes('pipeline-validation')) {
            validation.schema.flow = {
                type: 'object',
                required: true
            };
        }
        return validation;
    }

    /**
     * Optimization strategy selection and application
     */
    private selectOptimizationStrategy(type: string): OptimizationStrategy {
        return {
            priority: 1,
            condition: (config: Partial<InferencePattern>) => {
                // Check if config has required fields based on type
                switch (type) {
                    case 'agent':
                        return !!(config as Partial<AgentPattern>).task;
                    case 'tool':
                        return !!(config as Partial<ToolPattern>).inputs;
                    case 'team':
                        return !!(config as Partial<TeamPattern>).agents;
                    case 'pipeline':
                        return !!(config as Partial<PipelinePattern>).steps;
                    default:
                        return true;
                }
            },
            enhance: (config: Partial<InferencePattern>) => {
                // Add type-specific enhancements
                const enhanced = { ...config };
                enhanced.capabilities = enhanced.capabilities || [];
                return enhanced as InferencePattern;
            }
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
        
        // Preserve inferred inputs and outputs for tools
        if (config.type === 'tool') {
            const toolConfig = config as Partial<ToolPattern>;
            const enhancedTool = enhanced as Partial<ToolPattern>;
            enhancedTool.inputs = toolConfig.inputs;
            enhancedTool.outputs = toolConfig.outputs;
        }

        return {
            base: enhanced as T,
            advanced: this.inferAdvancedSettings()
        };
    }

    private inferAdvancedSettings(): SmartConfig<InferencePattern>['advanced'] {
        return {
            customValidation: false,
            debugMode: false,
            timeoutMs: 30000
        };
    }

    private generateCacheKey(config: Partial<InferencePattern>): string {
        return JSON.stringify({
            type: config.type,
            capabilities: config.capabilities?.sort(),
            name: config.name
        });
    }

    public enhance<T extends InferencePattern>(pattern: T): SmartConfig<T> {
        const enhanced: SmartConfig<T> = {
            base: { ...pattern, type: pattern.type } as T,
            optimizations: [],
            metrics: {
                latency: 0,
                throughput: 0,
                cost: 0
            },
            advanced: this.inferAdvancedSettings()
        };

        // Update metrics based on pattern type and capabilities
        if (pattern.type === 'agent') {
            const agentPattern = pattern as unknown as AgentPattern;
            if (enhanced.metrics && agentPattern.llm) {
                enhanced.metrics.latency = this.estimateLatency(agentPattern.llm);
                enhanced.metrics.cost = this.estimateCost(agentPattern.llm);
            }
        }

        return enhanced;
    }

    private estimateLatency(llm: LLMConfig): number {
        // Basic latency estimation based on model type
        const model = typeof llm === 'string' ? llm : llm.model;
        switch (model) {
            case 'gpt-4':
                return 2000; // 2 seconds
            case 'gpt-3.5-turbo':
                return 1000; // 1 second
            default:
                return 1500; // Default estimate
        }
    }

    private estimateCost(llm: LLMConfig): number {
        // Basic cost estimation per request
        const model = typeof llm === 'string' ? llm : llm.model;
        switch (model) {
            case 'gpt-4':
                return 0.03; // $0.03 per request
            case 'gpt-3.5-turbo':
                return 0.002; // $0.002 per request
            default:
                return 0.01; // Default estimate
        }
    }
} 