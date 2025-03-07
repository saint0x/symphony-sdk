# Symphonic SDK

Symphonic is the easiest way to build self-learning tools, agents, teams, and pipelines in minutes.

## Getting Started

1. Install the SDK:
```bash
npm install symphonic
# or
bun add symphonic
```

2. Import core functionality:
```typescript
import { symphony } from "symphonic";
```

3. Create your first tool:
```typescript
// Simple example of a tool
const myTool = symphony.tools.create({
    name: "example",
    description: "does something useful",
    inputs: ["data"],
    handler: async (params) => {
        try {
            // Tool implementation
            const result = await processData(params.data);
            return { 
                success: true,
                result
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }
});

// Usage
try {
    const result = await myTool.run({ data: "example input" });
    if (result.success) {
        console.log("Success:", result.result);
    } else {
        console.error("Error:", result.error.message);
    }
} catch (error) {
    console.error("Execution error:", error);
}
```

4. Build up from there!

For a more thorough overview of functionality and detailed examples, check out our [Usage Guide](./USAGE.md).

## Core Concepts

### Tools: The Basic Building Blocks

Tools are the fundamental units of work in Symphonic. They are pure functions that perform specific tasks with well-defined inputs and outputs.

```typescript
const myTool = symphony.tools.create({
    name: "toolName",
    description: "what it does",
    inputs: ["param1", "param2"],
    handler: async (params) => {
        const startTime = Date.now();
        try {
            // Your logic here
            const result = await processParams(params.param1, params.param2);
            return {
                result,
                success: true,
                metrics: {
                    duration: Date.now() - startTime,
                    startTime,
                    endTime: Date.now()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                metrics: {
                    duration: Date.now() - startTime,
                    startTime,
                    endTime: Date.now()
                }
            };
        }
    },
    retry: {
        enabled: true,
        maxAttempts: 3,
        delay: 1000
    },
    timeout: 5000
});

// Usage with error handling
try {
    const result = await myTool.run({ 
        param1: value1, 
        param2: value2 
    });
    if (!result.success) {
        console.error(`Tool error: ${result.error?.message}`);
    }
} catch (error) {
    console.error(`Execution error: ${error.message}`);
}
```

Tools follow these principles:
- Single responsibility: Each tool does one thing well
- Pure functions: Same inputs always produce same outputs
- Error handling: Always return `{ result, success }` objects
- Async by default: All handlers are async functions

### Agents: Intelligent Tool Users

Agents wrap tools with AI capabilities, using LLMs to:
- Select appropriate tools for tasks
- Process inputs and outputs
- Handle error conditions
- Make decisions based on context

```typescript
const myAgent = symphony.agent.create({
    name: "agentName",
    description: "agent purpose",
    task: "specific task description",
    tools: [tool1, tool2],
    llm: {
        provider: "openai",
        model: "gpt-4",
        temperature: 0.7,
        maxTokens: 2000
    },
    maxCalls: 10,
    requireApproval: false,
    timeout: 30000
});

// Usage with streaming
const result = await myAgent.run("natural language task description", {
    onProgress: (update) => {
        console.log(`Progress: ${update.status}`);
    },
    onMetrics: (metrics) => {
        console.log(`Metrics: ${JSON.stringify(metrics)}`);
    }
});
```

Agent features:
- Natural language interface
- Automatic tool selection
- Context awareness
- Error recovery
- Task decomposition

### Teams: Coordinated Agent Groups

Teams organize multiple agents into collaborative units with:
- Shared context
- Coordinated workflows
- Managed communication
- Centralized logging

```typescript
const myTeam = symphony.team.create({
    name: "teamName",
    description: "team purpose",
    agents: [agent1, agent2],
    manager: true,
    strategy: {
        name: "roundRobin",
        description: "Distribute tasks evenly",
        assignmentLogic: async (task, agents) => agents,
        coordinationRules: {
            maxParallelTasks: 3,
            taskTimeout: 5000
        }
    },
    log: {
        inputs: true,
        outputs: true,
        metrics: true
    }
});

// Usage with error handling
try {
    const result = await myTeam.run("complex task description", {
        timeout: 60000,
        onProgress: (update) => {
            console.log(`Team progress: ${update.status}`);
        }
    });
    if (!result.success) {
        console.error(`Team error: ${result.error?.message}`);
    }
} catch (error) {
    console.error(`Team execution error: ${error.message}`);
}
```

Team capabilities:
- Task distribution
- Resource sharing
- Progress monitoring
- Error propagation
- Result aggregation

### Pipelines: Fixed Workflows

Pipelines define fixed sequences of operations with:
- Explicit data flow
- Type checking
- Chain validation
- Performance optimization

```typescript
const myPipeline = symphony.pipeline.create({
    name: "pipelineName",
    description: "pipeline purpose",
    steps: [
        {
            name: "step1",
            tool: tool1,
            description: "step purpose",
            chained: 1,
            expects: { param1: "string" },
            outputs: { result: "object" },
            retry: {
                maxAttempts: 3,
                delay: 1000
            }
        },
        {
            name: "step2",
            tool: tool2,
            description: "step purpose",
            chained: 2.1,
            expects: { result: "object" },
            outputs: { processed: "object" },
            conditions: {
                requiredFields: ["result"],
                validateOutput: (output) => output.processed !== null
            }
        }
    ],
    onError: async (error, context) => {
        return { retry: true, delay: 1000 };
    },
    metrics: {
        enabled: true,
        detailed: true,
        trackMemory: true
    }
});

// Usage with monitoring
const result = await myPipeline.run({ initialInput: value }, {
    onStepComplete: (step, result) => {
        console.log(`Step ${step.name} complete: ${result.success}`);
    },
    onMetrics: (metrics) => {
        console.log(`Pipeline metrics: ${JSON.stringify(metrics)}`);
    }
});
```

Pipeline features:
- Static validation
- Performance optimization
- Error recovery
- Progress tracking
- Type safety

## Advanced Topics

### Error Handling
All components support structured error handling:
- Tools return success/failure status
- Agents can retry operations
- Teams can redistribute tasks
- Pipelines can attempt recovery

### Logging
Comprehensive logging available at all levels:
- Tool execution
- Agent decisions
- Team communication
- Pipeline progress

### Performance
Built-in performance optimization:
- Parallel execution where possible
- Resource management
- Caching
- Load balancing

### Security
Security features include:
- Input validation
- Output sanitization
- Access control
- Audit logging

## Component Hierarchy

The components form a natural hierarchy:
1. Tools: Basic operations
2. Agents: Intelligent tool users
3. Teams: Coordinated agent groups
4. Pipelines: Fixed workflows

Each layer adds capabilities:
- Tools → Pure functions
- Agents → Intelligence
- Teams → Coordination
- Pipelines → Structure

## Best Practices

### Tool Design
- Keep tools simple and focused
- Use clear naming conventions
- Document inputs and outputs
- Handle errors gracefully
- Include type definitions

### Agent Configuration
- Provide clear task descriptions
- Choose appropriate LLMs
- Limit tool access appropriately
- Configure logging
- Handle timeouts

### Team Organization
- Group related agents
- Enable appropriate logging
- Configure management level
- Set communication patterns
- Define error policies

### Pipeline Construction
- Validate data flow
- Define types clearly
- Order steps logically
- Handle edge cases
- Monitor performance



Happy building!