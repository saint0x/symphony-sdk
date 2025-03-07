# Symphonic SDK Namespace Design

## Overview

The Symphonic SDK follows a structured, namespace-driven approach similar to LangChain and CrewAI, ensuring modularity, extensibility, and maintainability. Each namespace encapsulates a specific domain of functionality, providing clear separation between agent orchestration, pipeline management, LLM interaction, and tool integration.

This document serves as the definitive reference for the frontend implementation of our TypeScript SDK, outlining each module's structure, metadata, and arguments.

## Namespace Structure

### Symphonic.Agent
Handles agent instantiation, decision-making logic, and tool delegation.

#### Methods & Properties

##### `createAgent(config: AgentConfig): AgentInstance`
Creates a new agent instance with specified configuration.

**Arguments:**
- `id: string` - Unique identifier for the agent
- `name: string` - Human-readable name
- `role: string` - Defines the agent's primary function
- `tools: ToolInstance[]` - Tools available to the agent
- `llm: LLMInstance` - Language model interface
- `logLevel?: LogLevel` - Optional logging level for agent operations (defaults to NORMAL)

**Returns:** `AgentInstance`

##### `execute(task: TaskInput): Promise<TaskOutput>`
Executes a task using the agent's capabilities.

**Arguments:**
- `task: string` - Task description
- `metadata: ExecutionMetadata | null` - Optional execution metadata
- `logLevel?: LogLevel` - Override default log level for this execution

**Returns:** `Promise<TaskOutput>`

### Symphonic.Team
Orchestrates multi-agent collaboration and task delegation.

#### Methods & Properties

##### `createTeam(config: TeamConfig): TeamInstance`
Creates a new team of agents with specified configuration.

**Arguments:**
- `id: string` - Unique identifier for the team
- `name: string` - Human-readable name
- `agents: AgentInstance[]` - Team members
- `hierarchy?: TeamHierarchy` - Optional team structure definition
- `delegationStrategy?: DelegationStrategy` - How tasks are distributed
- `logLevel?: LogLevel` - Optional logging level for team operations

**Returns:** `TeamInstance`

##### `delegate(task: TaskInput): Promise<TeamOutput>`
Delegates a task to the appropriate team member(s).

**Arguments:**
- `task: string` - Task description
- `strategy?: DelegationOverride` - Optional override for delegation strategy
- `logLevel?: LogLevel` - Override default log level for this delegation

**Returns:** `Promise<TeamOutput>`

##### `getAgent(id: string): AgentInstance | null`
Retrieves an agent from the team by ID.

**Arguments:**
- `id: string` - Agent identifier

**Returns:** `AgentInstance | null`

### Symphonic.Pipeline
Manages tool chaining and complex execution flows.

#### Methods & Properties

##### `createPipeline(config: PipelineConfig): PipelineInstance`
Creates a new pipeline for sequential tool execution.

**Arguments:**
- `id: string` - Unique identifier for the pipeline
- `name: string` - Human-readable name
- `steps: PipelineStep[]` - Ordered array of execution steps
- `errorStrategy?: ErrorStrategy` - How to handle failures
- `metadata?: PipelineMetadata` - Optional pipeline metadata
- `logLevel?: LogLevel` - Optional logging level for pipeline operations

**Returns:** `PipelineInstance`

##### `execute(input: any): Promise<PipelineOutput>`
Executes the pipeline with given input.

**Arguments:**
- `input: any` - Initial pipeline input
- `options?: ExecutionOptions` - Optional execution parameters
- `logLevel?: LogLevel` - Override default log level for this execution

**Returns:** `Promise<PipelineOutput>`

##### `addStep(step: PipelineStep): void`
Adds a new step to the pipeline.

**Arguments:**
- `step: PipelineStep` - New step to add to pipeline

**Returns:** `void`

### Symphonic.LLM
Provides a standardized interface for integrating multiple language models.

#### Methods & Properties

##### `generate(prompt: string, config?: LLMConfig): Promise<string>`
Generates text using the configured language model.

**Arguments:**
- `prompt: string` - Text input for the LLM
- `config?: LLMConfig` - Model-specific settings (temperature, max tokens, etc.)

**Returns:** `Promise<string>`

##### `stream(prompt: string, config?: LLMConfig): AsyncIterable<string>`
Streams generated text from the language model.

**Arguments:**
- `prompt: string` - Text input for the LLM
- `config?: LLMConfig` - Model-specific settings

**Returns:** `AsyncIterable<string>`

##### `listModels(): string[]`
Lists available language models.

**Returns:** `string[]` - Array of available model identifiers

### Symphonic.Tools
Hosts built-in and user-defined tools that agents can invoke.

#### Methods & Properties

##### `registerTool(tool: ToolInstance): void`
Registers a new tool in the system.

**Arguments:**
- `tool: ToolInstance` - The tool object to be registered

**Returns:** `void`

##### `invokeTool(id: string, input: any): Promise<any>`
Invokes a registered tool with given input.

**Arguments:**
- `id: string` - Unique identifier of the tool
- `input: any` - Input payload for the tool
- `logLevel?: LogLevel` - Override default log level for this invocation

**Returns:** `Promise<any>` - Tool execution result

##### `listTools(): ToolInstance[]`
Lists all registered tools.

**Returns:** `ToolInstance[]` - Array of registered tools

## Type Definitions

### Logging Types

```typescript
enum LogLevel {
    SILENT = 0,    // No logging
    NORMAL = 1,    // Basic operation confirmation
    VERBOSE = 2,   // Detailed operation information
    DEBUG = 3      // Full debug information
}

interface LogConfig {
    inputs?: boolean;           // Log input values
    outputs?: boolean;          // Log output values
    performance?: boolean;      // Log timing and resource usage
    verbose?: boolean;          // Log detailed execution steps
}

interface ToolDefinition {
    id: string;                                    // Unique identifier for the tool
    name: string;                                  // Human-readable name
    description: string;                           // Tool description
    inputs: string[];                              // Expected input types
    handler: (...args: any[]) => Promise<any>;     // Tool implementation
    log?: {                                       // Logging configuration
        inputs?: boolean;                         // Log input values
        outputs?: boolean;                        // Log output values
        performance?: boolean;                    // Log timing and resource usage
        verbose?: boolean;                        // Log detailed execution steps
    };
}

interface PipelineStep {
    id: string;                                    // Unique identifier for the step
    tool: ToolInstance;                            // Tool to execute
    inputMap: (prevOutput: any) => any;            // Maps previous output to tool input
    condition?: (prevOutput: any) => boolean;      // Optional execution condition
    retryStrategy?: RetryConfig;                   // Optional retry configuration
    log?: LogConfig;                              // Step-specific logging
}

interface TeamHierarchy {
    leader: AgentInstance;                         // Team leader agent
    subordinates: {                                // Hierarchical structure
        [key: string]: AgentInstance[];            // Groups of subordinate agents
    };
}

interface DelegationStrategy {
    type: 'round-robin' | 'capability-based' | 'load-balanced';  // Distribution strategy
    rules: DelegationRule[];                       // Rules for task delegation
}

interface ErrorStrategy {
    type: 'stop' | 'skip' | 'retry';              // Error handling behavior
    maxRetries?: number;                          // Maximum retry attempts
    fallback?: PipelineStep;                      // Fallback step on failure
}
```

## Summary

This structured namespace approach ensures that Symphonic SDK remains scalable and easy to integrate. Each module follows a clear separation of concerns, making it modular, extensible, and maintainable for frontend and agent-driven AI applications. The addition of Team and Pipeline namespaces enables sophisticated multi-agent collaboration and complex tool chaining scenarios, while maintaining a clean and intuitive API surface. The logging system provides flexible visibility into tool operations without impacting the core functionality or performance.