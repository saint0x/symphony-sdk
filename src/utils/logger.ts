import { LogLevel } from '../types/sdk';

// Log categories for organizing log entries
export enum LogCategory {
    SYSTEM = 'system',
    REQUEST = 'request',
    DATABASE = 'database',
    CACHE = 'cache',
    AI = 'ai',
    AUTH = 'auth',
    BUSINESS = 'business',
    GRPC = 'grpc'
}

// Log entry structure
export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    category: LogCategory;
    message: string;
    data?: any;
    trace?: string;
    service?: string;
    request_id?: string;
}

// Logger configuration
export interface LoggerConfig {
    minLevel: LogLevel;
    enableConsole: boolean;
    enableDatabase: boolean;
    enableMetrics: boolean;
    verboseMode: boolean;
    serviceContext: string;
}

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
    minLevel: LogLevel.NORMAL,
    enableConsole: true,
    enableDatabase: false,
    enableMetrics: true,
    verboseMode: false,
    serviceContext: 'default'
};

// Logger implementation
export class Logger {
    private static instance: Logger;
    private config: LoggerConfig;

    private constructor(config: Partial<LoggerConfig> = {}) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config
        };
    }

    static getInstance(config?: Partial<LoggerConfig>): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(config);
        }
        return Logger.instance;
    }

    setConfig(config: Partial<LoggerConfig>): void {
        this.config = {
            ...this.config,
            ...config
        };
    }

    setVerboseMode(enabled: boolean): void {
        this.config.verboseMode = enabled;
    }

    setMinLevel(level: LogLevel): void {
        this.config.minLevel = level;
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.config.minLevel;
    }

    private formatMessage(entry: LogEntry): string {
        const timestamp = new Date(entry.timestamp).toISOString();
        const level = LogLevel[entry.level];
        const category = entry.category;
        const service = entry.service || this.config.serviceContext;
        
        let message = `[${timestamp}] ${level} [${category}] [${service}] ${entry.message}`;
        
        if (entry.data) {
            message += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
        }
        
        if (entry.trace && this.config.verboseMode) {
            message += `\n  Trace: ${entry.trace}`;
        }
        
        return message;
    }

    private async persistLog(entry: LogEntry): Promise<void> {
        if (!this.config.enableDatabase) return;

        try {
            // TODO: Implement database persistence
            // For now, just console.log
            if (this.config.verboseMode) {
                console.log(`[DB] Would persist log: ${JSON.stringify(entry)}`);
            }
        } catch (error: any) {
            console.error('Failed to persist log:', error.message);
        }
    }

    private recordMetrics(entry: LogEntry): void {
        if (!this.config.enableMetrics) return;

        try {
            // TODO: Implement metrics recording
            // For now, just console.log
            if (this.config.verboseMode) {
                console.log(`[Metrics] Would record: ${JSON.stringify({
                    type: 'log_entry',
                    level: LogLevel[entry.level],
                    category: entry.category,
                    service: entry.service || this.config.serviceContext
                })}`);
            }
        } catch (error: any) {
            console.error('Failed to record metrics:', error.message);
        }
    }

    debug(category: LogCategory, message: string, data?: { metadata?: any }): void {
        if (!this.shouldLog(LogLevel.DEBUG)) return;

        const entry: LogEntry = {
            timestamp: Date.now(),
            level: LogLevel.DEBUG,
            category,
            message,
            data: data?.metadata
        };

        if (this.config.enableConsole) {
            console.debug(this.formatMessage(entry));
        }

        this.persistLog(entry);
        this.recordMetrics(entry);
    }

    info(category: LogCategory, message: string, data?: { metadata?: any }): void {
        if (!this.shouldLog(LogLevel.NORMAL)) return;

        const entry: LogEntry = {
            timestamp: Date.now(),
            level: LogLevel.NORMAL,
            category,
            message,
            data: data?.metadata
        };

        if (this.config.enableConsole) {
            console.info(this.formatMessage(entry));
        }

        this.persistLog(entry);
        this.recordMetrics(entry);
    }

    warn(category: LogCategory, message: string, data?: { metadata?: any }): void {
        if (!this.shouldLog(LogLevel.VERBOSE)) return;

        const entry: LogEntry = {
            timestamp: Date.now(),
            level: LogLevel.VERBOSE,
            category,
            message,
            data: data?.metadata
        };

        if (this.config.enableConsole) {
            console.warn(this.formatMessage(entry));
        }

        this.persistLog(entry);
        this.recordMetrics(entry);
    }

    error(category: LogCategory, message: string, data?: { metadata?: any }): void {
        const entry: LogEntry = {
            timestamp: Date.now(),
            level: LogLevel.DEBUG,
            category,
            message,
            data: data?.metadata,
            trace: new Error().stack
        };

        if (this.config.enableConsole) {
            console.error(this.formatMessage(entry));
        }

        this.persistLog(entry);
        this.recordMetrics(entry);
    }
}

// Export singleton instance
export const logger = Logger.getInstance(); 