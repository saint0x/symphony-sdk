import { RateLimitConfig } from '../types';
import { logger, LogCategory } from '../../../../utils/logger';

export class RateLimiter {
    private requestsPerSecond: Map<number, number>;
    private requestsPerMinute: Map<number, number>;
    private config: RateLimitConfig;

    constructor(config: RateLimitConfig) {
        this.config = config;
        this.requestsPerSecond = new Map();
        this.requestsPerMinute = new Map();
    }

    private getCurrentSecond(): number {
        return Math.floor(Date.now() / 1000);
    }

    private getCurrentMinute(): number {
        return Math.floor(Date.now() / (60 * 1000));
    }

    private cleanOldEntries(): void {
        const currentSecond = this.getCurrentSecond();
        const currentMinute = this.getCurrentMinute();

        // Clean second-based entries older than 5 seconds
        for (const [second] of this.requestsPerSecond) {
            if (currentSecond - second > 5) {
                this.requestsPerSecond.delete(second);
            }
        }

        // Clean minute-based entries older than 5 minutes
        for (const [minute] of this.requestsPerMinute) {
            if (currentMinute - minute > 5) {
                this.requestsPerMinute.delete(minute);
            }
        }
    }

    public async acquire(): Promise<void> {
        this.cleanOldEntries();

        const currentSecond = this.getCurrentSecond();
        const currentMinute = this.getCurrentMinute();

        const currentSecondRequests = this.requestsPerSecond.get(currentSecond) || 0;
        const currentMinuteRequests = this.requestsPerMinute.get(currentMinute) || 0;

        if (currentSecondRequests >= this.config.maxRequestsPerSecond) {
            const waitTime = 1000 - (Date.now() % 1000);
            logger.warn(LogCategory.SYSTEM, 'Rate limit exceeded (per second)', {
                metadata: {
                    keyPrefix: this.config.keyPrefix,
                    waitTime,
                    currentRequests: currentSecondRequests
                }
            });
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.acquire();
        }

        if (currentMinuteRequests >= this.config.maxRequestsPerMinute) {
            const waitTime = 60000 - (Date.now() % 60000);
            logger.warn(LogCategory.SYSTEM, 'Rate limit exceeded (per minute)', {
                metadata: {
                    keyPrefix: this.config.keyPrefix,
                    waitTime,
                    currentRequests: currentMinuteRequests
                }
            });
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.acquire();
        }

        this.requestsPerSecond.set(currentSecond, currentSecondRequests + 1);
        this.requestsPerMinute.set(currentMinute, currentMinuteRequests + 1);
    }

    public release(): void {
        // Optional: Implement if you need to release tokens early
        // This is a simple implementation, for more complex scenarios
        // you might want to actually decrement counters
    }
} 