# Symphonic SDK Examples

## Basic Usage

### Tools

```typescript
import { core } from "symphonic";

// example data references
const source = "raw.csv";

// data processing tools
const fetchTool = symphonic.tools.create({
    name: "fetch",
    description: "fetches raw data from source",
    inputs: ["source"],
    chained: 1,
    target: "clean",
    handler: async (source) => { 
        // write your tool logic here
        // in this example, code to read from a file
        return { result: rawData, success: true }
    }
});

const cleanTool = symphonic.tools.create({
    name: "clean",
    description: "cleans raw data",
    inputs: ["data"],
    chained: 2.1,
    target: "validate",
    handler: async (data) => {
        // write your tool logic here
        // in this example, code to remove invalid entries
        return { result: cleanData, success: true }
    }
});

const validateTool = symphonic.tools.create({
    name: "validate",
    description: "validates cleaned data",
    inputs: ["data"],
    chained: 2.2,
    target: "transform",
    handler: async (data) => {
        // write your tool logic here
        // in this example, code to check data rules
        return { result: validData, success: true }
    }
});

const transformTool = symphonic.tools.create({
    name: "transform",
    description: "transforms valid data",
    inputs: ["data"],
    chained: 2.3,
    target: "format",
    handler: async (data) => {
        // write your tool logic here
        // in this example, code to convert data format
        return { result: transformedData, success: true }
    }
});

const formatTool = symphonic.tools.create({
    name: "format",
    description: "formats final output",
    inputs: ["data"],
    chained: 3,
    handler: async (data) => {
        // write your tool logic here
        // in this example, code to structure the output
        return { result: formatted, success: true }
    }
});

// use tools directly
await fetchTool.run({ source: "data.csv" });
await cleanTool.run({ data: rawData });
```

### Agents

```typescript
// agent handles tool selection and chaining automatically
const fetchAgent = symphonic.agent.create({
    name: "fetch",
    description: "handles data fetching operations",
    task: "fetch and load data from specified sources",
    tools: [fetchTool],
    llm: "gpt-4"
});

const cleanAgent = symphonic.agent.create({
    name: "clean",
    description: "handles data cleaning operations",
    task: "clean and preprocess raw data for validation",
    tools: [cleanTool],
    llm: "gpt-4"
});

const validateAgent = symphonic.agent.create({
    name: "validate",
    description: "handles data validation",
    task: "validate data against defined rules and standards",
    tools: [validateTool],
    llm: "gpt-3.5-turbo"
});

const transformAgent = symphonic.agent.create({
    name: "transform",
    description: "handles data transformation",
    task: "transform validated data into required format",
    tools: [transformTool],
    llm: "gpt-4"
});

const formatAgent = symphonic.agent.create({
    name: "format",
    description: "handles output formatting",
    task: "format and structure final output data",
    tools: [formatTool],
    llm: "gpt-4"
});

// agent executes its tools based on task description
await fetchAgent.run("fetch data from data.csv");
```

### Teams

```typescript
// specialized teams for complex workflows
const dataTeam = symphonic.team.create({
    name: "data",
    description: "handles data acquisition and cleaning",
    agents: [fetchAgent, cleanAgent],
    manager: true,
    log: { inputs: true }
});

const processTeam = symphonic.team.create({
    name: "process",
    description: "handles validation and transformation",
    agents: [validateAgent, transformAgent],
    manager: true,
    log: { outputs: true }
});

const formatTeam = symphonic.team.create({
    name: "format",
    description: "handles final output formatting",
    agents: [formatAgent],
    manager: false, // direct output to user
    log: { outputs: true }
});

// team for coordinating multiple teams
const orchestrationTeam = symphonic.team.create({
    name: "orchestration",
    description: "orchestrates all processing teams",
    teams: [dataTeam, processTeam, formatTeam],
    manager: true // centralize all team outputs
});

// team handles coordination (for complex dynamic workflows)
await orchestrationTeam.run("process data.csv with validation and custom formatting");
```

### Pipelines

```typescript
// pipeline for orchestrating teams in fixed sequence
const processPipeline = symphonic.pipeline.create({
    name: "process",
    description: "processes data through fixed steps",
    steps: [
        {
            name: "fetch",
            tool: fetchTool,
            description: "fetches raw data",
            chained: 1,
            target: "clean",
            expects: {
                source: "string" // file path or URL
            },
            outputs: {
                result: "Buffer", // raw file contents
                success: "boolean"
            }
        },
        {
            name: "clean",
            tool: cleanTool,
            description: "cleans raw data",
            chained: 2.1,
            target: "validate",
            expects: {
                data: "Buffer" // raw data from fetch
            },
            outputs: {
                result: {
                    rows: "array",
                    metadata: "object"
                },
                success: "boolean"
            }
        },
        {
            name: "validate",
            tool: validateTool,
            description: "validates cleaned data",
            chained: 2.2,
            target: "transform",
            expects: {
                data: {
                    rows: "array",
                    metadata: "object"
                }
            },
            outputs: {
                result: {
                    validated: "boolean",
                    data: "array"
                },
                success: "boolean"
            }
        },
        {
            name: "transform",
            tool: transformTool,
            description: "transforms valid data",
            chained: 2.3,
            target: "format",
            expects: {
                data: {
                    validated: "boolean",
                    data: "array"
                }
            },
            outputs: {
                result: {
                    formatted: "array",
                    stats: "object"
                },
                success: "boolean"
            }
        },
        {
            name: "format",
            tool: formatTool,
            description: "formats final content",
            chained: 3,
            expects: {
                data: {
                    formatted: "array",
                    stats: "object"
                }
            },
            outputs: {
                result: {
                    result: "string",
                    output: "array"
                },
                success: "boolean"
            }
        }
    ]
});

// pipeline executes predefined steps in order
await processPipeline.run({ source: "data.csv" });
```