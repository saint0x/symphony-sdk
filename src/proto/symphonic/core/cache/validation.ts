import { logger, LogCategory } from '../../../../utils/logger';

export interface ValidationError {
    errorCode: string;
    message: string;
    component: string;
    severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
    details?: {
        [key: string]: any;
    };
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

export class ValidationManager {
    private static instance: ValidationManager;
    private errorPatterns: Map<string, number>;
    private errorThresholds: Map<string, number>;

    private constructor() {
        this.errorPatterns = new Map();
        this.errorThresholds = new Map();
        this.initializeDefaultThresholds();
        logger.info(LogCategory.CACHE, 'ValidationManager instance created', { metadata: {} });
    }

    private initializeDefaultThresholds() {
        this.errorThresholds.set('CHAIN_EXECUTION_FAILED', 3);
        this.errorThresholds.set('TOOL_NOT_FOUND', 2);
        this.errorThresholds.set('INVALID_INPUT', 5);
        this.errorThresholds.set('EXECUTION_ERROR', 3);
        this.errorThresholds.set('TIMEOUT', 2);
        logger.debug(LogCategory.CACHE, 'Default error thresholds initialized', {
            metadata: {
                thresholds: Object.fromEntries(this.errorThresholds)
            }
        });
    }

    public static getInstance(): ValidationManager {
        if (!ValidationManager.instance) {
            ValidationManager.instance = new ValidationManager();
        }
        return ValidationManager.instance;
    }

    public recordError(error: ValidationError): void {
        const key = `${error.component}:${error.errorCode}`;
        const currentCount = this.errorPatterns.get(key) || 0;
        this.errorPatterns.set(key, currentCount + 1);

        const threshold = this.errorThresholds.get(error.errorCode);
        if (threshold && currentCount + 1 >= threshold) {
            logger.warn(LogCategory.CACHE, 'Error threshold exceeded', {
                metadata: {
                    serviceId: error.component,
                    errorCount: currentCount + 1,
                    threshold
                }
            });
        }

        logger.debug(LogCategory.CACHE, 'Error recorded', {
            metadata: {
                serviceId: error.component,
                errorCount: currentCount + 1
            }
        });
    }

    public getErrorCount(component: string, errorCode: string): number {
        const key = `${component}:${errorCode}`;
        return this.errorPatterns.get(key) || 0;
    }

    public clearErrorCount(component: string, errorCode: string): void {
        const key = `${component}:${errorCode}`;
        this.errorPatterns.delete(key);
        logger.debug(LogCategory.CACHE, 'Error count cleared', {
            metadata: {
                serviceId: component
            }
        });
    }

    public setErrorThreshold(errorCode: string, threshold: number): void {
        this.errorThresholds.set(errorCode, threshold);
        logger.debug(LogCategory.CACHE, 'Error threshold updated', {
            metadata: {
                serviceId: errorCode,
                threshold
            }
        });
    }

    public validateServiceInput(input: any, requiredParams: string[]): ValidationResult {
        const errors: ValidationError[] = [];

        for (const param of requiredParams) {
            if (!(param in input)) {
                errors.push({
                    errorCode: 'INVALID_INPUT',
                    message: `Missing required parameter: ${param}`,
                    component: 'input_validation',
                    severity: 'ERROR'
                });
            }
        }

        const result = {
            isValid: errors.length === 0,
            errors
        };

        if (!result.isValid) {
            logger.warn(LogCategory.CACHE, 'Service input validation failed', {
                metadata: {
                    serviceId: 'input_validation',
                    errors: errors.map(e => ({
                        code: e.errorCode,
                        message: e.message
                    }))
                }
            });
        }

        return result;
    }

    public validateServiceOutput(output: any, expectedType: string): ValidationResult {
        const errors: ValidationError[] = [];

        if (output === undefined || output === null) {
            errors.push({
                errorCode: 'INVALID_OUTPUT',
                message: 'Service output is null or undefined',
                component: 'output_validation',
                severity: 'ERROR'
            });
        } else if (typeof output !== expectedType) {
            errors.push({
                errorCode: 'INVALID_OUTPUT',
                message: `Expected output type ${expectedType}, got ${typeof output}`,
                component: 'output_validation',
                severity: 'ERROR'
            });
        }

        const result = {
            isValid: errors.length === 0,
            errors
        };

        if (!result.isValid) {
            logger.warn(LogCategory.CACHE, 'Service output validation failed', {
                metadata: {
                    serviceId: 'output_validation',
                    errors: errors.map(e => ({
                        code: e.errorCode,
                        message: e.message
                    }))
                }
            });
        }

        return result;
    }

    public validateServiceHealth(health: any): ValidationResult {
        const errors: ValidationError[] = [];

        if (!health.status || !['HEALTHY', 'DEGRADED', 'UNHEALTHY'].includes(health.status)) {
            errors.push({
                errorCode: 'INVALID_HEALTH_STATUS',
                message: 'Invalid health status',
                component: 'health_validation',
                severity: 'ERROR'
            });
        }

        if (!health.metrics || typeof health.metrics !== 'object') {
            errors.push({
                errorCode: 'INVALID_HEALTH_METRICS',
                message: 'Invalid health metrics',
                component: 'health_validation',
                severity: 'ERROR'
            });
        } else {
            const requiredMetrics = ['uptime', 'successRate', 'averageLatency', 'errorRate'];
            for (const metric of requiredMetrics) {
                if (typeof health.metrics[metric] !== 'number') {
                    errors.push({
                        errorCode: 'INVALID_HEALTH_METRICS',
                        message: `Missing or invalid metric: ${metric}`,
                        component: 'health_validation',
                        severity: 'ERROR'
                    });
                }
            }
        }

        const result = {
            isValid: errors.length === 0,
            errors
        };

        if (!result.isValid) {
            logger.warn(LogCategory.CACHE, 'Service health validation failed', {
                metadata: {
                    serviceId: 'health_validation',
                    errors: errors.map(e => ({
                        code: e.errorCode,
                        message: e.message
                    }))
                }
            });
        }

        return result;
    }
} 