import { ISymphony } from '../types/symphony';
import { BaseManager } from '../core/base';

export interface ValidationSchema {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'function';
    required?: boolean;
    arrayOf?: ValidationSchema;
    properties?: Record<string, ValidationSchema>;
    oneOf?: ValidationSchema[];
    validate?: (value: any) => boolean;
    description?: string;
}

export interface ValidationError {
    errorCode: string;
    message: string;
    component: string;
    severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
    details?: Record<string, any>;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

// Public interface for validation manager
export interface IValidationManager {
    readonly initialized: boolean;
    readonly name: string;
    readonly errorPatterns: Map<string, RegExp>;
    readonly errorThresholds: Map<string, number>;
    readonly symphony: ISymphony;

    validate(data: any, schemaName: string): ValidationResult;
    registerSchema(name: string, schema: ValidationSchema): void;
    addSchema(name: string, schema: ValidationSchema): void;
    removeSchema(name: string): void;
    listSchemas(): string[];
    validateBoolean(data: any, schemaName: string): boolean;
    initializeDefaultThresholds(): void;
    recordError(error: Error): void;
    getErrorCount(pattern: string): number;
    resetErrorCounts(): void;
    clearErrorCount(pattern: string): void;
    setErrorThreshold(pattern: string, threshold: number): void;
    validateServiceInput(serviceName: string, input: any): ValidationResult;
    validateServiceOutput(serviceName: string, output: any): ValidationResult;
    validateServiceHealth(serviceName: string): ValidationResult;
    initialize(): Promise<void>;
}

export class ValidationManager extends BaseManager implements IValidationManager {
    private static instance: ValidationManager | null = null;
    private readonly _schemas: Map<string, ValidationSchema> = new Map();
    private readonly _errorPatterns: Map<string, RegExp> = new Map();
    private readonly _errorCounts: Map<string, number> = new Map();
    private readonly _errorThresholds: Map<string, number> = new Map();
    private _symphony: ISymphony;

    protected constructor(symphony: ISymphony) {
        super('ValidationManager');
        this._symphony = symphony;
        this.initializeDefaultThresholds();
    }

    static getInstance(symphony: ISymphony): ValidationManager {
        if (!ValidationManager.instance) {
            ValidationManager.instance = new ValidationManager(symphony);
        }
        return ValidationManager.instance;
    }

    get initialized(): boolean {
        return this._initialized;
    }

    get name(): string {
        return this._name;
    }

    get errorPatterns(): Map<string, RegExp> {
        return new Map(this._errorPatterns);
    }

    get errorThresholds(): Map<string, number> {
        return new Map(this._errorThresholds);
    }

    get symphony(): ISymphony {
        return this._symphony;
    }

    initializeDefaultThresholds(): void {
        this._errorPatterns.set('timeout', /timeout/i);
        this._errorPatterns.set('network', /network error|connection refused/i);
        this._errorPatterns.set('validation', /validation failed|invalid input/i);
        
        this._errorThresholds.set('timeout', 5);
        this._errorThresholds.set('network', 3);
        this._errorThresholds.set('validation', 10);
    }

    recordError(error: Error): void {
        const validationError: ValidationError = {
            errorCode: 'VALIDATION_ERROR',
            message: error.message,
            component: this.name,
            severity: 'ERROR'
        };
        
        this.logError(validationError.message, { error: validationError });
        
        for (const [pattern, regex] of this._errorPatterns) {
            if (regex.test(error.message)) {
                const currentCount = this._errorCounts.get(pattern) || 0;
                this._errorCounts.set(pattern, currentCount + 1);
            }
        }
    }

    getErrorCount(pattern: string): number {
        return this._errorCounts.get(pattern) || 0;
    }

    resetErrorCounts(): void {
        this._errorCounts.clear();
    }

    clearErrorCount(pattern: string): void {
        this._errorCounts.delete(pattern);
    }

    setErrorThreshold(pattern: string, threshold: number): void {
        this._errorThresholds.set(pattern, threshold);
    }

    validate(data: any, schemaName: string): ValidationResult {
        const schema = this._schemas.get(schemaName);
        if (!schema) {
            return { 
                isValid: false, 
                errors: [{ 
                    errorCode: 'SCHEMA_NOT_FOUND',
                    message: `Schema not found: ${schemaName}`,
                    component: this.name,
                    severity: 'ERROR'
                }]
            };
        }

        const errors: ValidationError[] = [];
        this.validateAgainstSchema(data, schema, '', errors);

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    validateBoolean(data: any, schemaName: string): boolean {
        const result = this.validate(data, schemaName);
        return result.isValid;
    }

    validateServiceInput(serviceName: string, input: any): ValidationResult {
        const schemaName = `${serviceName}Input`;
        if (!this._schemas.has(schemaName)) {
            return {
                isValid: true,
                errors: []
            };
        }
        return this.validate(input, schemaName);
    }

    validateServiceOutput(serviceName: string, output: any): ValidationResult {
        const schemaName = `${serviceName}Output`;
        if (!this._schemas.has(schemaName)) {
            return {
                isValid: true,
                errors: []
            };
        }
        return this.validate(output, schemaName);
    }

    validateServiceHealth(_serviceName: string): ValidationResult {
        return {
            isValid: true,
            errors: []
        };
    }

    addSchema(name: string, schema: ValidationSchema): void {
        if (this._schemas.has(name)) {
            throw new Error(`Schema ${name} already exists`);
        }
        this._schemas.set(name, schema);
        this.logInfo(`Added schema: ${name}`);
    }

    removeSchema(name: string): void {
        if (!this._schemas.has(name)) {
            throw new Error(`Schema ${name} does not exist`);
        }
        this._schemas.delete(name);
        this.logInfo(`Removed schema: ${name}`);
    }

    listSchemas(): string[] {
        return Array.from(this._schemas.keys());
    }

    async initialize(): Promise<void> {
        if (this._initialized) {
            return;
        }

        this._initialized = false;
        this.logInfo('Initializing validation manager...');

        try {
            await this.initializeInternal();
            this._initialized = true;
            this.logInfo('Validation manager initialized');
        } catch (error) {
            this._initialized = false;
            this.logError('Failed to initialize validation manager', { error });
            throw error;
        }
    }

    registerSchema(name: string, schema: ValidationSchema): void {
        this._schemas.set(name, schema);
        this.logInfo(`Registered schema: ${name}`);
    }

    private validateAgainstSchema(value: any, schema: ValidationSchema, path: string, errors: ValidationError[]): void {
        if (schema.required && (value === undefined || value === null)) {
            errors.push({
                errorCode: 'REQUIRED_FIELD',
                message: `${path} is required`,
                component: this.name,
                severity: 'ERROR'
            });
            return;
        }

        if (value === undefined || value === null) {
            return;
        }

        if (schema.type === 'string' && typeof value !== 'string') {
            errors.push({
                errorCode: 'TYPE_MISMATCH',
                message: `${path} must be a string`,
                component: this.name,
                severity: 'ERROR'
            });
        } else if (schema.type === 'number' && typeof value !== 'number') {
            errors.push({
                errorCode: 'TYPE_MISMATCH',
                message: `${path} must be a number`,
                component: this.name,
                severity: 'ERROR'
            });
        } else if (schema.type === 'boolean' && typeof value !== 'boolean') {
            errors.push({
                errorCode: 'TYPE_MISMATCH',
                message: `${path} must be a boolean`,
                component: this.name,
                severity: 'ERROR'
            });
        } else if (schema.type === 'object' && (typeof value !== 'object' || value === null)) {
            errors.push({
                errorCode: 'TYPE_MISMATCH',
                message: `${path} must be an object`,
                component: this.name,
                severity: 'ERROR'
            });
        } else if (schema.type === 'array' && !Array.isArray(value)) {
            errors.push({
                errorCode: 'TYPE_MISMATCH',
                message: `${path} must be an array`,
                component: this.name,
                severity: 'ERROR'
            });
        } else if (schema.type === 'function' && typeof value !== 'function') {
            errors.push({
                errorCode: 'TYPE_MISMATCH',
                message: `${path} must be a function`,
                component: this.name,
                severity: 'ERROR'
            });
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
                    errors.push({
                        errorCode: 'REQUIRED_FIELD',
                        message: `${path}.${prop} is required`,
                        component: this.name,
                        severity: 'ERROR'
                    });
                }
            }
        }

        if (schema.oneOf) {
            let isValid = false;
            schema.oneOf.forEach((subSchema: ValidationSchema) => {
                const subErrors: ValidationError[] = [];
                this.validateAgainstSchema(value, subSchema, path, subErrors);
                if (subErrors.length === 0) {
                    isValid = true;
                }
            });
            if (!isValid) {
                errors.push({
                    errorCode: 'VALIDATION_ERROR',
                    message: `${path} must match one of the following: ${schema.oneOf.map(s => s.description || '').join(', ')}`,
                    component: this.name,
                    severity: 'ERROR'
                });
            }
        }

        if (schema.validate && !schema.validate(value)) {
            errors.push({
                errorCode: 'VALIDATION_ERROR',
                message: `${path} does not pass validation`,
                component: this.name,
                severity: 'ERROR'
            });
        }
    }

    private async initializeSchemas(): Promise<void> {
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

    protected async initializeInternal(): Promise<void> {
        await this.initializeSchemas();
    }
}