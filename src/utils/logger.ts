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
    service?: string;
    correlationId?: string;
}

export interface LogMetrics {
    duration?: number;
    startTime?: number;
    endTime?: number;
    resourceUsage?: {
        memory?: number;
        cpu?: number;
    };
    customMetrics?: Record<string, number>;
}

// Logger implementation
export class Logger {
    private static instance: Logger;
    private config: LoggerConfig;

    constructor(context: string) {
        this.config = {
            ...DEFAULT_CONFIG,
            serviceContext: context
        };
    }

    public static getInstance(context: string = 'default'): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(context);
        }
        return Logger.instance;
    }

    public static createLogger(context: string): Logger {
        return new Logger(context);
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

    public info(context: string, message: string, data?: Record<string, any>): void {
        if (this.config.minLevel <= LogLevel.INFO) {
            console.log(`[INFO][${context}] ${message}`, data || '');
        }
    }

    public error(context: string, message: string, data?: Record<string, any>): void {
        if (this.config.minLevel <= LogLevel.ERROR) {
            console.error(`[ERROR][${context}] ${message}`, data || '');
        }
    }

    public warn(context: string, message: string, data?: Record<string, any>): void {
        if (this.config.minLevel <= LogLevel.WARN) {
            console.warn(`[WARN][${context}] ${message}`, data || '');
        }
    }

    public debug(context: string, message: string, data?: Record<string, any>): void {
        if (this.config.minLevel <= LogLevel.DEBUG) {
            console.debug(`[DEBUG][${context}] ${message}`, data || '');
        }
    }
}

// Export singleton instance
export const logger = Logger.getInstance(); 