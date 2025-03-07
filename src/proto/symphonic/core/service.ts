import { ServiceMetadata, ServiceContext } from './types';

export interface ComponentService {
    metadata: ServiceMetadata;
    methods: {
        [methodName: string]: (request: any, context?: ServiceContext) => Promise<any>;
    };
}

export interface ServiceOptions {
    name: string;
    version: string;
    type: 'TOOL' | 'AGENT' | 'TEAM' | 'PIPELINE';
    description?: string;
    inputParams?: Array<{
        name: string;
        required: boolean;
        description: string;
    }>;
    customMetadata?: {
        [key: string]: any;
    };
}

export interface ServiceMethod {
    name: string;
    handler: (request: any, context?: ServiceContext) => Promise<any>;
    description?: string;
    inputSchema?: any;
    outputSchema?: any;
}

export function createService(options: ServiceOptions, methods: ServiceMethod[]): ComponentService {
    const methodMap: { [key: string]: (request: any, context?: ServiceContext) => Promise<any> } = {};
    
    for (const method of methods) {
        methodMap[method.name] = method.handler;
    }

    return {
        metadata: {
            id: `${options.type.toLowerCase()}_${options.name}_${Date.now()}`,
            name: options.name,
            version: options.version,
            type: options.type,
            status: 'ACTIVE',
            description: options.description,
            inputParams: options.inputParams,
            customMetadata: options.customMetadata
        },
        methods: methodMap
    };
} 