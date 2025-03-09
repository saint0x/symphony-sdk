export interface ValidationSchema {
    type: string;
    required?: boolean;
    properties?: Record<string, ValidationSchema>;
    items?: ValidationSchema;
    enum?: any[];
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    format?: string;
    minimum?: number;
    maximum?: number;
    multipleOf?: number;
    uniqueItems?: boolean;
    additionalProperties?: boolean | ValidationSchema;
}

export interface ValidationResult {
    isValid: boolean;
    errors: Array<{
        path: string;
        message: string;
    }>;
}

export interface ValidationOptions {
    allowUnknownProperties?: boolean;
    coerceTypes?: boolean;
    removeAdditional?: boolean;
    useDefaults?: boolean;
} 