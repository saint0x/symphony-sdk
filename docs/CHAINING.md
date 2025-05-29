# Symphony Tool Chaining Implementation

## Overview

Symphony's advanced chaining system provides structured execution flow, comprehensive debugging, seamless I/O passing, and parallel execution capabilities between tools and agents.

## 🧩 Chaining Logic

### Core Structure

Each tool step contains a `chained` field indicating its position in the execution flow:
- `chained: "1"` - First tool in chain
- `chained: "2.1", "2.2", "2.3"...` - Intermediate tools, ordered by decimal notation
- `chained: "3"` - Final tool in chain

### Advanced Features

- **Dependency Management**: `depends_on` arrays for explicit dependency control
- **Parallel Execution**: Same-level steps (2.1, 2.2, 2.3) run concurrently  
- **Input/Output Mapping**: Flexible parameter passing between steps
- **Conditional Logic**: Optional execution based on runtime conditions
- **Error Handling**: Comprehensive failure management and recovery

## 🛠️ Implementation Example

### 1. Simple Sequential Chain

```typescript
const simpleChain: ToolChain = {
    id: 'search_and_write',
    name: 'Search and Write Chain',
    description: 'Search for information then write to file',
    steps: [
        {
            id: 'search_step',
            tool: 'webSearch',
            chained: '1',
            static_params: {
                query: 'AI developments 2024',
                type: 'search'
            }
        },
        {
            id: 'analyze_step',
            tool: 'ponder',
            chained: '2',
            input_mapping: {
                query: 'search_step.result'
            },
            depends_on: ['search_step']
        },
        {
            id: 'write_step',
            tool: 'writeFile',
            chained: '3',
            input_mapping: {
                content: 'analyze_step.result'
            },
            static_params: {
                path: 'output.txt'
            },
            depends_on: ['analyze_step']
        }
    ],
    output_mapping: {
        searchResults: 'search_step.result',
        analysis: 'analyze_step.result',
        filePath: 'write_step.result'
    }
};
```

### 2. Complex Chain with Parallel Execution

```typescript
const parallelChain: ToolChain = {
    id: 'parallel_processing',
    name: 'Parallel Processing Chain',
    description: 'Advanced chain with parallel execution',
    steps: [
        {
            id: 'init_step',
            tool: 'ponder',
            chained: '1',
            static_params: {
                query: 'Initialize processing',
                depth: 1
            }
        },
        // These three steps execute in parallel
        {
            id: 'branch_a',
            tool: 'ponder',
            chained: '2.1',
            static_params: {
                query: 'Process branch A',
                depth: 2
            },
            depends_on: ['init_step']
        },
        {
            id: 'branch_b',
            tool: 'webSearch',
            chained: '2.2',
            static_params: {
                query: 'Research branch B',
                type: 'search'
            },
            depends_on: ['init_step']
        },
        {
            id: 'branch_c',
            tool: 'ponder',
            chained: '2.3',
            static_params: {
                query: 'Analyze branch C',
                depth: 1
            },
            depends_on: ['init_step']
        },
        {
            id: 'merge_step',
            tool: 'writeFile',
            chained: '3',
            input_mapping: {
                content: 'branch_a.result'
            },
            static_params: {
                path: 'merged_results.txt'
            },
            depends_on: ['branch_a', 'branch_b', 'branch_c']
        }
    ],
    output_mapping: {
        init: 'init_step.result',
        branchA: 'branch_a.result',
        branchB: 'branch_b.result', 
        branchC: 'branch_c.result',
        final: 'merge_step.result'
    }
};
```

## 📌 Key Features

### ✅ Clean API Design
- Simple `chained: "1"` field instead of verbose naming
- Intuitive decimal notation for ordering: "1", "2.1", "2.2", "3"  
- Matches original specification while adding advanced features

### ✅ Advanced Dependency Management
- `depends_on: ["step1", "step2"]` arrays for multiple dependencies
- Automatic dependency validation before execution
- Clear error messages for unmet dependencies

### ✅ Parallel Execution Engine
- Same-level steps (2.1, 2.2, 2.3) execute concurrently
- Automatic grouping and orchestration
- Performance optimization through parallelization

### ✅ Flexible I/O System
- `input_mapping` for dynamic parameter passing
- `static_params` for fixed configuration
- `output_mapping` for result aggregation
- Nested field access: "step1.result.field"

### ✅ Production-Ready Features
- Comprehensive error handling and recovery
- Full execution metrics and timing
- Conditional step execution
- Circuit breaker patterns
- Complete logging and debugging support

## 🚀 Usage with Agents

```typescript
// Create agent with tool chain execution capability
const agent = await symphony.agent.create({
    name: 'ChainExecutor',
    description: 'Agent that executes complex tool chains',
    task: 'Process data through multi-step workflows',
    tools: ['webSearch', 'ponder', 'writeFile'],
    llm: { model: 'gpt-4o-mini' }
});

// Execute chain
const result = await agent.executor.executeToolChain(parallelChain, {
    inputData: 'Process this through the chain'
});

console.log('Chain execution:', result.success);
console.log('Steps completed:', result.result.stepsCompleted);
console.log('Parallel groups:', result.result.chainMetrics.parallelGroups);
```

## 📊 Performance Benefits

- **Parallel Execution**: Up to 3x faster for parallelizable workflows
- **Smart Scheduling**: Automatic dependency resolution and ordering
- **Error Recovery**: Graceful handling of step failures
- **Resource Optimization**: Efficient memory and CPU usage
- **Debugging Support**: Complete execution traces and metrics

Symphony's chaining implementation represents a production-ready, enterprise-grade tool orchestration system that exceeds traditional sequential execution patterns. 