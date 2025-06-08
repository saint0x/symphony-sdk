/**
 * Symphony SDK Error Handlers
 * 
 * Advanced error handling patterns: retry logic, circuit breakers, and recovery strategies.
 */

import { Logger } from '../utils/logger';
import { Result, ErrorUtils, SymphonyError, ErrorSeverity } from './index';

// ==========================================
// RETRY CONFIGURATION
// ==========================================

export interface RetryConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    jitter: boolean;
    retryableErrors?: Set<string>;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,        // 1 second
    maxDelay: 30000,        // 30 seconds
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: new Set([
        'E4002', // LLM_RATE_LIMITED
        'E6001', // DB_CONNECTION_FAILED
        'E7001', // NETWORK_TIMEOUT
        'E7002', // NETWORK_UNAVAILABLE
    ])
};

// ==========================================
// CIRCUIT BREAKER CONFIGURATION
// ==========================================

export interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeout: number;
    monitoringWindow: number;
    volumeThreshold: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,      // Open after 5 failures
    resetTimeout: 60000,      // Try to reset after 60 seconds
    monitoringWindow: 120000, // Monitor failures over 2 minutes
    volumeThreshold: 10       // Minimum 10 calls before circuit can open
};

export enum CircuitState {
    CLOSED = 'CLOSED',       // Normal operation
    OPEN = 'OPEN',           // Failing fast
    HALF_OPEN = 'HALF_OPEN'  // Testing if service recovered
}

// ==========================================
// RETRY HANDLER
// ==========================================

export class RetryHandler {
    private logger: Logger;
    private config: RetryConfig;

    constructor(config: Partial<RetryConfig> = {}) {
        this.logger = Logger.getInstance('RetryHandler');
        this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    }

    /**
     * Execute operation with retry logic
     */
    async execute<T>(
        operation: () => Promise<Result<T>>,
        operationName: string,
        customConfig?: Partial<RetryConfig>
    ): Promise<Result<T>> {
        const config = customConfig ? { ...this.config, ...customConfig } : this.config;
        let lastResult: Result<T>;
        
        for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
            this.logger.info('RetryHandler', `Executing ${operationName}, attempt ${attempt}/${config.maxAttempts}`);
            
            lastResult = await operation();
            
            if (lastResult.success) {
                if (attempt > 1) {
                    this.logger.info('RetryHandler', `${operationName} succeeded after ${attempt} attempts`);
                }
                return lastResult;
            }
            
            const error = lastResult.error;
            
            // Check if error is retryable
            if (!this.isRetryable(error, config)) {
                this.logger.info('RetryHandler', `${operationName} failed with non-retryable error: ${error.code}`);
                return lastResult;
            }
            
            // Don't delay after the last attempt
            if (attempt < config.maxAttempts) {
                const delay = this.calculateDelay(attempt, config);
                this.logger.info('RetryHandler', `${operationName} failed, retrying in ${delay}ms`, {
                    attempt,
                    errorCode: error.code,
                    errorMessage: error.message
                });
                await this.sleep(delay);
            }
        }
        
        this.logger.error('RetryHandler', `${operationName} failed after ${config.maxAttempts} attempts`);
        return lastResult!;
    }

    private isRetryable(error: SymphonyError, config: RetryConfig): boolean {
        // Check if error is recoverable and in retryable list
        return error.isRecoverable() && 
               (config.retryableErrors?.has(error.code) ?? false);
    }

    private calculateDelay(attempt: number, config: RetryConfig): number {
        let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
        delay = Math.min(delay, config.maxDelay);
        
        if (config.jitter) {
            // Add ±25% jitter to prevent thundering herd
            const jitterRange = delay * 0.25;
            const jitter = (Math.random() * 2 - 1) * jitterRange;
            delay += jitter;
        }
        
        return Math.max(delay, 0);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ==========================================
// CIRCUIT BREAKER
// ==========================================

interface CircuitBreakerState {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
    lastSuccessTime: number;
    nextAttemptTime: number;
}

export class CircuitBreaker {
    private logger: Logger;
    private config: CircuitBreakerConfig;
    private state: CircuitBreakerState;
    private callHistory: Array<{ success: boolean; timestamp: number }> = [];

    constructor(
        private name: string,
        config: Partial<CircuitBreakerConfig> = {}
    ) {
        this.logger = Logger.getInstance(`CircuitBreaker:${name}`);
        this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
        this.state = {
            state: CircuitState.CLOSED,
            failureCount: 0,
            successCount: 0,
            lastFailureTime: 0,
            lastSuccessTime: 0,
            nextAttemptTime: 0
        };
    }

    /**
     * Execute operation through circuit breaker
     */
    async execute<T>(
        operation: () => Promise<Result<T>>,
        operationName: string
    ): Promise<Result<T>> {
        if (this.state.state === CircuitState.OPEN) {
            if (Date.now() < this.state.nextAttemptTime) {
                // Circuit is open and timeout hasn't elapsed
                const waitTime = this.state.nextAttemptTime - Date.now();
                this.logger.warn('CircuitBreaker', `${operationName} blocked by open circuit, try again in ${waitTime}ms`);
                
                return ErrorUtils.error(new SymphonyError({
                    code: 'E3002' as any, // STATE_CORRUPTION
                    category: 'RUNTIME' as any,
                    severity: ErrorSeverity.HIGH,
                    message: `Service ${this.name} is temporarily unavailable`,
                    userGuidance: `The service is experiencing issues. Please try again in ${Math.ceil(waitTime / 1000)} seconds.`,
                    recoveryActions: [
                        'Wait for the service to recover',
                        'Check service status',
                        'Try alternative approaches'
                    ],
                    timestamp: new Date(),
                    component: 'CircuitBreaker',
                    operation: operationName
                }), {
                    retryAfter: waitTime
                });
            } else {
                // Timeout elapsed, transition to half-open
                this.transitionToHalfOpen();
            }
        }

        if (this.state.state === CircuitState.HALF_OPEN && this.state.successCount >= 1) {
            // Already testing, don't allow more calls
            return ErrorUtils.error(new SymphonyError({
                code: 'E3002' as any,
                category: 'RUNTIME' as any,
                severity: ErrorSeverity.MEDIUM,
                message: `Service ${this.name} is being tested, please wait`,
                userGuidance: 'The service is recovering. Please try again in a moment.',
                timestamp: new Date(),
                component: 'CircuitBreaker',
                operation: operationName
            }));
        }

        // Execute the operation
        const result = await operation();
        this.recordCall(result.success);

        if (result.success) {
            this.onSuccess();
        } else {
            this.onFailure(result.error);
        }

        return result;
    }

    private recordCall(success: boolean): void {
        const now = Date.now();
        this.callHistory.push({ success, timestamp: now });
        
        // Clean old history outside monitoring window
        const cutoff = now - this.config.monitoringWindow;
        this.callHistory = this.callHistory.filter(call => call.timestamp > cutoff);
    }

    private onSuccess(): void {
        this.state.successCount++;
        this.state.lastSuccessTime = Date.now();

        if (this.state.state === CircuitState.HALF_OPEN) {
            // Success in half-open state, transition to closed
            this.transitionToClosed();
            this.logger.info('CircuitBreaker', `${this.name} circuit closed after successful test`);
        }
    }

    private onFailure(_error: SymphonyError): void {
        this.state.failureCount++;
        this.state.lastFailureTime = Date.now();

        if (this.state.state === CircuitState.HALF_OPEN) {
            // Failure in half-open state, go back to open
            this.transitionToOpen();
            this.logger.warn('CircuitBreaker', `${this.name} circuit reopened after test failure`);
        } else if (this.shouldOpenCircuit()) {
            this.transitionToOpen();
            this.logger.warn('CircuitBreaker', `${this.name} circuit opened due to failure threshold`, {
                failureCount: this.state.failureCount,
                threshold: this.config.failureThreshold
            });
        }
    }

    private shouldOpenCircuit(): boolean {
        if (this.callHistory.length < this.config.volumeThreshold) {
            return false;
        }

        const failures = this.callHistory.filter(call => !call.success).length;
        const failureRate = failures / this.callHistory.length;
        
        return failureRate >= (this.config.failureThreshold / 100);
    }

    private transitionToOpen(): void {
        this.state.state = CircuitState.OPEN;
        this.state.nextAttemptTime = Date.now() + this.config.resetTimeout;
    }

    private transitionToHalfOpen(): void {
        this.state.state = CircuitState.HALF_OPEN;
        this.state.successCount = 0;
        this.logger.info('CircuitBreaker', `${this.name} circuit transitioning to half-open`);
    }

    private transitionToClosed(): void {
        this.state.state = CircuitState.CLOSED;
        this.state.failureCount = 0;
        this.state.successCount = 0;
        this.callHistory = [];
    }

    getState(): {
        state: CircuitState;
        failureCount: number;
        successCount: number;
        callVolume: number;
        nextAttemptTime?: number;
    } {
        return {
            state: this.state.state,
            failureCount: this.state.failureCount,
            successCount: this.state.successCount,
            callVolume: this.callHistory.length,
            nextAttemptTime: this.state.state === CircuitState.OPEN ? this.state.nextAttemptTime : undefined
        };
    }
}

// ==========================================
// RESILIENCE MANAGER
// ==========================================

export class ResilienceManager {
    private retryHandler: RetryHandler;
    private circuitBreakers: Map<string, CircuitBreaker> = new Map();
    private logger: Logger;

    constructor(retryConfig?: Partial<RetryConfig>) {
        this.retryHandler = new RetryHandler(retryConfig);
        this.logger = Logger.getInstance('ResilienceManager');
    }

    /**
     * Execute operation with retry and circuit breaker protection
     */
    async executeWithResilience<T>(
        operation: () => Promise<Result<T>>,
        operationName: string,
        serviceKey: string,
        options?: {
            retry?: Partial<RetryConfig>;
            circuitBreaker?: Partial<CircuitBreakerConfig>;
            skipCircuitBreaker?: boolean;
            skipRetry?: boolean;
        }
    ): Promise<Result<T>> {
        const { skipCircuitBreaker = false, skipRetry = false } = options || {};

        // Get or create circuit breaker
        let circuitBreaker: CircuitBreaker | undefined;
        if (!skipCircuitBreaker) {
            if (!this.circuitBreakers.has(serviceKey)) {
                this.circuitBreakers.set(
                    serviceKey, 
                    new CircuitBreaker(serviceKey, options?.circuitBreaker)
                );
            }
            circuitBreaker = this.circuitBreakers.get(serviceKey);
        }

        // Wrap operation with circuit breaker if enabled
        const wrappedOperation = circuitBreaker 
            ? () => circuitBreaker.execute(operation, operationName)
            : operation;

        // Execute with retry if enabled
        if (!skipRetry) {
            return await this.retryHandler.execute(
                wrappedOperation,
                operationName,
                options?.retry
            );
        } else {
            return await wrappedOperation();
        }
    }

    /**
     * Get circuit breaker status for monitoring
     */
    getCircuitBreakerStatus(): Record<string, any> {
        const status: Record<string, any> = {};
        for (const [key, breaker] of this.circuitBreakers.entries()) {
            status[key] = breaker.getState();
        }
        return status;
    }

    /**
     * Reset all circuit breakers (for testing/admin purposes)
     */
    resetCircuitBreakers(): void {
        this.circuitBreakers.clear();
        this.logger.info('ResilienceManager', 'All circuit breakers reset');
    }
}

// ==========================================
// EXPORTS
// ==========================================

// All exports are handled inline at class/interface declarations 