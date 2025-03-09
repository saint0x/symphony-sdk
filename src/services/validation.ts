import { BaseService } from './base';
import { IValidationService } from './interfaces';
import { ISymphony } from '../types/symphony';
import { ValidationSchema } from '../types/validation';
import { ToolLifecycleState } from '../types/lifecycle';
import { ValidationResult } from '../types/validation';

export class ValidationService extends BaseService implements IValidationService {
    private schemas: Map<string, ValidationSchema> = new Map();

    constructor(symphony: ISymphony) {
        super(symphony, 'ValidationService');
        this._dependencies = [];
    }

    get state(): ToolLifecycleState {
        return this._state;
    }

    getDependencies(): string[] {
        return this._dependencies;
    }

    addSchema(name: string, schema: ValidationSchema): void {
        this.assertInitialized();
        if (this.schemas.has(name)) {
            throw new Error(`Schema ${name} already exists`);
        }
        this.schemas.set(name, schema);
        this.logInfo(`Added schema: ${name}`);
    }

    removeSchema(name: string): void {
        this.assertInitialized();
        if (!this.schemas.has(name)) {
            throw new Error(`Schema ${name} does not exist`);
        }
        this.schemas.delete(name);
        this.logInfo(`Removed schema: ${name}`);
    }

    listSchemas(): string[] {
        this.assertInitialized();
        return Array.from(this.schemas.keys());
    }

    async validate(data: unknown, schema: string): Promise<boolean> {
        return this.withErrorHandling('validate', async () => {
            this.assertInitialized();
            const schemaObj = this.schemas.get(schema);
            if (!schemaObj) {
                throw new Error(`Schema ${schema} not found`);
            }

            // Validate data against schema
            const result = await this.validateAgainstSchema(data, schemaObj);
            return result.isValid;
        });
    }

    private async validateAgainstSchema(data: unknown, schema: ValidationSchema): Promise<ValidationResult> {
        // Basic type validation
        if (schema.type === 'string' && typeof data !== 'string') {
            return {
                isValid: false,
                errors: [{ path: '', message: 'Expected string' }]
            };
        }

        if (schema.type === 'number' && typeof data !== 'number') {
            return {
                isValid: false,
                errors: [{ path: '', message: 'Expected number' }]
            };
        }

        if (schema.type === 'boolean' && typeof data !== 'boolean') {
            return {
                isValid: false,
                errors: [{ path: '', message: 'Expected boolean' }]
            };
        }

        if (schema.type === 'object' && (typeof data !== 'object' || data === null)) {
            return {
                isValid: false,
                errors: [{ path: '', message: 'Expected object' }]
            };
        }

        // Additional validations based on schema properties
        if (schema.enum && !schema.enum.includes(data)) {
            return {
                isValid: false,
                errors: [{ path: '', message: `Value must be one of: ${schema.enum.join(', ')}` }]
            };
        }

        return { isValid: true, errors: [] };
    }

    protected async initializeInternal(): Promise<void> {
        this.logInfo('Initializing validation service');
        this._state = ToolLifecycleState.READY;
    }
} 