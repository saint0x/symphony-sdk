import { ToolLifecycleState } from './sdk';

export interface ToolMetadata {
    name: string;
    description?: string;
    id: string;
    inputParams?: Array<{
        name: string;
        description?: string;
        required: boolean;
        type: string;
    }>;
    outputParams?: Array<{
        name: string;
        description?: string;
        type: string;
    }>;
}

export interface Tool {
    metadata: ToolMetadata;
    state: ToolLifecycleState;
    execute(params: any): Promise<any>;
} 