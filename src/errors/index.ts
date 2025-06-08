/**
 * Symphony SDK Error Handling System
 * 
 * Provides consistent, actionable error handling across the entire SDK.
 * Designed for both developer experience and programmatic error handling.
 */

// ==========================================
// ERROR SEVERITY LEVELS
// ==========================================

export enum ErrorSeverity {
    LOW = 'low',           // Warning-level, operation can continue
    MEDIUM = 'medium',     // Error but recoverable
    HIGH = 'high',         // Critical error, operation should stop
    CRITICAL = 'critical'  // System-level error, requires immediate attention
}

// ==========================================
// ERROR CATEGORIES & CODES
// ==========================================

export enum ErrorCategory {
    VALIDATION = 'VALIDATION',
    CONFIGURATION = 'CONFIGURATION', 
    RUNTIME = 'RUNTIME',
    LLM = 'LLM',
    TOOL = 'TOOL',
    DATABASE = 'DATABASE',
    NETWORK = 'NETWORK',
    PERMISSION = 'PERMISSION',
    TIMEOUT = 'TIMEOUT',
    RESOURCE = 'RESOURCE'
}

export enum ErrorCode {
    // Validation Errors (1000-1999)
    INVALID_INPUT = 'E1001',
    MISSING_REQUIRED_FIELD = 'E1002',
    INVALID_TYPE = 'E1003',
    INVALID_FORMAT = 'E1004',
    VALUE_OUT_OF_RANGE = 'E1005',
    
    // Configuration Errors (2000-2999)
    MISSING_API_KEY = 'E2001',
    INVALID_CONFIG = 'E2002',
    ENVIRONMENT_MISMATCH = 'E2003',
    MISSING_DEPENDENCY = 'E2004',
    INCOMPATIBLE_VERSION = 'E2005',
    
    // Runtime Errors (3000-3999)
    EXECUTION_FAILED = 'E3001',
    STATE_CORRUPTION = 'E3002',
    RESOURCE_EXHAUSTED = 'E3003',
    DEADLOCK_DETECTED = 'E3004',
    
    // LLM Errors (4000-4999)
    LLM_API_ERROR = 'E4001',
    LLM_RATE_LIMITED = 'E4002',
    LLM_QUOTA_EXCEEDED = 'E4003',
    LLM_INVALID_RESPONSE = 'E4004',
    LLM_TOKEN_LIMIT = 'E4005',
    
    // Tool Errors (5000-5999)
    TOOL_NOT_FOUND = 'E5001',
    TOOL_EXECUTION_FAILED = 'E5002',
    TOOL_TIMEOUT = 'E5003',
    TOOL_PERMISSION_DENIED = 'E5004',
    TOOL_INVALID_PARAMETERS = 'E5005',
    
    // Database Errors (6000-6999)
    DB_CONNECTION_FAILED = 'E6001',
    DB_QUERY_FAILED = 'E6002',
    DB_CONSTRAINT_VIOLATION = 'E6003',
    DB_TRANSACTION_FAILED = 'E6004',
    DB_MIGRATION_FAILED = 'E6005',
    
    // Network Errors (7000-7999)
    NETWORK_TIMEOUT = 'E7001',
    NETWORK_UNAVAILABLE = 'E7002',
    NETWORK_RATE_LIMITED = 'E7003',
    
    // Permission Errors (8000-8999)
    INSUFFICIENT_PERMISSIONS = 'E8001',
    AUTHENTICATION_FAILED = 'E8002',
    AUTHORIZATION_FAILED = 'E8003',
    
    // Resource Errors (9000-9999)
    OUT_OF_MEMORY = 'E9001',
    DISK_FULL = 'E9002',
    CPU_LIMIT_EXCEEDED = 'E9003'
}

// ==========================================
// CORE ERROR INTERFACE
// ==========================================

export interface SymphonyErrorData {
    code: ErrorCode;
    category: ErrorCategory;
    severity: ErrorSeverity;
    message: string;
    details?: any;
    context?: Record<string, any>;
    userGuidance?: string;
    recoveryActions?: string[];
    timestamp: Date;
    component: string;
    operation?: string;
    correlationId?: string;
}

// ==========================================
// BASE SYMPHONY ERROR CLASS
// ==========================================

export class SymphonyError extends Error {
    public readonly code: ErrorCode;
    public readonly category: ErrorCategory;
    public readonly severity: ErrorSeverity;
    public readonly details?: any;
    public readonly context?: Record<string, any>;
    public readonly userGuidance?: string;
    public readonly recoveryActions?: string[];
    public readonly timestamp: Date;
    public readonly component: string;
    public readonly operation?: string;
    public readonly correlationId?: string;

    constructor(data: SymphonyErrorData) {
        super(data.message);
        this.name = 'SymphonyError';
        this.code = data.code;
        this.category = data.category;
        this.severity = data.severity;
        this.details = data.details;
        this.context = data.context;
        this.userGuidance = data.userGuidance;
        this.recoveryActions = data.recoveryActions;
        this.timestamp = data.timestamp;
        this.component = data.component;
        this.operation = data.operation;
        this.correlationId = data.correlationId;

        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SymphonyError);
        }
    }

    /**
     * Convert error to a structured object for logging/serialization
     */
    toJSON(): Record<string, any> {
        return {
            name: this.name,
            code: this.code,
            category: this.category,
            severity: this.severity,
            message: this.message,
            details: this.details,
            context: this.context,
            userGuidance: this.userGuidance,
            recoveryActions: this.recoveryActions,
            timestamp: this.timestamp.toISOString(),
            component: this.component,
            operation: this.operation,
            correlationId: this.correlationId,
            stack: this.stack
        };
    }

    /**
     * Get user-friendly error description with guidance
     */
    getUserMessage(): string {
        let message = this.message;
        if (this.userGuidance) {
            message += `\n\nWhat to do: ${this.userGuidance}`;
        }
        if (this.recoveryActions && this.recoveryActions.length > 0) {
            message += `\n\nRecovery actions:\n${this.recoveryActions.map(action => `• ${action}`).join('\n')}`;
        }
        return message;
    }

    /**
     * Check if this error is recoverable
     */
    isRecoverable(): boolean {
        return this.severity === ErrorSeverity.LOW || this.severity === ErrorSeverity.MEDIUM;
    }
}

// ==========================================
// SPECIALIZED ERROR CLASSES
// ==========================================

export class ValidationError extends SymphonyError {
    constructor(message: string, details?: any, context?: Record<string, any>) {
        super({
            code: ErrorCode.INVALID_INPUT,
            category: ErrorCategory.VALIDATION,
            severity: ErrorSeverity.MEDIUM,
            message,
            details,
            context,
            userGuidance: 'Check your input parameters and ensure they meet the required format and constraints.',
            recoveryActions: [
                'Verify all required fields are provided',
                'Check data types match expected formats',
                'Review parameter documentation'
            ],
            timestamp: new Date(),
            component: 'Validation'
        });
        this.name = 'ValidationError';
    }
}

export class ConfigurationError extends SymphonyError {
    constructor(message: string, details?: any, context?: Record<string, any>) {
        super({
            code: ErrorCode.INVALID_CONFIG,
            category: ErrorCategory.CONFIGURATION,
            severity: ErrorSeverity.HIGH,
            message,
            details,
            context,
            userGuidance: 'Review your configuration settings and ensure all required values are properly set.',
            recoveryActions: [
                'Check environment variables',
                'Verify configuration file syntax',
                'Ensure all required API keys are set'
            ],
            timestamp: new Date(),
            component: 'Configuration'
        });
        this.name = 'ConfigurationError';
    }
}

export class LLMError extends SymphonyError {
    constructor(
        code: ErrorCode,
        message: string,
        details?: any,
        context?: Record<string, any>
    ) {
        const userGuidance = code === ErrorCode.MISSING_API_KEY 
            ? 'Set your OpenAI API key using the OPENAI_API_KEY environment variable or provide it in your configuration.'
            : code === ErrorCode.LLM_RATE_LIMITED
            ? 'You are being rate limited. Wait a moment before retrying or upgrade your API plan.'
            : 'Check your LLM configuration and API status.';

        const recoveryActions = code === ErrorCode.LLM_RATE_LIMITED
            ? ['Wait 60 seconds before retrying', 'Implement exponential backoff', 'Consider upgrading API tier']
            : code === ErrorCode.LLM_QUOTA_EXCEEDED
            ? ['Check your API usage limits', 'Upgrade your plan', 'Optimize token usage']
            : ['Verify API key is valid', 'Check network connectivity', 'Review request parameters'];

        super({
            code,
            category: ErrorCategory.LLM,
            severity: ErrorSeverity.HIGH,
            message,
            details,
            context,
            userGuidance,
            recoveryActions,
            timestamp: new Date(),
            component: 'LLM'
        });
        this.name = 'LLMError';
    }
}

export class ToolError extends SymphonyError {
    constructor(
        toolName: string,
        code: ErrorCode,
        message: string,
        details?: any,
        context?: Record<string, any>
    ) {
        const userGuidance = code === ErrorCode.TOOL_NOT_FOUND
            ? `Tool '${toolName}' is not registered. Check the tool name and ensure it's properly configured.`
            : code === ErrorCode.TOOL_INVALID_PARAMETERS
            ? `Invalid parameters provided to tool '${toolName}'. Check the parameter requirements.`
            : `Tool '${toolName}' execution failed. Check the tool configuration and input parameters.`;

        super({
            code,
            category: ErrorCategory.TOOL,
            severity: ErrorSeverity.MEDIUM,
            message,
            details: { ...details, toolName },
            context,
            userGuidance,
            recoveryActions: [
                'Verify tool name is correct',
                'Check parameter format and types',
                'Review tool documentation',
                'Test with simpler parameters'
            ],
            timestamp: new Date(),
            component: 'Tool',
            operation: `${toolName}.execute`
        });
        this.name = 'ToolError';
    }
}

export class DatabaseError extends SymphonyError {
    constructor(
        code: ErrorCode,
        message: string,
        details?: any,
        context?: Record<string, any>
    ) {
        const userGuidance = code === ErrorCode.DB_CONNECTION_FAILED
            ? 'Database connection failed. Check your database configuration and network connectivity.'
            : 'Database operation failed. Check the operation parameters and database state.';

        super({
            code,
            category: ErrorCategory.DATABASE,
            severity: ErrorSeverity.HIGH,
            message,
            details,
            context,
            userGuidance,
            recoveryActions: [
                'Check database connection settings',
                'Verify database is running',
                'Review query syntax and parameters',
                'Check available disk space'
            ],
            timestamp: new Date(),
            component: 'Database'
        });
        this.name = 'DatabaseError';
    }
}

// ==========================================
// ERROR RESULT INTERFACES
// ==========================================

export interface ErrorResult<T = any> {
    success: false;
    error: SymphonyError;
    data?: T;
    metadata?: {
        retryable: boolean;
        retryAfter?: number;
        correlationId?: string;
    };
}

export interface SuccessResult<T = any> {
    success: true;
    data: T;
    metadata?: {
        performance?: {
            duration: number;
            startTime: number;
            endTime: number;
        };
        correlationId?: string;
    };
}

export type Result<T = any> = SuccessResult<T> | ErrorResult<T>;

// ==========================================
// ERROR UTILITIES
// ==========================================

export class ErrorUtils {
    /**
     * Create a standardized success result
     */
    static success<T>(data: T, metadata?: any): SuccessResult<T> {
        return {
            success: true,
            data,
            metadata
        };
    }

    /**
     * Create a standardized error result
     */
    static error<T>(error: SymphonyError, metadata?: any): ErrorResult<T> {
        return {
            success: false,
            error,
            metadata: {
                retryable: error.isRecoverable(),
                correlationId: error.correlationId,
                ...metadata
            }
        };
    }

    /**
     * Wrap an async operation with error handling
     */
    static async withErrorHandling<T>(
        operation: () => Promise<T>,
        component: string,
        operationName?: string,
        context?: Record<string, any>
    ): Promise<Result<T>> {
        try {
            const startTime = Date.now();
            const data = await operation();
            const endTime = Date.now();
            
            return ErrorUtils.success(data, {
                performance: {
                    duration: endTime - startTime,
                    startTime,
                    endTime
                }
            });
        } catch (error) {
            if (error instanceof SymphonyError) {
                return ErrorUtils.error(error);
            }
            
            // Convert unknown errors to SymphonyError
            const symphonyError = ErrorUtils.convertError(error, component, operationName, context);
            return ErrorUtils.error(symphonyError);
        }
    }

    /**
     * Convert unknown errors to SymphonyError with smart detection
     */
    static convertError(
        error: any, 
        component: string, 
        operation?: string, 
        context?: Record<string, any>
    ): SymphonyError {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // API Key errors
        if (errorMessage.includes('API key') || errorMessage.includes('invalid_api_key')) {
            return new LLMError(
                ErrorCode.MISSING_API_KEY,
                'OpenAI API key is missing or invalid',
                error,
                { ...context, originalError: error }
            );
        }

        // Rate limiting
        if (error.status === 429 || errorMessage.includes('rate limit')) {
            return new LLMError(
                ErrorCode.LLM_RATE_LIMITED,
                'Rate limit exceeded',
                error,
                { ...context, originalError: error }
            );
        }

        // Quota exceeded
        if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
            return new LLMError(
                ErrorCode.LLM_QUOTA_EXCEEDED,
                'API quota exceeded',
                error,
                { ...context, originalError: error }
            );
        }

        // Database connection errors
        if (error.code === 'ECONNREFUSED' || errorMessage.includes('connection')) {
            return new DatabaseError(
                ErrorCode.DB_CONNECTION_FAILED,
                'Database connection failed',
                error,
                { ...context, originalError: error }
            );
        }

        // Tool not found
        if (errorMessage.includes('not found') || errorMessage.includes('not registered')) {
            const toolName = context?.toolName || 'unknown';
            return new ToolError(
                toolName,
                ErrorCode.TOOL_NOT_FOUND,
                errorMessage,
                error,
                { ...context, originalError: error }
            );
        }

        // Generic fallback
        return new SymphonyError({
            code: ErrorCode.EXECUTION_FAILED,
            category: ErrorCategory.RUNTIME,
            severity: ErrorSeverity.HIGH,
            message: errorMessage,
            details: error,
            context: { ...context, originalError: error },
            userGuidance: 'Review the error details and try again. If the problem persists, check your configuration.',
            recoveryActions: [
                'Check input parameters',
                'Verify configuration',
                'Review error details',
                'Try with simpler inputs'
            ],
            timestamp: new Date(),
            component,
            operation
        });
    }

    /**
     * Convert legacy ToolResult to new Result format
     */
    static fromToolResult<T>(toolResult: any): Result<T> {
        if (toolResult.success) {
            return ErrorUtils.success(toolResult.result, {
                performance: toolResult.metrics
            });
        } else {
            const error = new SymphonyError({
                code: ErrorCode.TOOL_EXECUTION_FAILED,
                category: ErrorCategory.TOOL,
                severity: ErrorSeverity.MEDIUM,
                message: toolResult.error || 'Tool execution failed',
                details: toolResult.details,
                userGuidance: 'Check the tool parameters and try again.',
                recoveryActions: [
                    'Verify tool parameters',
                    'Check tool documentation',
                    'Try with different inputs'
                ],
                timestamp: new Date(),
                component: 'Tool'
            });
            
            return ErrorUtils.error(error);
        }
    }

    /**
     * Convert Result back to legacy ToolResult format for backward compatibility
     */
    static toToolResult<T>(result: Result<T>): any {
        if (result.success) {
            return {
                success: true,
                result: result.data,
                metrics: result.metadata?.performance
            };
        } else {
            return {
                success: false,
                error: result.error.message,
                details: {
                    code: result.error.code,
                    component: result.error.component,
                    guidance: result.error.userGuidance,
                    recoveryActions: result.error.recoveryActions,
                    originalDetails: result.error.details
                }
            };
        }
    }
}

// ==========================================
// EXPORTS
// ==========================================

export default SymphonyError; 