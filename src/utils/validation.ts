import { logger, LogCategory } from './logger';
import { ValidationConfig } from '../types/sdk';

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

export function validateConfig(config: Record<string, any>, schema: Record<string, any>): ValidationResult {
    const errors: string[] = [];
    
    for (const [key, value] of Object.entries(schema)) {
        if (value.required && !config[key]) {
            errors.push(`Missing required field: ${key}`);
        }
        
        if (config[key] && value.type && typeof config[key] !== value.type) {
            errors.push(`Invalid type for ${key}: expected ${value.type}, got ${typeof config[key]}`);
        }
    }

    const result = {
        isValid: errors.length === 0,
        errors
    };

    if (!result.isValid) {
        logger.error(LogCategory.VALIDATION, 'Configuration validation failed', {
            metadata: {
                errors: result.errors
            }
        });
    }

    return result;
}

export function validateInput(input: Record<string, any>, schema: Record<string, any>): ValidationResult {
    return validateConfig(input, schema);
}

export function validateOutput(output: Record<string, any>, schema: Record<string, any>): ValidationResult {
    return validateConfig(output, schema);
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export function validateSchema(data: any, schema: ValidationConfig['schema']): void {
    for (const [key, rules] of Object.entries(schema)) {
        // Check required fields
        if (rules.required && (data[key] === undefined || data[key] === null)) {
            throw new ValidationError(`Required field '${key}' is missing`);
        }

        // Skip validation if field is not present and not required
        if (data[key] === undefined || data[key] === null) {
            continue;
        }

        // Type validation
        if (rules.type && typeof data[key] !== rules.type) {
            throw new ValidationError(
                `Field '${key}' should be of type '${rules.type}' but got '${typeof data[key]}'`
            );
        }

        // Enum validation
        if (rules.enum && !rules.enum.includes(data[key])) {
            throw new ValidationError(
                `Field '${key}' should be one of [${rules.enum.join(', ')}] but got '${data[key]}'`
            );
        }

        // String length validation
        if (rules.type === 'string' && rules.maxLength !== undefined) {
            if (data[key].length > rules.maxLength) {
                throw new ValidationError(
                    `Field '${key}' should not exceed ${rules.maxLength} characters`
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