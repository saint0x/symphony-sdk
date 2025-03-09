export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

export interface ILogger {
    log(level: LogLevel | string, message: string, metadata?: Record<string, any>): void;
    debug(message: string, metadata?: Record<string, any>): void;
    info(message: string, metadata?: Record<string, any>): void;
    warn(message: string, metadata?: Record<string, any>): void;
    error(message: string, metadata?: Record<string, any>): void;
}

export class Logger implements ILogger {
    constructor(private readonly _name: string) {}

    log(level: LogLevel | string, message: string, metadata?: Record<string, any>): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] [${level}] [${this._name}] ${message}`;
        
        if (metadata) {
            console.log(formattedMessage, metadata);
        } else {
            console.log(formattedMessage);
        }
    }

    debug(message: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, message, metadata);
    }

    info(message: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.INFO, message, metadata);
    }

    warn(message: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.WARN, message, metadata);
    }

    error(message: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.ERROR, message, metadata);
    }
} 