import { ISymphony } from '../symphony/interfaces/types';
import { BaseManager } from './base';

interface ValidationSchema {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'function';
    required?: boolean;
    arrayOf?: ValidationSchema;
    properties?: Record<string, ValidationSchema>;
    oneOf?: ValidationSchema[];
    validate?: (value: any) => boolean;
    description?: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

export interface IValidationManager extends BaseManager {
    validate(data: any, schemaName: string): Promise<ValidationResult>;
    registerSchema(name: string, schema: ValidationSchema): void;
}

export class ValidationManager extends BaseManager implements IValidationManager {
    private static instance: ValidationManager;
    private schemas: Map<string, ValidationSchema>;

    protected constructor(symphony: ISymphony) {
        super(symphony, 'ValidationManager');
        this.schemas = new Map();
        this.initializeSchemas();
    }

    static getInstance(symphony: ISymphony): ValidationManager {
        if (!this.instance) {
            this.instance = new ValidationManager(symphony);
        } else if (symphony && this.instance.symphony !== symphony) {
            // Update symphony reference if needed
            this.instance.symphony = symphony;
        }
        return this.instance;
    }

    protected async initializeInternal(): Promise<void> {
        // No additional initialization needed
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

    async validate(data: any, schemaName: string): Promise<ValidationResult> {
        const schema = this.schemas.get(schemaName);
        if (!schema) {
            throw new Error(`Schema not found: ${schemaName}`);
        }

        const errors: string[] = [];
        this.validateAgainstSchema(data, schema, '', errors);

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    private validateAgainstSchema(value: any, schema: ValidationSchema, path: string, errors: string[]): void {
        if (schema.required && (value === undefined || value === null)) {
            errors.push(`${path} is required`);
            return;
        }

        if (value === undefined || value === null) {
            return;
        }

        if (schema.type === 'string') {
            if (typeof value !== 'string') {
                errors.push(`${path} must be a string`);
            }
        } else if (schema.type === 'number') {
            if (typeof value !== 'number') {
                errors.push(`${path} must be a number`);
            }
        } else if (schema.type === 'boolean') {
            if (typeof value !== 'boolean') {
                errors.push(`${path} must be a boolean`);
            }
        } else if (schema.type === 'object') {
            if (typeof value !== 'object' || value === null) {
                errors.push(`${path} must be an object`);
            }
        } else if (schema.type === 'array') {
            if (!Array.isArray(value)) {
                errors.push(`${path} must be an array`);
            }
        } else if (schema.type === 'function') {
            if (typeof value !== 'function') {
                errors.push(`${path} must be a function`);
            }
        }

        if (schema.arrayOf && Array.isArray(value)) {
            value.forEach((item: any, index: number) => {
                this.validateAgainstSchema(item, schema.arrayOf!, `${path}[${index}]`, errors);
            });
        }

        if (schema.properties && typeof value === 'object' && value !== null) {
            for (const prop in schema.properties) {
                if (prop in value) {
                    this.validateAgainstSchema(value[prop], schema.properties[prop], `${path}.${prop}`, errors);
                } else if (schema.properties[prop].required) {
                    errors.push(`${path}.${prop} is required`);
                }
            }
        }

        if (schema.oneOf) {
            let isValid = false;
            schema.oneOf.forEach((subSchema: ValidationSchema) => {
                const subErrors: string[] = [];
                this.validateAgainstSchema(value, subSchema, path, subErrors);
                if (subErrors.length === 0) {
                    isValid = true;
                }
            });
            if (!isValid) {
                errors.push(`${path} must match one of the following: ${schema.oneOf.map(s => s.description || '').join(', ')}`);
            }
        }

        if (schema.validate) {
            if (!schema.validate(value)) {
                errors.push(`${path} does not pass validation`);
            }
        }
    }
}