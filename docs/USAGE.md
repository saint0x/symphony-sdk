# Usage Guide

## Quick Start

```typescript
import { Symphony } from 'symphonic';

const symphony = new Symphony();

// Create a simple agent
const agent = await symphony.agent.create({
    name: 'researcher',
    description: 'Research assistant that helps find and analyze information',
    task: 'Find and summarize information about a topic',
    tools: ['search', 'summarize', 'analyze'],
    llm: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY
    }
});

// Run a task
const result = await agent.run('Research the latest developments in quantum computing');
console.log(result);

// Stream results
for await (const update of agent.executeStream('Analyze the impact of AI on healthcare')) {
    console.log(update);
}
```

## Core Concepts

### Agents

Agents are autonomous entities that can perform tasks using tools and LLMs. Each agent has:
- A name and description
- A specific task or purpose
- Access to tools
- An LLM configuration
- Memory system (short-term, long-term, and episodic)

```typescript
const agent = await symphony.agent.create({
    name: 'analyst',
    description: 'Financial data analyst',
    task: 'Analyze financial data and provide insights',
    tools: ['analyze', 'calculate', 'visualize'],
    llm: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4'
    },
    memory: {
        shortTerm: { type: 'short_term', capacity: 100, ttl: 3600 },
        longTerm: { type: 'long_term', capacity: 1000 },
        episodic: { type: 'episodic', capacity: 50 }
    }
});
```

### Tools

Tools are functions that agents can use to interact with the world. Each tool has:
- A name and description
- Input/output specifications
- A handler function
- Optional configuration (caching, validation, etc.)

```typescript
const tool = {
    name: 'calculate',
    description: 'Perform mathematical calculations',
    inputs: ['expression'],
    outputs: ['result'],
    handler: async (params) => {
        try {
            const result = eval(params.expression);
            return { success: true, result };
        } catch (error) {
            return { success: false, error };
        }
    }
};
```

### Memory System

The memory system helps agents maintain context and learn from experience:

```typescript
// Store information
await agent.memorize('key', value, 'short_term');

// Retrieve information
const value = await agent.remember('key');

// Search memory
const results = await agent.searchMemory('query');
```

### Metrics

Track performance and resource usage:

```typescript
const metrics = agent.metrics.end();
console.log({
    duration: metrics.duration,
    operations: metrics.operations,
    resourceUsage: metrics.resourceUsage
});
```

## Best Practices

1. **Memory Management**
   - Use short-term memory for temporary data
   - Use long-term memory for important insights
   - Use episodic memory for task context

2. **Error Handling**
   - Always check tool execution results
   - Handle LLM errors gracefully
   - Use metrics to track failures

3. **Resource Management**
   - Set appropriate timeouts
   - Configure memory capacity limits
   - Monitor resource usage

4. **Security**
   - Never expose API keys in code
   - Validate tool inputs
   - Set appropriate access controls 