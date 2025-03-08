import { BaseManager } from './base';
import { Symphony } from '../symphony/core/symphony';
import { ValidationError } from '../utils/validation';

export type ValidationSchema = {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'function';
    required?: boolean;
    arrayOf?: ValidationSchema;
    properties?: Record<string, ValidationSchema>;
    oneOf?: ValidationSchema[];
    validate?: (value: any) => boolean;
    description?: string;
};

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

export class ValidationManager extends BaseManager {
    private static instance: ValidationManager;
    private schemas: Map<string, ValidationSchema>;

    private constructor(symphony: Symphony) {
        super(symphony, 'ValidationManager');
        this.schemas = new Map();
        this.initialized = true; // ValidationManager is ready upon construction
        this.initializeSchemas();
    }

    static getInstance(symphony: Symphony): ValidationManager {
        if (!ValidationManager.instance) {
            ValidationManager.instance = new ValidationManager(symphony);
        }
        return ValidationManager.instance;
    }

    protected async initializeInternal(): Promise<void> {
        // ValidationManager is already initialized in constructor
        return Promise.resolve();
    }

    private initializeSchemas(): void {
        // Register core schemas
        this.registerSchema('ToolConfig', {
            type: 'object',
            required: true,
            properties: {
                name: { type: 'string', required: true },
                description: { type: 'string', required: true },
                inputs: { type: 'object', required: true },
                handler: { type: 'function', required: true },
                validation: {
                    type: 'object',
                    properties: {
                        input: { type: 'object', required: true },
                        output: { type: 'object', required: true }
                    }
                }
            }
        });

        this.registerSchema('AgentConfig', {
            type: 'object',
            required: true,
            properties: {
                name: { type: 'string', required: true },
                description: { type: 'string', required: true },
                task: { type: 'string', required: true },
                tools: { type: 'array', required: true },
                llm: {
                    type: 'object',
                    required: true,
                    properties: {
                        provider: { type: 'string', required: true },
                        model: { type: 'string', required: true },
                        temperature: { type: 'number' },
                        maxTokens: { type: 'number' }
                    }
                }
            }
        });

        this.registerSchema('TeamConfig', {
            type: 'object',
            required: true,
            properties: {
                name: { type: 'string', required: true },
                description: { type: 'string', required: true },
                agents: {
                    type: 'array',
                    required: true,
                    arrayOf: {
                        type: 'object',
                        oneOf: [
                            { type: 'string' },
                            {
                                type: 'object',
                                properties: {
                                    name: { type: 'string', required: true },
                                    description: { type: 'string', required: true },
                                    task: { type: 'string', required: true },
                                    tools: { type: 'array', required: true },
                                    llm: { type: 'object', required: true }
                                }
                            }
                        ]
                    }
                }
            }
        });

        this.registerSchema('PipelineConfig', {
            type: 'object',
            required: true,
            properties: {
                name: { type: 'string', required: true },
                description: { type: 'string', required: true },
                steps: {
                    type: 'array',
                    required: true,
                    arrayOf: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', required: true },
                            tool: { type: 'object', required: true },
                            inputs: {
                                type: 'object',
                                oneOf: [
                                    { type: 'object' },
                                    { type: 'function' }
                                ],
                                required: true
                            },
                            validation: {
                                type: 'object',
                                properties: {
                                    input: { type: 'object', required: true },
                                    output: { type: 'object', required: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        this.logInfo('Core schemas initialized');
    }

    registerSchema(name: string, schema: ValidationSchema): void {
        this.schemas.set(name, schema);
        this.logInfo(`Registered schema: ${name}`);
    }

    async validate(config: any, schemaName: string): Promise<ValidationResult> {
        return this.withErrorHandling('validate', async () => {
            const schema = this.schemas.get(schemaName);
            if (!schema) {
                throw new ValidationError(`Schema not found: ${schemaName}`);
            }

            const errors: string[] = [];
            this.validateAgainstSchema(config, schema, '', errors);

            return {
                isValid: errors.length === 0,
                errors
            };
        }, { schemaName });
    }

    private validateAgainstSchema(value: any, schema: ValidationSchema, path: string, errors: string[]): void {
        if (schema.required && (value === undefined || value === null)) {
            errors.push(`${path || 'value'} is required`);
            return;
        }

        if (value === undefined || value === null) {
            return;
        }

        const fullPath = path ? path : 'value';

        switch (schema.type) {
            case 'array':
                if (!Array.isArray(value)) {
                    errors.push(`${fullPath} must be an array`);
                    return;
                }
                if (schema.arrayOf) {
                    value.forEach((item, index) => {
                        this.validateAgainstSchema(item, schema.arrayOf!, `${fullPath}[${index}]`, errors);
                    });
                }
                break;

            case 'object':
                if (typeof value !== 'object' || Array.isArray(value)) {
                    errors.push(`${fullPath} must be an object`);
                    return;
                }
                if (schema.properties) {
                    Object.entries(schema.properties).forEach(([key, propSchema]) => {
                        this.validateAgainstSchema(value[key], propSchema, `${fullPath}.${key}`, errors);
                    });
                }
                if (schema.oneOf) {
                    const validAny = schema.oneOf.some(subSchema => {
                        const subErrors: string[] = [];
                        this.validateAgainstSchema(value, subSchema, fullPath, subErrors);
                        return subErrors.length === 0;
                    });
                    if (!validAny) {
                        errors.push(`${fullPath} does not match any allowed schemas`);
                    }
                }
                break;

            default:
                if (typeof value !== schema.type) {
                    errors.push(`${fullPath} must be of type ${schema.type}`);
                }
        }

        if (schema.validate && !schema.validate(value)) {
            errors.push(`${fullPath} failed custom validation`);
        }
    }
} 