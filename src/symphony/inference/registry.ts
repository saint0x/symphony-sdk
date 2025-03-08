import { 
    InferencePattern, 
    PatternRegistry, 
    CapabilitySet,
    AgentPattern,
    ToolPattern,
    TeamPattern,
    PipelinePattern
} from './types';

/**
 * Registry for managing inference patterns and capabilities
 */
export class PatternRegistryImpl<T extends InferencePattern> implements PatternRegistry<T> {
    public patterns: Map<string, T> = new Map();
    public capabilities: Map<string, Set<string>> = new Map();
    public defaults: Map<string, Partial<T>> = new Map();

    private static instance: PatternRegistryImpl<any>;
    private capabilitySets: Map<string, CapabilitySet> = new Map();

    private constructor() {
        this.initializeDefaultPatterns();
        this.initializeCapabilitySets();
    }

    public static getInstance<T extends InferencePattern>(): PatternRegistryImpl<T> {
        if (!PatternRegistryImpl.instance) {
            PatternRegistryImpl.instance = new PatternRegistryImpl<T>();
        }
        return PatternRegistryImpl.instance;
    }

    /**
     * Register a new pattern
     */
    public register(pattern: T): void {
        this.patterns.set(pattern.name, pattern);
        
        // Index capabilities
        pattern.capabilities.forEach(cap => {
            if (!this.capabilities.has(cap)) {
                this.capabilities.set(cap, new Set());
            }
            this.capabilities.get(cap)!.add(pattern.name);
        });
    }

    /**
     * Find patterns by capability
     */
    public findByCapability(capability: string): T[] {
        const patternNames = this.capabilities.get(capability) || new Set();
        return Array.from(patternNames)
            .map(name => this.patterns.get(name)!)
            .filter(Boolean);
    }

    /**
     * Get default configuration for a pattern
     */
    public getDefault(name: string): Partial<T> | undefined {
        return this.defaults.get(name);
    }

    /**
     * Get capability set for a pattern
     */
    public getCapabilitySet(name: string): CapabilitySet | undefined {
        return this.capabilitySets.get(name);
    }

    /**
     * Initialize default patterns
     */
    private initializeDefaultPatterns(): void {
        // Agent patterns
        this.defaults.set('researcher', {
            type: 'agent',
            description: 'Research assistant that helps find and analyze information',
            task: 'Find and summarize information about a topic',
            capabilities: ['search', 'analyze', 'summarize'],
        } as Partial<T>);

        this.defaults.set('calculator', {
            type: 'agent',
            description: 'Performs mathematical calculations',
            task: 'Execute mathematical operations',
            capabilities: ['math', 'compute'],
        } as Partial<T>);

        // Tool patterns
        this.defaults.set('search', {
            type: 'tool',
            description: 'Searches for information',
            capabilities: ['web', 'data'],
            inputs: ['query'],
            outputs: ['results'],
        } as Partial<T>);

        // Team patterns
        this.defaults.set('research-team', {
            type: 'team',
            description: 'Team of research agents',
            capabilities: ['research', 'coordination'],
            strategy: 'collaborative',
        } as Partial<T>);
    }

    /**
     * Initialize capability sets
     */
    private initializeCapabilitySets(): void {
        this.capabilitySets.set('search', {
            required: ['webSearch', 'contentAnalysis'],
            optional: ['dataScraping', 'imageAnalysis'],
        });

        this.capabilitySets.set('math', {
            required: ['basicOperations', 'validation'],
            optional: ['scientificNotation', 'unitConversion'],
        });

        this.capabilitySets.set('research', {
            required: ['search', 'analyze', 'summarize'],
            optional: ['translate', 'visualize'],
        });
    }

    /**
     * Validate pattern compatibility
     */
    public validateCompatibility(pattern: T): boolean {
        const requiredCaps = this.getRequiredCapabilities(pattern.type);
        return requiredCaps.every(cap => pattern.capabilities.includes(cap));
    }

    private getRequiredCapabilities(type: string): string[] {
        switch (type) {
            case 'agent':
                return ['task-execution', 'error-handling'];
            case 'tool':
                return ['input-validation', 'execution'];
            case 'team':
                return ['coordination', 'communication'];
            case 'pipeline':
                return ['sequential-execution', 'data-flow'];
            default:
                return [];
        }
    }
} 