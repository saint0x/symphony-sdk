import type { ToolConfig, ToolResult } from 'symphonic';

// Generic type for data that can be transformed
type TransformableData = {
    value: string | number | boolean | object;
    type: 'string' | 'number' | 'boolean' | 'object';
    metadata?: Record<string, unknown>;
};

// Type-safe transformer function
type Transformer<T extends TransformableData> = (data: T) => T;

// Complex type that combines multiple transformations with type checking
type TransformChain<T extends TransformableData> = {
    transforms: Transformer<T>[];
    initial: T;
    validation?: (result: T) => boolean;
    metadata?: {
        name: string;
        complexity: number;
        steps: string[];
    };
};

// Helper to compose transformations with type safety
const composeTransforms = <T extends TransformableData>(chain: TransformChain<T>): T => {
    return chain.transforms.reduce((value, transform) => transform(value), chain.initial);
};

// Type-safe data transformers
const dataTransformers = {
    // Convert data to uppercase and add prefix
    uppercase: (data: TransformableData): TransformableData => ({
        value: typeof data.value === 'string' 
            ? data.value.toUpperCase() 
            : String(data.value).toUpperCase(),
        type: 'string',
        metadata: { ...data.metadata, transformed: 'uppercase' }
    }),

    // Reverse string or number
    reverse: (data: TransformableData): TransformableData => ({
        value: String(data.value).split('').reverse().join(''),
        type: 'string',
        metadata: { ...data.metadata, transformed: 'reverse' }
    }),

    // Convert to JSON and prettify
    jsonify: (data: TransformableData): TransformableData => {
        let value: any;
        try {
            // If it's a string that looks like JSON, parse it first
            if (typeof data.value === 'string' && 
                (data.value.startsWith('{') || data.value.startsWith('['))) {
                value = JSON.parse(data.value);
            } else {
                value = data.value;
            }
            // Then stringify with pretty printing
            return {
                value: JSON.stringify(value, null, 2),
                type: 'string',
                metadata: { 
                    ...data.metadata, 
                    transformed: 'json',
                    originalType: typeof data.value,
                    wasJson: typeof data.value === 'string' && 
                            (data.value.startsWith('{') || data.value.startsWith('['))
                }
            };
        } catch (error) {
            // If JSON parsing fails, just stringify the original value
            return {
                value: JSON.stringify(data.value, null, 2),
                type: 'string',
                metadata: { 
                    ...data.metadata, 
                    transformed: 'json',
                    originalType: typeof data.value,
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    },

    // Base64 encode
    base64: (data: TransformableData): TransformableData => ({
        value: Buffer.from(String(data.value)).toString('base64'),
        type: 'string',
        metadata: { ...data.metadata, transformed: 'base64' }
    })
};

// Create the transformer tool with strong type inference
const transformerTool: ToolConfig = {
    name: 'transform',
    description: 'Apply complex data transformations with type safety',
    inputs: ['data', 'transformType'],
    handler: async ({ 
        data, 
        transformType 
    }: { 
        data: string | number | boolean | object;
        transformType: keyof typeof dataTransformers;
    }): Promise<ToolResult> => {
        const startTime = Date.now();

        try {
            // Create initial transformable data with type inference
            const initial: TransformableData = {
                value: data,
                type: typeof data as 'string' | 'number' | 'boolean' | 'object',
                metadata: {
                    originalType: typeof data,
                    timestamp: startTime
                }
            };

            // Create transformation chain with type checking
            const chain: TransformChain<TransformableData> = {
                transforms: [
                    dataTransformers[transformType],
                    // Add some common post-processing
                    (d: TransformableData) => ({
                        ...d,
                        metadata: {
                            ...d.metadata,
                            processed: true,
                            processedAt: Date.now()
                        }
                    })
                ],
                initial,
                validation: (result) => result.value !== undefined,
                metadata: {
                    name: transformType,
                    complexity: 2,
                    steps: ['transform', 'post-process']
                }
            };

            // Apply transformations with type safety
            const transformed = composeTransforms(chain);

            // Validate result if validation function exists
            if (chain.validation && !chain.validation(transformed)) {
                throw new Error('Transformation validation failed');
            }

            return {
                success: true,
                result: transformed.value,
                metadata: {
                    ...transformed.metadata,
                    ...chain.metadata,
                    finalType: transformed.type
                },
                metrics: {
                    startTime,
                    endTime: Date.now(),
                    duration: Date.now() - startTime,
                    transformations: chain.transforms.length
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                result: null,
                metrics: {
                    startTime,
                    endTime: Date.now(),
                    duration: Date.now() - startTime,
                    transformations: 0
                }
            };
        }
    }
};

export default transformerTool; 