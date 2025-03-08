// Component types
export type ComponentType = 'tool' | 'agent' | 'team' | 'pipeline';

// Base component interface
export interface Component {
    initialize?(): Promise<void>;
    [key: string]: any;
}

// Component configuration
export interface ComponentConfig {
    [key: string]: any;
}

// Export specific component types
export interface Tool extends Component {
    run(input: any): Promise<any>;
}

export interface Agent extends Component {
    run(task: string, options?: any): Promise<any>;
}

export interface Team extends Component {
    run(task: string, options?: any): Promise<any>;
}

export interface Pipeline extends Component {
    run(input?: any): Promise<any>;
} 