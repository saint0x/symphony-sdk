import { CircuitBreakerConfig } from '../types';
import { logger, LogCategory } from '../../../../utils/logger';

enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private config: CircuitBreakerConfig;
    private successfulProbes: number = 0;
    private readonly REQUIRED_SUCCESSFUL_PROBES = 3;

    constructor(config: CircuitBreakerConfig) {
        this.config = config;
    }

    public isAllowed(): boolean {
        this.checkStateTransition();

        switch (this.state) {
            case CircuitState.CLOSED:
                return true;
            case CircuitState.OPEN:
                return false;
            case CircuitState.HALF_OPEN:
                return true;
            default:
                return false;
        }
    }

    private checkStateTransition(): void {
        const now = Date.now();

        switch (this.state) {
            case CircuitState.CLOSED:
                if (this.failureCount >= this.config.failureThreshold) {
                    this.transitionTo(CircuitState.OPEN);
                }
                break;

            case CircuitState.OPEN:
                if (now - this.lastFailureTime >= this.config.resetTimeoutMs) {
                    this.transitionTo(CircuitState.HALF_OPEN);
                }
                break;

            case CircuitState.HALF_OPEN:
                if (this.successfulProbes >= this.REQUIRED_SUCCESSFUL_PROBES) {
                    this.transitionTo(CircuitState.CLOSED);
                }
                break;
        }
    }

    private transitionTo(newState: CircuitState): void {
        const oldState = this.state;
        this.state = newState;

        // Reset counters on state change
        if (newState === CircuitState.CLOSED) {
            this.failureCount = 0;
            this.successfulProbes = 0;
        } else if (newState === CircuitState.HALF_OPEN) {
            this.successfulProbes = 0;
        }

        logger.info(LogCategory.SYSTEM, 'Circuit breaker state transition', {
            metadata: {
                from: oldState,
                to: newState,
                failureCount: this.failureCount,
                successfulProbes: this.successfulProbes
            }
        });
    }

    public recordSuccess(): void {
        if (this.state === CircuitState.HALF_OPEN) {
            this.successfulProbes++;
            if (this.successfulProbes >= this.REQUIRED_SUCCESSFUL_PROBES) {
                this.transitionTo(CircuitState.CLOSED);
            }
        }

        // In CLOSED state, we might want to gradually reduce the failure count
        if (this.state === CircuitState.CLOSED && this.failureCount > 0) {
            this.failureCount = Math.max(0, this.failureCount - 1);
        }
    }

    public recordFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === CircuitState.HALF_OPEN) {
            this.transitionTo(CircuitState.OPEN);
        } else if (this.state === CircuitState.CLOSED && 
                   this.failureCount >= this.config.failureThreshold) {
            this.transitionTo(CircuitState.OPEN);
        }

        logger.warn(LogCategory.SYSTEM, 'Circuit breaker failure recorded', {
            metadata: {
                state: this.state,
                failureCount: this.failureCount,
                threshold: this.config.failureThreshold
            }
        });
    }

    public async checkHealth(): Promise<boolean> {
        if (!this.config.healthCheckEndpoint) {
            return true;
        }

        try {
            const response = await fetch(this.config.healthCheckEndpoint);
            return response.ok;
        } catch (error) {
            logger.error(LogCategory.SYSTEM, 'Health check failed', {
                metadata: {
                    endpoint: this.config.healthCheckEndpoint,
                    error: error instanceof Error ? error.message : String(error)
                }
            });
            return false;
        }
    }
} 