import { ToolConfig, ToolResult } from '../../types/sdk';

export type TypePattern = {
    name: string;
    match: (config: Partial<ToolConfig>) => boolean;
    inputs: string[];
    outputs: string[];
    capabilities: string[];
    validate?: (params: any) => boolean;
    transform?: (params: any) => any;
};

export type PatternImplementation = {
    handler: (params: any) => Promise<ToolResult<any>>;
    inputMap?: Record<string, string>;  // Maps generic to specific names
    outputMap?: Record<string, string>; // Maps generic to specific names
};

export class PatternSystem {
    private static instance: PatternSystem;
    private patterns = new Map<string, TypePattern>();
    private implementations = new Map<string, PatternImplementation>();
    private capabilityIndex = new Map<string, Set<string>>();  // O(1) capability lookup

    private constructor() {
        this.registerCorePatterns();
    }

    public static getInstance(): PatternSystem {
        if (!PatternSystem.instance) {
            PatternSystem.instance = new PatternSystem();
        }
        return PatternSystem.instance;
    }

    private registerCorePatterns() {
        // Triple Operation Pattern
        this.registerPattern({
            name: 'triple:operation',
            match: (config) => {
                const name = (config.name || '').toLowerCase();
                return name.startsWith('triple') || 
                       name.includes('three') || 
                       (config.inputs?.length === 3 && config.outputs?.length === 1);
            },
            inputs: ['input1:number', 'input2:number', 'input3:number'],
            outputs: ['result:number'],
            capabilities: ['arithmetic', 'triple-operation'],
            validate: (params) => {
                return typeof params.input1 === 'number' && 
                       typeof params.input2 === 'number' &&
                       typeof params.input3 === 'number';
            }
        });

        // Numeric Operation Pattern
        this.registerPattern({
            name: 'numeric:operation',
            match: (config) => {
                const name = (config.name || '').toLowerCase();
                return name === 'calculator' || 
                       name.includes('calc') || 
                       name.includes('math') || 
                       name.includes('compute');
            },
            inputs: ['input1:number', 'input2:number'],
            outputs: ['result:number'],
            capabilities: ['arithmetic', 'calculation'],
            validate: (params) => {
                return typeof params.input1 === 'number' && 
                       typeof params.input2 === 'number';
            }
        });

        // Text Operation Pattern
        this.registerPattern({
            name: 'text:transform',
            match: (config) => {
                const name = config.name?.toLowerCase() || '';
                return name.includes('text') || 
                       name.includes('string') || 
                       name.includes('format');
            },
            inputs: ['input:string'],
            outputs: ['result:string'],
            capabilities: ['text-processing', 'string-manipulation'],
            validate: (params) => {
                const values = Object.values(params);
                return values.length >= 1 && values.every(v => typeof v === 'string');
            }
        });

        // Data Processing Pattern
        this.registerPattern({
            name: 'data:process',
            match: (config) => {
                const name = config.name?.toLowerCase() || '';
                return name.includes('data') || 
                       name.includes('process') || 
                       name.includes('transform');
            },
            inputs: ['data:any'],
            outputs: ['processed:any'],
            capabilities: ['data-processing'],
            validate: (params) => {
                return Object.keys(params).length > 0;
            }
        });
    }

    public registerPattern(pattern: TypePattern): void {
        this.patterns.set(pattern.name, pattern);
        
        // Update capability index - O(1) operation
        pattern.capabilities.forEach((cap: string) => {
            if (!this.capabilityIndex.has(cap)) {
                this.capabilityIndex.set(cap, new Set());
            }
            this.capabilityIndex.get(cap)!.add(pattern.name);
        });
    }

    public registerImplementation(
        patternName: string, 
        implementation: PatternImplementation
    ): void {
        this.implementations.set(patternName, implementation);
    }

    public detectPattern(config: Partial<ToolConfig>): TypePattern | undefined {
        // O(1) capability-based lookup if capabilities are provided
        if (config.capabilities?.length) {
            const patterns = new Set<string>();
            config.capabilities.forEach(cap => {
                const matchingPatterns = this.capabilityIndex.get(cap);
                if (matchingPatterns) {
                    matchingPatterns.forEach(p => patterns.add(p));
                }
            });
            
            // Find first matching pattern
            for (const patternName of patterns) {
                const pattern = this.patterns.get(patternName);
                if (pattern?.match(config)) {
                    return pattern;
                }
            }
        }

        // Fallback to pattern matching
        for (const pattern of this.patterns.values()) {
            if (pattern.match(config)) {
                return pattern;
            }
        }

        return undefined;
    }

    public getImplementation(patternName: string): PatternImplementation | undefined {
        return this.implementations.get(patternName);
    }

    public inferTypes(config: Partial<ToolConfig>): {
        inputs: string[];
        outputs: string[];
        capabilities: string[];
    } {
        const pattern = this.detectPattern(config);
        if (!pattern) {
            return {
                inputs: [],
                outputs: [],
                capabilities: []
            };
        }

        return {
            inputs: pattern.inputs,
            outputs: pattern.outputs,
            capabilities: pattern.capabilities
        };
    }
}

export const patternSystem = PatternSystem.getInstance(); 