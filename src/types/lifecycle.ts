export enum ToolLifecycleState {
    CREATED = 'CREATED',
    PENDING = 'PENDING',
    INITIALIZING = 'INITIALIZING',
    READY = 'READY',
    ERROR = 'ERROR',
    DEGRADED = 'DEGRADED',
    DESTROYED = 'DESTROYED'
}

export interface ToolStateEvent {
    toolId: string;
    previousState: ToolLifecycleState;
    newState: ToolLifecycleState;
    timestamp: number;
    metadata?: Record<string, any>;
}

export interface ToolStateChangeHandler {
    (event: ToolStateEvent): Promise<void>;
}

export interface ILifecycleManager {
    getState(toolId: string): ToolLifecycleState;
    onStateChange(handler: ToolStateChangeHandler): void;
    offStateChange(handler: ToolStateChangeHandler): void;
} 