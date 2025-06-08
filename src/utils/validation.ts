import { logger, LogCategory } from './logger';
import { ValidationConfig } from '../types/sdk';
import { ValidationError, ErrorCode } from '../errors/index';

type ValidationSchema = {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'function';
    required?: boolean;
    arrayOf?: ValidationSchema;
    properties?: Record<string, ValidationSchema>;
    oneOf?: ValidationSchema[];
    validate?: (value: any) => boolean;
    description?: string;
};

interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

export class ValidationManager {
    private static instance: ValidationManager;
    private schemas: Map<string, ValidationSchema>;

    private constructor() {
        this.schemas = new Map();
        this.initializeSchemas();
    }

    static getInstance(): ValidationManager {
        if (!ValidationManager.instance) {
            ValidationManager.instance = new ValidationManager();
        }
        return ValidationManager.instance;
    }

    private initializeSchemas() {
        // Team Schema
        this.schemas.set('TeamConfig', {
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
                            { type: 'string' },  // Agent ID
                            {   // Agent Config
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
                },
                manager: { type: 'boolean' },
                strategy: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', required: true },
                        description: { type: 'string', required: true },
                        assignmentLogic: { type: 'function', required: true },
                        coordinationRules: {
                            type: 'object',
                            properties: {
                                maxParallelTasks: { type: 'number' },
                                taskTimeout: { type: 'number' }
                            }
                        }
                    }
                },
                log: {
                    type: 'object',
                    properties: {
                        inputs: { type: 'boolean' },
                        outputs: { type: 'boolean' },
                        metrics: { type: 'boolean' }
                    }
                }
            }
        });

        // Pipeline Schema
        this.schemas.set('PipelineConfig', {
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
                            tool: { 
                                type: 'object',
                                oneOf: [
                                    { type: 'string' },  // Tool ID
                                    { type: 'object' }   // Tool instance
                                ],
                                required: true
                            },
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
    }

    validate(config: any, schemaName: string): ValidationResult {
        const schema = this.schemas.get(schemaName);
        if (!schema) {
            throw new ValidationError(
                `Schema not found: ${schemaName}`,
                { 
                    schemaName, 
                    availableSchemas: Array.from(this.schemas.keys()) 
                },
                { component: 'ValidationService', operation: 'validate' }
            );
        }

        const errors: string[] = [];
        this.validateAgainstSchema(config, schema, '', errors);

        const result = {
            isValid: errors.length === 0,
            errors
        };

        if (!result.isValid) {
            logger.error(LogCategory.VALIDATION, 'Configuration validation failed', {
                metadata: {
                    schemaName,
                    errors: result.errors
                }
            });
        }

        return result;
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

            case 'function':
                if (typeof value !== 'function') {
                    errors.push(`${fullPath} must be a function`);
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

    private getSchema(schemaName: string): any {
        const schema = this.schemas.get(schemaName);
        if (!schema) {
            throw new ValidationError(
                `Schema not found: ${schemaName}`,
                { 
                    schemaName, 
                    availableSchemas: Array.from(this.schemas.keys()) 
                },
                { component: 'ValidationService', operation: 'getSchema' }
            );
        }
        return schema;
    }

    static validateString(value: any, name: string): void {
        if (typeof value !== 'string') {
            throw new ValidationError(
                `${name} must be a string`,
                { provided: typeof value, expected: 'string', name },
                { component: 'ValidationService', operation: 'validateString' }
            );
        }
    }

    static validateObject(value: any, name: string): void {
        if (typeof value !== 'object' || value === null) {
            throw new ValidationError(
                `${name} must be an object`,
                { provided: typeof value, expected: 'object', name },
                { component: 'ValidationService', operation: 'validateObject' }
            );
        }
    }

    static validateArray(value: any, name: string): void {
        if (!Array.isArray(value)) {
            throw new ValidationError(
                `${name} must be an array`,
                { provided: typeof value, expected: 'array', name },
                { component: 'ValidationService', operation: 'validateArray' }
            );
        }
    }

    static validateNumber(value: any, name: string): void {
        if (typeof value !== 'number') {
            throw new ValidationError(
                `${name} must be a number`,
                { provided: typeof value, expected: 'number', name },
                { component: 'ValidationService', operation: 'validateNumber' }
            );
        }
    }

    static validateBoolean(value: any, name: string): void {
        if (typeof value !== 'boolean') {
            throw new ValidationError(
                `${name} must be a boolean`,
                { provided: typeof value, expected: 'boolean', name },
                { component: 'ValidationService', operation: 'validateBoolean' }
            );
        }
    }

    static validateFunction(value: any, name: string): void {
        if (typeof value !== 'function') {
            throw new ValidationError(
                `${name} must be a function`,
                { provided: typeof value, expected: 'function', name },
                { component: 'ValidationService', operation: 'validateFunction' }
            );
        }
    }

    static validateRequired(value: any, name: string): void {
        if (value === undefined || value === null) {
            throw new ValidationError(
                `${name} must be defined`,
                { provided: value, name },
                { component: 'ValidationService', operation: 'validateRequired' }
            );
        }
    }
}

// Export singleton instance
export const validationManager = ValidationManager.getInstance();

// Simplified validation function for backward compatibility
export function validateConfig(config: any, schema: Record<string, any>): ValidationResult {
    const errors: string[] = [];
    
    for (const [key, value] of Object.entries(schema)) {
        if (value.required && !config[key]) {
            errors.push(`Missing required field: ${key}`);
            continue;
        }
        
        if (config[key] && value.type) {
            const actualType = Array.isArray(config[key]) ? 'array' : typeof config[key];
            if (actualType !== value.type) {
                errors.push(`Invalid type for ${key}: expected ${value.type}, got ${actualType}`);
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

export function validateInput(input: Record<string, any>, schema: Record<string, any>): ValidationResult {
    return validateConfig(input, schema);
}

export function validateOutput(output: Record<string, any>, schema: Record<string, any>): ValidationResult {
    return validateConfig(output, schema);
}

export function validateSchema(data: any, schema: ValidationConfig['schema']): void {
    for (const [key, rules] of Object.entries(schema)) {
        // Check required fields
        if (rules.required && (data[key] === undefined || data[key] === null)) {
            throw new ValidationError(
                `Required field '${key}' is missing`,
                { field: key, provided: data[key] },
                { component: 'ValidationSchema', operation: 'validateSchema' }
            );
        }

        // Skip validation if field is not present and not required
        if (data[key] === undefined || data[key] === null) {
            continue;
        }

        // Type validation
        if (rules.type && typeof data[key] !== rules.type) {
            throw new ValidationError(
                `Field '${key}' should be of type '${rules.type}' but got '${typeof data[key]}'`,
                { field: key, expected: rules.type, actual: typeof data[key] },
                { component: 'ValidationSchema', operation: 'validateSchema' }
            );
        }

        // Enum validation
        if (rules.enum && !rules.enum.includes(data[key])) {
            throw new ValidationError(
                `Field '${key}' should be one of [${rules.enum.join(', ')}] but got '${data[key]}'`,
                { field: key, allowedValues: rules.enum, provided: data[key] },
                { component: 'ValidationSchema', operation: 'validateSchema' }
            );
        }

        // String length validation
        if (rules.type === 'string' && rules.maxLength !== undefined) {
            if (data[key].length > rules.maxLength) {
                throw new ValidationError(
                    `Field '${key}' should not exceed ${rules.maxLength} characters`,
                    { field: key, maxLength: rules.maxLength, actualLength: data[key].length },
                    { component: 'ValidationSchema', operation: 'validateSchema' }
                );
            }
        }

        // Object properties validation
        if (rules.type === 'object' && rules.properties) {
            validateSchema(data[key], rules.properties);
        }
    }
}

export function validateToolConfig(config: any): void {
    validateSchema(config, {
        name: { type: 'string', required: true },
        description: { type: 'string', required: true },
        inputs: { type: 'object', required: true },
        handler: { type: 'function', required: true },
        timeout: { type: 'number' },
        retry: {
            type: 'object',
            properties: {
                enabled: { type: 'boolean', required: true },
                maxAttempts: { type: 'number' },
                delay: { type: 'number' },
                backoffFactor: { type: 'number' },
                retryableErrors: { type: 'object' }
            }
        },
        cache: {
            type: 'object',
            properties: {
                enabled: { type: 'boolean', required: true },
                ttl: { type: 'number' },
                maxSize: { type: 'number' }
            }
        },
        validation: {
            type: 'object',
            properties: {
                schema: { type: 'object', required: true }
            }
        },
        monitoring: {
            type: 'object',
            properties: {
                collectMetrics: { type: 'boolean' },
                logLevel: { type: 'string', enum: ['silent', 'info', 'debug', 'error'] },
                alertOnFailure: { type: 'boolean' }
            }
        }
    });
}

export function validateAgentConfig(config: any): void {
    validateSchema(config, {
        name: { type: 'string', required: true },
        description: { type: 'string', required: true },
        task: { type: 'string', required: true },
        tools: { type: 'object', required: true },
        llm: {
            type: 'object',
            required: true,
            properties: {
                provider: { type: 'string', enum: ['openai', 'anthropic', 'google'], required: true },
                model: { type: 'string', required: true },
                temperature: { type: 'number' },
                maxTokens: { type: 'number' }
            }
        },
        maxCalls: { type: 'number' },
        requireApproval: { type: 'boolean' },
        timeout: { type: 'number' }
    });
}

export function validateTeamConfig(config: any): void {
    validateSchema(config, {
        name: { type: 'string', required: true },
        description: { type: 'string', required: true },
        agents: { type: 'object', required: true },
        manager: { type: 'boolean' },
        strategy: {
            type: 'object',
            properties: {
                name: { type: 'string', required: true },
                description: { type: 'string', required: true },
                assignmentLogic: { type: 'function', required: true },
                coordinationRules: {
                    type: 'object',
                    properties: {
                        maxParallelTasks: { type: 'number' },
                        taskTimeout: { type: 'number' },
                        loadBalancing: { type: 'boolean' }
                    }
                }
            }
        }
    });
}

export function validatePipelineConfig(config: any): void {
    validateSchema(config, {
        name: { type: 'string', required: true },
        description: { type: 'string', required: true },
        steps: {
            type: 'object',
            required: true,
            properties: {
                name: { type: 'string', required: true },
                tool: { type: 'string', required: true },
                description: { type: 'string', required: true },
                chained: { type: 'number', required: true },
                expects: { type: 'object', required: true },
                outputs: { type: 'object', required: true }
            }
        }
    });
}

export function assertString(value: unknown, name: string): asserts value is string {
    if (typeof value !== 'string') {
        throw new ValidationError(
            `${name} must be a string`,
            { provided: typeof value, expected: 'string', name },
            { component: 'ValidationAssertion', operation: 'assertString' }
        );
    }
}

export function assertObject(value: unknown, name: string): asserts value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) {
        throw new ValidationError(
            `${name} must be an object`,
            { provided: typeof value, expected: 'object', name },
            { component: 'ValidationAssertion', operation: 'assertObject' }
        );
    }
}

export function assertArray(value: unknown, name: string): asserts value is unknown[] {
    if (!Array.isArray(value)) {
        throw new ValidationError(
            `${name} must be an array`,
            { provided: typeof value, expected: 'array', name },
            { component: 'ValidationAssertion', operation: 'assertArray' }
        );
    }
}

export function assertNumber(value: unknown, name: string): asserts value is number {
    if (typeof value !== 'number') {
        throw new ValidationError(
            `${name} must be a number`,
            { provided: typeof value, expected: 'number', name },
            { component: 'ValidationAssertion', operation: 'assertNumber' }
        );
    }
}

export function assertBoolean(value: unknown, name: string): asserts value is boolean {
    if (typeof value !== 'boolean') {
        throw new ValidationError(
            `${name} must be a boolean`,
            { provided: typeof value, expected: 'boolean', name },
            { component: 'ValidationAssertion', operation: 'assertBoolean' }
        );
    }
}

export function assertFunction(value: unknown, name: string): asserts value is Function {
    if (typeof value !== 'function') {
        throw new ValidationError(
            `${name} must be a function`,
            { provided: typeof value, expected: 'function', name },
            { component: 'ValidationAssertion', operation: 'assertFunction' }
        );
    }
}

export function assertDefined<T>(value: T | undefined | null, name: string): asserts value is T {
    if (value === undefined || value === null) {
        throw new ValidationError(
            `${name} must be defined`,
            { provided: value, name },
            { component: 'ValidationAssertion', operation: 'assertDefined' }
        );
    }
} 