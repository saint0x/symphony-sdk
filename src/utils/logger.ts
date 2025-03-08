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
    GRPC = 'grpc',
    TOOL = 'tool',
    AGENT = 'agent',
    TEAM = 'team',
    PIPELINE = 'pipeline',
    METRICS = 'metrics',
    VALIDATION = 'validation',
    ERROR = 'error'
}

// Log entry structure
export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    category: LogCategory;
    message: string;
    metadata?: Record<string, any>;
    error?: Error | unknown;
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

export interface LogMetadata {
    metadata?: any;
    error?: Error | unknown;
}

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
        const level = entry.level;
        const category = entry.category;
        const service = entry.service || this.config.serviceContext;
        
        let message = `[${timestamp}] ${level} [${category}] [${service}] ${entry.message}`;
        
        if (entry.metadata) {
            message += `\n  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
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
                    level: entry.level,
                    category: entry.category,
                    service: entry.service || this.config.serviceContext
                })}`);
            }
        } catch (error: any) {
            console.error('Failed to record metrics:', error.message);
        }
    }

    debug(category: LogCategory, message: string, data?: LogMetadata): void {
        if (!this.shouldLog(LogLevel.DEBUG)) return;
        const entry = this.createLogEntry(LogLevel.DEBUG, category, message, data);
        this.formatMessage(entry);
        this.persistLog(entry);
        this.recordMetrics(entry);
        console.debug(`[${category}] ${message}`, data);
    }

    info(category: LogCategory, message: string, data?: LogMetadata): void {
        if (!this.shouldLog(LogLevel.NORMAL)) return;
        const entry = this.createLogEntry(LogLevel.NORMAL, category, message, data);
        this.formatMessage(entry);
        this.persistLog(entry);
        this.recordMetrics(entry);
        console.info(`[${category}] ${message}`, data);
    }

    warn(category: LogCategory, message: string, data?: LogMetadata): void {
        if (!this.shouldLog(LogLevel.VERBOSE)) return;
        const entry = this.createLogEntry(LogLevel.VERBOSE, category, message, data);
        this.formatMessage(entry);
        this.persistLog(entry);
        this.recordMetrics(entry);
        console.warn(`[${category}] ${message}`, data);
    }

    error(category: LogCategory, message: string, data?: LogMetadata): void {
        const entry = this.createLogEntry(LogLevel.ERROR, category, message, data);
        this.formatMessage(entry);
        this.persistLog(entry);
        this.recordMetrics(entry);
        console.error(`[${category}] ${message}`, data);
    }

    private createLogEntry(level: LogLevel, category: LogCategory, message: string, data?: LogMetadata): LogEntry {
        return {
            timestamp: Date.now(),
            level,
            category,
            message,
            metadata: data?.metadata,
            error: data?.error,
            service: this.config.serviceContext
        };
    }
}

// Export singleton instance
export const logger = Logger.getInstance(); 