/**
 * Symphony SDK Error Handling - Pragmatic Elite Approach
 * 
 * Balances sophistication with simplicity.
 * Focus on actionable errors and recovery strategies.
 */

// ==========================================
// SIMPLE BUT POWERFUL ERROR CODES
// ==========================================

export const ErrorCodes = {
  // Configuration (2xxx)
  MISSING_API_KEY: 'E2001',
  INVALID_CONFIG: 'E2002',
  
  // LLM (4xxx) 
  LLM_API_ERROR: 'E4001',
  LLM_RATE_LIMITED: 'E4002',
  LLM_QUOTA_EXCEEDED: 'E4003',
  
  // Tools (5xxx)
  TOOL_NOT_FOUND: 'E5001',
  TOOL_EXECUTION_FAILED: 'E5002',
  TOOL_INVALID_PARAMS: 'E5005',
  
  // Database (6xxx)
  DB_CONNECTION_FAILED: 'E6001',
  DB_QUERY_FAILED: 'E6002',
  
  // Runtime (3xxx)
  EXECUTION_FAILED: 'E3001',
  VALIDATION_FAILED: 'E1001'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ==========================================
// ENHANCED RESULT TYPE
// ==========================================

export interface SuccessResult<T = any> {
  success: true;
  data: T;
  metrics?: {
    duration: number;
    startTime: number;
    endTime: number;
  };
}

export interface ErrorResult<T = any> {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    guidance?: string;
    details?: any;
    component: string;
    recoverable: boolean;
  };
  context?: Record<string, any>;
  fallbackData?: T; // For graceful degradation
}

export type Result<T = any> = SuccessResult<T> | ErrorResult<T>;

// ==========================================
// SMART ERROR UTILITIES
// ==========================================

export class Errors {
  /**
   * Create success result with optional metrics
   */
  static success<T>(data: T, metrics?: any): SuccessResult<T> {
    return { success: true, data, metrics };
  }

  /**
   * Create error result with smart defaults and guidance
   */
  static error<T>(
    code: ErrorCode,
    message: string,
    component: string,
    options?: {
      details?: any;
      context?: Record<string, any>;
      guidance?: string;
      fallbackData?: T;
    }
  ): ErrorResult<T> {
    const guidance = options?.guidance || Errors.getGuidance(code);
    const recoverable = Errors.isRecoverable(code);

    return {
      success: false,
      error: {
        code,
        message,
        guidance,
        details: options?.details,
        component,
        recoverable
      },
      context: options?.context,
      fallbackData: options?.fallbackData
    };
  }

  /**
   * Wrap async operations with consistent error handling
   */
  static async wrap<T>(
    operation: () => Promise<T>,
    component: string,
    context?: Record<string, any>
  ): Promise<Result<T>> {
    const startTime = Date.now();
    
    try {
      const data = await operation();
      const endTime = Date.now();
      
      return Errors.success(data, {
        duration: endTime - startTime,
        startTime,
        endTime
      });
    } catch (error) {
      // Smart error detection and conversion
      return Errors.convertError(error, component, context);
    }
  }

  /**
   * Convert various error types to our standard format
   */
  static convertError(error: any, component: string, context?: Record<string, any>): ErrorResult {
    // API Key errors
    if (error.message?.includes('API key') || error.code === 'invalid_api_key') {
      return Errors.error(
        ErrorCodes.MISSING_API_KEY,
        'OpenAI API key is missing or invalid',
        component,
        { 
          details: error,
          context,
          guidance: 'Set OPENAI_API_KEY environment variable or provide apiKey in config'
        }
      );
    }

    // Rate limiting
    if (error.code === 'rate_limit_exceeded' || error.status === 429) {
      return Errors.error(
        ErrorCodes.LLM_RATE_LIMITED,
        'Rate limit exceeded',
        component,
        {
          details: error,
          context,
          guidance: 'Wait 60 seconds before retrying or upgrade your API plan'
        }
      );
    }

    // Quota exceeded
    if (error.code === 'quota_exceeded' || error.message?.includes('quota')) {
      return Errors.error(
        ErrorCodes.LLM_QUOTA_EXCEEDED,
        'API quota exceeded',
        component,
        {
          details: error,
          context,
          guidance: 'Check your billing and usage limits'
        }
      );
    }

    // Database connection errors
    if (error.code === 'ECONNREFUSED' || error.message?.includes('connection')) {
      return Errors.error(
        ErrorCodes.DB_CONNECTION_FAILED,
        'Database connection failed',
        component,
        {
          details: error,
          context,
          guidance: 'Check database configuration and network connectivity'
        }
      );
    }

    // Tool not found
    if (error.message?.includes('not found') || error.message?.includes('not registered')) {
      return Errors.error(
        ErrorCodes.TOOL_NOT_FOUND,
        error.message || 'Tool not found',
        component,
        {
          details: error,
          context,
          guidance: 'Check tool name spelling and ensure it\'s properly registered'
        }
      );
    }

    // Generic fallback
    return Errors.error(
      ErrorCodes.EXECUTION_FAILED,
      error.message || 'Unknown error occurred',
      component,
      {
        details: error,
        context,
        guidance: 'Check the error details and try again'
      }
    );
  }

  /**
   * Get user guidance for error codes
   */
  private static getGuidance(code: ErrorCode): string {
    const guidanceMap: Record<ErrorCode, string> = {
      [ErrorCodes.MISSING_API_KEY]: 'Set your OpenAI API key in environment variables or config',
      [ErrorCodes.INVALID_CONFIG]: 'Review your configuration for missing or invalid values',
      [ErrorCodes.LLM_API_ERROR]: 'Check your LLM provider status and configuration',
      [ErrorCodes.LLM_RATE_LIMITED]: 'Wait before retrying or upgrade your API plan',
      [ErrorCodes.LLM_QUOTA_EXCEEDED]: 'Check your usage limits and billing status',
      [ErrorCodes.TOOL_NOT_FOUND]: 'Verify tool name and registration',
      [ErrorCodes.TOOL_EXECUTION_FAILED]: 'Check tool parameters and try simpler inputs',
      [ErrorCodes.TOOL_INVALID_PARAMS]: 'Review parameter format and required fields',
      [ErrorCodes.DB_CONNECTION_FAILED]: 'Check database configuration and connectivity',
      [ErrorCodes.DB_QUERY_FAILED]: 'Review query syntax and database state',
      [ErrorCodes.EXECUTION_FAILED]: 'Review the error details and input parameters',
      [ErrorCodes.VALIDATION_FAILED]: 'Check input format and required fields'
    };

    return guidanceMap[code] || 'Check the error details for more information';
  }

  /**
   * Determine if error is recoverable
   */
  private static isRecoverable(code: ErrorCode): boolean {
    const recoverableCodes = new Set<ErrorCode>([
      ErrorCodes.LLM_RATE_LIMITED,
      ErrorCodes.TOOL_EXECUTION_FAILED,
      ErrorCodes.DB_QUERY_FAILED,
      ErrorCodes.EXECUTION_FAILED
    ]);

    return recoverableCodes.has(code);
  }
}

// ==========================================
// RETRY UTILITY
// ==========================================

export class Retry {
  static async withBackoff<T>(
    operation: () => Promise<Result<T>>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<Result<T>> {
    let lastResult: Result<T>;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      lastResult = await operation();
      
      if (lastResult.success || !lastResult.error.recoverable) {
        return lastResult;
      }
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return lastResult!;
  }
}

// ==========================================
// VALIDATION HELPERS
// ==========================================

export class Validate {
  static required(value: any, fieldName: string): Result<void> {
    if (value === undefined || value === null || value === '') {
      return Errors.error(
        ErrorCodes.VALIDATION_FAILED,
        `Required field '${fieldName}' is missing`,
        'Validation',
        {
          details: { fieldName, value },
          guidance: `Provide a value for '${fieldName}'`
        }
      );
    }
    return Errors.success(undefined);
  }

  static type(value: any, expectedType: string, fieldName: string): Result<void> {
    if (typeof value !== expectedType) {
      return Errors.error(
        ErrorCodes.VALIDATION_FAILED,
        `Field '${fieldName}' must be ${expectedType}, got ${typeof value}`,
        'Validation',
        {
          details: { fieldName, expectedType, actualType: typeof value },
          guidance: `Convert '${fieldName}' to ${expectedType}`
        }
      );
    }
    return Errors.success(undefined);
  }
}

// ==========================================
// LOGGING INTEGRATION
// ==========================================

export class ErrorLogger {
  static log(result: ErrorResult, logger: any, additionalContext?: any): void {
    const { error, context } = result;
    
    const logData = {
      code: error.code,
      component: error.component,
      recoverable: error.recoverable,
      details: error.details,
      context: { ...context, ...additionalContext }
    };

    if (error.recoverable) {
      logger.warn(error.component, error.message, logData);
    } else {
      logger.error(error.component, error.message, logData);
    }
  }
} 