# Symphonic SDK Usage Guide

This guide provides comprehensive documentation for using the Symphonic SDK, including all available features, parameters, and standard tools.

## Table of Contents

- [Core Concepts](#core-concepts)

- [Tools](#tools)
  - [Creating Custom Tools](#creating-custom-tools)
  - [Standard Tools](#standard-tools)
  - [Tool Parameters](#tool-parameters)
- [Agents](#agents)
  - [Creating Agents](#creating-agents)
  - [Agent Parameters](#agent-parameters)
- [Teams](#teams)
  - [Creating Teams](#creating-teams)
  - [Team Parameters](#team-parameters)
- [Pipelines](#pipelines)
  - [Creating Pipelines](#creating-pipelines)
  - [Pipeline Parameters](#pipeline-parameters)
- [Advanced Usage](#advanced-usage)
  - [Error Handling](#error-handling)
  - [Chaining](#chaining)
  - [Streaming](#streaming)

## Core Concepts

Symphonic is built around four core components:

1. **Tools**: Individual functions that perform specific tasks
2. **Agents**: Intelligent entities that can use tools to accomplish objectives
3. **Teams**: Groups of agents that collaborate to solve complex problems
4. **Pipelines**: Predefined sequences of tool executions for structured workflows

## Tools

Tools are the fundamental building blocks of Symphonic. They represent discrete functions that can be executed to perform specific tasks.

### Creating Custom Tools

You can create custom tools using the `symphony.tools.create()` method:

```typescript
const myTool = symphony.tools.create({
    name: "myTool",
    description: "Performs a specific task",
    inputs: ["param1", "param2"],
    handler: async (params) => {
        // Your tool logic here
        return { success: true, result: "output" };
    }
});
```

### Standard Tools

Symphonic provides a set of standard tools that you can use without implementation. Simply reference them by name in your agents, teams, or pipelines:

#### File System Tools

| Tool Name | Description | Parameters | Returns |
|-----------|-------------|------------|---------|
| `readFile` | Read file contents | `path` (string) | `{ content: string }` |
| `writeFile` | Write content to file | `path` (string), `content` (string) | `{ success: boolean }` |

#### Search Tools

| Tool Name | Description | Parameters | Returns |
|-----------|-------------|------------|---------|
| `webSearch` | Search the web using Serper.dev | `query` (string), `type?` (string) | `{ results: object[] }` |

#### Document Tools

| Tool Name | Description | Parameters | Returns |
|-----------|-------------|------------|---------|
| `parseDocument` | Parse document content | `path` (string), `format?` (string) | `{ content: string, metadata: object }` |

#### Code Tools

| Tool Name | Description | Parameters | Returns |
|-----------|-------------|------------|---------|
| `writeCode` | Generate code based on spec | `spec` (string), `language` (string), `context?` (object) | `{ code: string, explanation: string }` |

#### Planning Tools

| Tool Name | Description | Parameters | Returns |
|-----------|-------------|------------|---------|
| `createPlan` | Create execution plan | `objective` (string), `constraints?` (object), `context?` (object) | `{ plan: object }` |

#### Cognitive Tools

| Tool Name | Description | Parameters | Returns |
|-----------|-------------|------------|---------|
| `ponderTool` | Deep thinking with structured steps | `query` (string), `context?` (object), `steps?` (string), `depth?` (number) | `{ thoughts: object[], conclusion: string }` |

You can use these standard tools directly in your agents:

```typescript
const myAgent = symphony.agent.create({
    name: "myAgent",
    description: "Handles file operations",
    task: "read and process files",
    tools: ["readFile", "writeFile", "parseDocument"],
    llm: "gpt-4"
});
```

The system automatically maps these user-friendly names to the appropriate internal tool implementations.

### Tool Parameters

When creating a tool, the following parameters are available:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Name of the tool |
| `description` | string | Yes | Description of what the tool does |
| `inputs` | string[] | Yes | Array of input parameter names |
| `outputs` | string[] | No | Array of output parameter names (defaults to `["result"]`) |
| `chained` | number | No | Tool's role in the chain (see [Chaining](#chaining)) |
| `handler` | function | Yes | Async function that implements the tool logic |
| `timeout` | number | No | Maximum execution time in milliseconds |
| `retry` | object | No | Retry configuration (see below) |

#### Retry Configuration

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `enabled` | boolean | Yes | Whether retries are enabled |
| `maxAttempts` | number | No | Maximum number of retry attempts |

| `delay` | number | No | Delay between retries in milliseconds |

#### Handler Function

The handler function can be implemented in two ways:

1. **Single parameter style** (for tools with one input):
   ```typescript
   handler: async (value) => {
       // Process the single input value
       return { success: true, result: output };
   }
   ```

2. **Object parameter style** (for tools with multiple inputs):
   ```typescript
   handler: async (params) => {
       // Access params.param1, params.param2, etc.
       return { success: true, result: output };
   }
   ```

The handler function should return an object with:
- `success`: boolean indicating success or failure
- Either `result` or `data`: the output of the tool

## Agents

Agents are intelligent entities that can use tools to accomplish objectives.

### Creating Agents

You can create agents using the `symphony.agent.create()` method:

```typescript
const myAgent = symphony.agent.create({
    name: "myAgent",
    description: "Handles specific tasks",
    task: "perform data analysis",
    tools: [myTool, "readFile", "webSearch"],
    llm: "gpt-4"
});
```

### Agent Parameters

When creating an agent, the following parameters are available:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Name of the agent |
| `description` | string | Yes | Description of what the agent does |
| `task` | string | Yes | The task this agent is designed to perform |
| `tools` | string[] or object[] | Yes | Tools the agent can use (can be tool names, custom tool objects, or tool IDs) |
| `llm` | string | Yes | LLM model to use (e.g., "gpt-4", "claude-3") |
| `maxCalls` | number | No | Maximum number of tool calls the agent can make |
| `requireApproval` | boolean | No | Whether tool executions require user approval |
| `timeout` | number | No | Maximum execution time in milliseconds |

## Teams

Teams are groups of agents that collaborate to solve complex problems.

### Creating Teams

You can create teams using the `symphony.team.create()` method:

```typescript
const myTeam = symphony.team.create({
    name: "myTeam",
    description: "Collaborates on complex tasks",
    agents: [agent1, agent2],
    manager: true,
    log: { inputs: true, outputs: true }
});
```

### Team Parameters

When creating a team, the following parameters are available:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Name of the team |
| `description` | string | Yes | Description of what the team does |
| `agents` | string[] or object[] | Yes | Agents in the team (can be agent IDs or agent objects) |
| `teams` | string[] or object[] | No | Sub-teams (for hierarchical teams) |
| `manager` | boolean | No | Whether the team has a manager agent |
| `log` | object | No | Logging configuration (see below) |

#### Logging Configuration

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `inputs` | boolean | No | Whether to log inputs |
| `outputs` | boolean | No | Whether to log outputs |

## Pipelines

Pipelines are predefined sequences of tool executions for structured workflows.

### Creating Pipelines

You can create pipelines using the `symphony.pipeline.create()` method:

```typescript
const myPipeline = symphony.pipeline.create({
    name: "myPipeline",
    description: "Processes data in a structured way",
    steps: [
        {
            name: "step1",
            tool: "readFile",
            description: "Read input file",
            chained: 1,
            expects: { path: "string" },
            outputs: { content: "string" }
        },
        {
            name: "step2",
            tool: myCustomTool,
            description: "Process file content",
            chained: 2,
            expects: { content: "string" },
            outputs: { result: "object" }
        },
        // More steps...
    ]
});
```

### Pipeline Parameters

When creating a pipeline, the following parameters are available:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Name of the pipeline |
| `description` | string | Yes | Description of what the pipeline does |
| `steps` | PipelineStep[] | Yes | Array of pipeline steps |

#### Pipeline Step Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Name of the step |
| `description` | string | Yes | Description of what the step does |
| `tool` | string or object | Yes | Tool to execute (can be a standard tool name, custom tool object, or tool ID) |
| `chained` | number | No | Position in execution chain |
| `expects` | object | No | Expected input types (e.g., `{ param1: "string" }`) |
| `outputs` | object | No | Expected output types (e.g., `{ result: "object" }`) |

## Advanced Usage

### Error Handling

All components support error handling through the `success` and `error` properties in their return values:

```typescript
try {
    const result = await myTool.run({ param1: "value" });
    if (!result.success) {
        console.error(`Error: ${result.error}`);
    }
} catch (error) {
    console.error(`Exception: ${error.message}`);
}
```

### Chaining

Tools can be chained together using the `chained` parameter. The semantic numbering system automatically determines the flow of data between tools:

```typescript
// Type 1: Initial tools - receive input from agent and start a chain
const fetchTool = createTool({ 
    chained: 1            // Indicates this tool takes agent input and starts chain
});     

// Type 2: Intermediary tools - process data within the chain
const cleanTool = createTool({ 
    chained: 2.1          // First intermediary processing step - automatically feeds into 2.2
});  

const validateTool = createTool({ 
    chained: 2.2          // Second intermediary processing step - automatically feeds into 2.3
}); 

const transformTool = createTool({ 
    chained: 2.3          // Third intermediary processing step - automatically feeds into 3
});    

// Type 3: Final tools - complete the chain and return to agent
const formatTool = createTool({ 
    chained: 3            // Indicates this tool completes the chain and returns to agent
});    
```

#### Chain Number Semantics

The numbering system represents the tool's role in the processing chain and automatically determines data flow:

- **Type 1 (Initial)**: Tools that receive input directly from the agent and initiate a processing chain
  - Always numbered as `1`
  - Automatically feeds into the first Type 2 tool (2.1)
  - Example: Data fetching, input validation

- **Type 2 (Intermediary)**: Tools that process data within the chain
  - Numbered as `2.x` where x indicates processing order
  - Automatically feeds into the next numbered step (2.1 → 2.2 → 2.3)
  - Can have multiple sub-steps (2.1, 2.2, 2.3, etc.)
  - Last 2.x step automatically feeds into Type 3
  - Example: Cleaning, validation, transformation

- **Type 3 (Final)**: Tools that complete the chain and return results to the agent
  - Always numbered as `3`
  - Automatically returns output to agent
  - Example: Final formatting, output validation

Example workflow with semantic roles:
```typescript
1     -> Initial data fetch (agent → chain)
2.1   -> Data cleaning     (chain → chain)
2.2   -> Data validation   (chain → chain)
2.3   -> Data transform    (chain → chain)
3     -> Final formatting  (chain → agent)
```

This semantic numbering system provides several benefits:
- **Clear Data Flow**: Numbers indicate direction of data flow through the system
- **Role Clarity**: Each tool's role in the chain is immediately apparent
- **Flexible Processing**: Intermediary steps can be added or modified as needed
- **Agent Integration**: Clear indication of agent interaction points
- **Chain Validation**: Easy to verify complete paths from agent input to output

This pattern is particularly useful for:
- Multi-stage data processing pipelines
- Complex validation workflows
- ETL operations
- Data transformation sequences
- Any workflow where data flows from agent through multiple processing steps and back

### Streaming

For long-running operations, you can use streaming execution:

```typescript
const stream = myAgent.executeStream("perform complex analysis");

for await (const update of stream) {
    console.log(`Progress: ${update.status}`);
    if (update.result) {
        console.log(`Partial result: ${JSON.stringify(update.result)}`);
    }
}
```

## Examples

For complete examples, see [EXAMPLE.md](./EXAMPLE.md). 
