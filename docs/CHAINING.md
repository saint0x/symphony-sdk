# Implementation Plan for Chained Tool Execution in Symphonic

## Overview

The chaining implementation ensures structured execution flow, clear debugging, and seamless I/O passing between tools and agents.

## 🧩 Chaining Logic

### Metadata Structure

Each tool call contains a `chained` field indicating its position in the chain:
- `chained: 1` - First tool in chain
- `chained: 2.1, 2.2, 2.3...` - Intermediate tools, ordered by decimal points
- `chained: 3` - Final tool in chain

Additional metadata includes:
- `target` field to specify the next tool/agent
- Success flag (`success: boolean`) for execution traceability
- Structured output logging for full execution context

## 🛠️ Implementation Example

### 1. Simple Chain

```typescript
// First tool
const searchTool = symphonic.tools.create({
    name: "search",
    description: "searches for information",
    inputs: ["query"],
    chained: 1,
    target: "analyze",
    handler: async (query) => ({ result: searchResults, success: true })
});

// Intermediate tool
const analyzeTool = symphonic.tools.create({
    name: "analyze",
    description: "analyzes search results",
    inputs: ["data"],
    chained: 2,
    target: "format",
    handler: async (data) => ({ result: analysis, success: true })
});

// Final tool
const formatTool = symphonic.tools.create({
    name: "format",
    description: "formats final output",
    inputs: ["data"],
    chained: 3,
    handler: async (data) => ({ result: formatted, success: true })
});
```

### 2. Complex Chain with Multiple Intermediates

```typescript
// First tool
const fetchTool = symphonic.tools.create({
    name: "fetch",
    description: "fetches raw data",
    inputs: ["source"],
    chained: 1,
    target: "clean",
    handler: async (source) => ({ result: rawData, success: true })
});

// First intermediate
const cleanTool = symphonic.tools.create({
    name: "clean",
    description: "cleans raw data",
    inputs: ["data"],
    chained: 2.1,
    target: "validate",
    handler: async (data) => ({ result: cleanData, success: true })
});

// Second intermediate
const validateTool = symphonic.tools.create({
    name: "validate",
    description: "validates cleaned data",
    inputs: ["data"],
    chained: 2.2,
    target: "transform",
    handler: async (data) => ({ result: validData, success: true })
});

// Third intermediate
const transformTool = symphonic.tools.create({
    name: "transform",
    description: "transforms valid data",
    inputs: ["data"],
    chained: 2.3,
    target: "format",
    handler: async (data) => ({ result: transformedData, success: true })
});

// Final tool
const formatTool = symphonic.tools.create({
    name: "format",
    description: "formats final output",
    inputs: ["data"],
    chained: 3,
    handler: async (data) => ({ result: formatted, success: true })
});
```

## 📌 Key Features

### ✅ Ordered Execution
- First tool marked with `chained: 1`
- Intermediate tools use decimal points (`2.1`, `2.2`, `2.3`, etc.) for clear ordering
- Final tool marked with `chained: 3`

### ✅ Flexible Chaining
- Support for both simple and complex chains
- Clear step ordering with decimal notation
- Easy to insert new steps between existing ones

### ✅ Self-Contained Tools
- Every tool knows its exact position in chain
- Clear next-step identification through `target`
- Decimal ordering enables easy chain modifications

### ✅ Debugging Support
- Success flags for failure detection
- Complete execution trace with ordered steps
- Clear visibility of chain progression

