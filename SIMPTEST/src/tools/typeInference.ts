import type { ToolConfig } from 'symphonic';

// Tool result interface with metadata
interface TypeInferenceToolResult {
    success: boolean;
    result: any;
    error?: Error;
    metadata?: {
        operation: string;
        depth: number;
        typeAnalysis: Record<string, string>;
        inputType: string;
        outputType: string;
        timestamp: number;
    };
    metrics: {
        startTime: number;
        endTime: number;
        duration: number;
        operations: number;
        typeChecks: number;
    };
}

// Complex nested type system for testing type inference
type RecursiveType<T> = {
    value: T;
    nested?: RecursiveType<T>;
    metadata: TypeMetadata;
};

type TypeMetadata = {
    depth: number;
    path: string[];
    transforms: string[];
    originalType: string;
    inferredType: string;
    timestamp: number;
};

type ComplexData = {
    primitive: string | number | boolean;
    array: Array<RecursiveType<any>>;
    object: Record<string, RecursiveType<any>>;
    optional?: unknown;
    union: string | number | { type: string; value: any };
};

// Type predicates for runtime type checking
const isPrimitive = (value: any): value is string | number | boolean => {
    return ['string', 'number', 'boolean'].includes(typeof value);
};

const isComplexData = (value: any): value is ComplexData => {
    return value && 
           typeof value === 'object' &&
           'primitive' in value &&
           Array.isArray(value.array) &&
           typeof value.object === 'object';
};

// Helper for creating type metadata
const createMetadata = (
    depth: number,
    path: string[],
    originalType: string,
    inferredType: string
): TypeMetadata => ({
    depth,
    path,
    transforms: [],
    originalType,
    inferredType,
    timestamp: Date.now()
});

// Complex type transformation functions
const typeTransformers = {
    // Recursively wrap value in RecursiveType
    wrap: <T>(
        value: T,
        depth: number = 0,
        path: string[] = []
    ): RecursiveType<T> => {
        const originalType = typeof value;
        const inferredType = Array.isArray(value) ? 'array' : originalType;
        
        return {
            value,
            nested: depth > 0 
                ? typeTransformers.wrap(value, depth - 1, [...path, 'nested'])
                : undefined,
            metadata: createMetadata(depth, path, originalType, inferredType)
        };
    },

    // Transform primitive values with type checking
    transformPrimitive: (
        value: any,
        targetType: 'string' | 'number' | 'boolean'
    ): any => {
        switch(targetType) {
            case 'string':
                return String(value);
            case 'number':
                return Number(value);
            case 'boolean':
                return Boolean(value);
            default:
                throw new Error(`Invalid target type: ${targetType}`);
        }
    },

    // Create complex nested structure
    createComplex: (
        primitive: any,
        depth: number = 1
    ): ComplexData => ({
        primitive,
        array: Array(depth).fill(null).map((_, i) => 
            typeTransformers.wrap(primitive, i, ['array', String(i)])
        ),
        object: {
            value: typeTransformers.wrap(primitive, depth, ['object', 'value']),
            nested: typeTransformers.wrap(
                { inner: primitive },
                depth,
                ['object', 'nested']
            )
        },
        union: depth > 1 
            ? { type: typeof primitive, value: primitive }
            : primitive
    }),

    // Analyze type structure
    analyzeTypes: (
        data: any,
        path: string[] = []
    ): Record<string, string> => {
        const result: Record<string, string> = {};
        
        if (isPrimitive(data)) {
            result[path.join('.')] = typeof data;
        } else if (Array.isArray(data)) {
            result[path.join('.')] = 'array';
            data.forEach((item, i) => {
                Object.assign(
                    result,
                    typeTransformers.analyzeTypes(item, [...path, String(i)])
                );
            });
        } else if (data && typeof data === 'object') {
            result[path.join('.')] = 'object';
            Object.entries(data).forEach(([key, value]) => {
                Object.assign(
                    result,
                    typeTransformers.analyzeTypes(value, [...path, key])
                );
            });
        }
        
        return result;
    }
};

// Create the type inference test tool
const typeInferenceTool: ToolConfig = {
    name: 'typeInference',
    description: 'Complex type inference testing tool',
    inputs: ['value', 'depth', 'operation'],
    handler: async ({
        value,
        depth = 2,
        operation = 'analyze'
    }: {
        value: any;
        depth?: number;
        operation?: 'analyze' | 'transform' | 'wrap';
    }): Promise<TypeInferenceToolResult> => {
        const startTime = Date.now();
        const metrics: Record<string, number> = {
            startTime,
            operations: 0,
            typeChecks: 0
        };

        try {
            let result: any;
            let typeAnalysis: Record<string, string> = {};

            switch (operation) {
                case 'analyze':
                    result = typeTransformers.analyzeTypes(value);
                    metrics.typeChecks = Object.keys(result).length;
                    break;

                case 'transform':
                    result = typeTransformers.createComplex(value, depth);
                    typeAnalysis = typeTransformers.analyzeTypes(result);
                    metrics.operations = depth * 2; // wrap + transform per level
                    metrics.typeChecks = Object.keys(typeAnalysis).length;
                    break;

                case 'wrap':
                    result = typeTransformers.wrap(value, depth);
                    typeAnalysis = typeTransformers.analyzeTypes(result);
                    metrics.operations = depth;
                    metrics.typeChecks = Object.keys(typeAnalysis).length;
                    break;

                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }

            const endTime = Date.now();
            
            return {
                success: true,
                result,
                metadata: {
                    operation,
                    depth,
                    typeAnalysis,
                    inputType: typeof value,
                    outputType: typeof result,
                    timestamp: endTime
                },
                metrics: {
                    startTime,
                    endTime,
                    duration: endTime - startTime,
                    operations: metrics.operations,
                    typeChecks: metrics.typeChecks
                }
            };
        } catch (error) {
            const endTime = Date.now();
            
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                result: null,
                metrics: {
                    startTime,
                    endTime,
                    duration: endTime - startTime,
                    operations: metrics.operations,
                    typeChecks: metrics.typeChecks
                }
            };
        }
    }
};

export default typeInferenceTool; 