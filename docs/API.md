# API Reference

## Symphony

The main class that provides access to all functionality.

```typescript
class Symphony {
    agent: {
        create: (config: AgentConfig) => Promise<Agent>;
    };
    tools: {
        create: (config: ToolConfig) => Promise<Tool>;
    };
}
```

## Configurations

### AgentConfig

```typescript
interface AgentConfig {
    name: string;
    description: string;
    task: string;
    tools: Array<string | ToolConfig>;
    llm: LLMConfig;
    maxCalls?: number;
    requireApproval?: boolean;
    timeout?: number;
    memory?: MemoryConfig;
}
```

### ToolConfig

```typescript
interface ToolConfig {
    name: string;
    description: string;
    inputs: string[];
    outputs?: string[];
    handler: (params: any) => Promise<ToolResult>;
    timeout?: number;
    cache?: CacheConfig;
    validation?: ValidationConfig;
}

interface ToolResult {
    success: boolean;
    result?: any;
    error?: Error;
    metrics?: ExecutionMetrics;
}
```

### LLMConfig

```typescript
interface LLMConfig {
    provider: 'openai' | 'anthropic' | 'google';
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}
```

### MemoryConfig

```typescript
interface BaseMemoryConfig {
    type: 'short_term' | 'long_term' | 'episodic';
    capacity?: number;
    ttl?: number;
}

interface MemoryConfig {
    shortTerm?: BaseMemoryConfig;
    longTerm?: BaseMemoryConfig;
    episodic?: BaseMemoryConfig;
}
```

### CacheConfig

```typescript
interface CacheConfig {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    keyGenerator?: (params: any) => string;
}
```

### ValidationConfig

```typescript
interface ValidationConfig {
    schema: {
        [key: string]: {
            type: string;
            required?: boolean;
            enum?: any[];
            maxLength?: number;
            properties?: Record<string, any>;
        };
    };
}
```

## Memory System

### Memory Interface

```typescript
interface Memory {
    add(key: string, value: any): Promise<void>;
    get(key: string): Promise<any>;
    search(query: string): Promise<any[]>;
    clear(): Promise<void>;
}
```

## Metrics

### ExecutionMetrics

```typescript
interface ExecutionMetrics {
    duration: number;
    startTime: number;
    endTime: number;
    stages?: Record<string, number>;
    operations?: Record<string, number>;
    modelVersions?: Record<string, string>;
    resourceUsage?: {
        memory: NodeJS.MemoryUsage;
        modelLoads?: Record<string, boolean>;
    };
}
``` 