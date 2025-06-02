# Symphony SDK: API Reference

This document provides a detailed reference for the public API of the Symphony SDK, outlining the methods, parameters, and expected return types for interacting with its core modules. For functional examples, please refer to `USAGE.md`.

## 1. Symphony Client Initialization

The main entry point to the SDK is the `Symphony` class.

```typescript
import { Symphony, SymphonyConfig, LogLevel } from 'symphonic';

// Configuration Interface (conceptual, based on USAGE.md)
interface LLMConfigOptions {
  provider: string;       // e.g., 'openai', 'anthropic'
  model: string;          // e.g., 'gpt-4o-mini', 'claude-2'
  apiKey?: string;         // API key (can also be set via environment variables)
  temperature?: number;
  maxTokens?: number;
}

interface DBConfigOptions {
  enabled: boolean;
  adapter: string;        // e.g., 'sqlite', 'postgres'
  path?: string;           // For file-based DBs like SQLite
  connectionString?: string; // For server-based DBs
}

interface CacheConfigOptions { // From USAGE.md advanced config
  enablePatternMatching?: boolean;
  enableContextTrees?: boolean;
  fastPathThreshold?: number;
  contextMaxNodes?: number;
}

interface MemoryStorageConfigOptions { // From USAGE.md advanced config
  defaultTTL?: number;     // Default Time-To-Live in milliseconds
  maxSize?: number;        // Max size in bytes
}

interface MemoryConfigOptions { // From USAGE.md advanced config
  shortTerm?: MemoryStorageConfigOptions;
  longTerm?: MemoryStorageConfigOptions;
}

interface StreamingConfigOptions { // From USAGE.md advanced config
  maxConcurrentStreams?: number;
  defaultBufferSize?: number;
  defaultUpdateInterval?: number;
}

interface SymphonyConfig {
  llm: LLMConfigOptions;
  db?: DBConfigOptions;
  cache?: CacheConfigOptions;
  memory?: MemoryConfigOptions;
  streaming?: StreamingConfigOptions;
  logLevel?: LogLevel; // Assuming LogLevel is 'info' | 'debug' | 'warn' | 'error'
}

// Constructor
const symphony = new Symphony(config: SymphonyConfig);

// Initialization
async function initialize(): Promise<void>;
```

- **`new Symphony(config: SymphonyConfig)`**: Creates a new Symphony client instance.
  - `config.llm`: Mandatory. Defines the primary LLM provider and model.
  - `config.db`: Optional. Configures the database connection for persistence.
  - `config.cache`: Optional. Advanced cache intelligence settings.
  - `config.memory`: Optional. Configuration for short-term and long-term memory.
  - `config.streaming`: Optional. Settings for real-time progress updates.
  - `config.logLevel`: Optional. Sets the global log level for the SDK.
- **`symphony.initialize(): Promise<void>`**: Asynchronously initializes the Symphony client, setting up database connections, default providers, etc. Must be called before most other operations.

## 2. Tool Management (`symphony.tool`)

Manages the creation and registration of tools.

```typescript
import { ToolConfig, ToolResult } from 'symphonic';

// Conceptual: based on ToolConfig in USAGE.md and src/types/sdk.ts
// Actual ToolConfig is defined in src/types/sdk.ts

// Create / Register a new tool
async function create(toolDefinition: ToolConfig): Promise<Tool>; // Returns a Tool instance or identifier
```
- **`symphony.tool.create(toolDefinition: ToolConfig): Promise<Tool>`**: Registers a new custom tool with the SDK's `ToolRegistry`.
  - `toolDefinition`: An object conforming to the `ToolConfig` interface (see `src/types/sdk.ts` and `USAGE.md` for structure), including `name`, `description`, `type`, `config.inputSchema`, and `handler` function.
  - Returns a reference to the created/registered tool or throws an error on failure.

**Note:** Tools can also be registered directly with `ToolRegistry.getInstance().registerTool(name, config);`

## 3. Agent Management (`symphony.agent`)

Manages the creation and execution of intelligent agents.

```typescript
import { AgentConfig, AgentResult, AgentOptions } from 'symphonic';

// Conceptual: based on AgentConfig in USAGE.md and src/types/sdk.ts
// Actual AgentConfig is defined in src/types/sdk.ts

interface Agent {
  name: string;
  run(taskDescription: string, options?: AgentOptions): Promise<AgentResult>;
  selectTool?(taskSnippet: string): Promise<ToolSelectionResult>; // Conceptual, from USAGE.md
}

interface ToolSelectionResult { // Conceptual
  toolName: string;
  confidence: number;
  reasoning: string;
}

// Create a new agent
async function create(agentDefinition: AgentConfig): Promise<Agent>; // Returns an Agent instance
```
- **`symphony.agent.create(agentDefinition: AgentConfig): Promise<Agent>`**: Creates and configures a new agent instance.
  - `agentDefinition`: An object conforming to the `AgentConfig` interface (see `src/types/sdk.ts` and `USAGE.md`), specifying `name`, `description`, `task`, `tools` (array of tool names), `llm` configuration, `systemPrompt`, `directives`, `maxCalls`, etc.
  - If `tools` are provided, JSON mode is automatically enabled for LLM interactions.
  - Returns an `Agent` instance.
- **`agent.run(taskDescription: string, options?: AgentOptions): Promise<AgentResult>`**: Executes a task with the agent.
  - `taskDescription`: The natural language instruction for the agent.
  - `options`: Optional. May include `timeout`, `onProgress` callback, `onMetrics` callback (as seen in `USAGE.md`).
  - Returns an `AgentResult` (see `src/types/sdk.ts`) with `success`, `result.response`, `result.reasoning`, `metrics`, etc.
- **`agent.selectTool?(taskSnippet: string): Promise<ToolSelectionResult>`**: (Conceptual, from `USAGE.md`) Intelligently recommends a tool for a given task snippet.

## 4. Team Management (`symphony.team`)

Manages the creation and operation of teams of agents.

```typescript
import { TeamConfig, TeamExecutionStrategy, AgentConfig } from 'symphonic'; // Assuming TeamResult exists or is part of a generic run result

// Conceptual: based on TeamConfig in USAGE.md and src/types/sdk.ts
// Actual TeamConfig is defined in src/types/sdk.ts

interface Team {
  name: string;
  run(taskDescription: string, options?: { strategy?: TeamExecutionStrategy, timeout?: number, requiredCapabilities?: string[] }): Promise<any>; // Promise<TeamResult>
  getContext?(): TeamContext; // Conceptual
  getStatus?(): TeamStatus;   // Conceptual
}

interface TeamContext { /* ... fields from USAGE.md ... */ }
interface TeamStatus { /* ... fields from USAGE.md ... */ }

// Create a new team
async function create(teamDefinition: TeamConfig): Promise<Team>; // Returns a Team instance
```
- **`symphony.team.create(teamDefinition: TeamConfig): Promise<Team>`**: Creates and configures a new team.
  - `teamDefinition`: An object conforming to the `TeamConfig` interface (see `src/types/sdk.ts` and `USAGE.md`), including `name`, `description`, an `agents` array (of `AgentConfig` objects or agent names/IDs), and `strategy` configuration.
  - Agents within teams automatically use JSON mode if they are configured with tools.
- **`team.run(taskDescription: string, options?: { strategy?: TeamExecutionStrategy, ... }): Promise<any>`**: Executes a task with the team.
  - `options.strategy`: Specifies the execution strategy (e.g., `PARALLEL`, `SEQUENTIAL`, `COLLABORATIVE`).
- **`team.getContext?(): TeamContext`**: (Conceptual) Returns detailed context and intelligence about the team.
- **`team.getStatus?(): TeamStatus`**: (Conceptual) Returns the real-time operational status of the team.

## 5. Pipeline Management (`symphony.pipeline`)

Manages the creation and execution of multi-step workflows.

```typescript
import { PipelineConfig, PipelineStep } from 'symphonic'; // Assuming PipelineResult exists

// Conceptual: based on PipelineConfig in USAGE.md and src/types/sdk.ts
// Actual PipelineConfig and PipelineStep are defined in src/types/sdk.ts

interface Pipeline {
  name: string;
  run(variables: Record<string, any>): Promise<any>; // Promise<PipelineResult>
  // Conceptual executor access for intelligence features
  executor?: { 
    getPerformanceProfile?(): any;
    getOptimizationRecommendations?(): any[];
    getCircuitBreakerStatus?(stepId: string): any;
    resetCircuitBreaker?(stepId: string): void;
    getIntelligenceHealth?(): any;
  };
}

// Create a new pipeline
async function create(pipelineDefinition: PipelineConfig): Promise<Pipeline>; // Returns a Pipeline instance
```
- **`symphony.pipeline.create(pipelineDefinition: PipelineConfig): Promise<Pipeline>`**: Creates and defines a new pipeline.
  - `pipelineDefinition`: An object conforming to the `PipelineConfig` interface (see `src/types/sdk.ts` and `USAGE.md`), including `name`, `steps`, `variables`, `errorStrategy`, etc.
  - Steps can be of type `tool`, `agent`, `team`, or other conceptual types shown in `USAGE.md`.
- **`pipeline.run(variables: Record<string, any>): Promise<any>`**: Executes the pipeline with the given input variables.
- **`pipeline.executor?.*`**: (Conceptual) Access to advanced intelligence and control features for an executed pipeline instance.

## 6. Cache Module (`symphony.cache`)

Provides caching functionalities, including intelligent pattern matching and context tree management.

```typescript
// Basic Operations (Conceptual Signatures)
async function set(key: string, value: any, ttlSeconds?: number): Promise<void>;
async function get(key: string): Promise<any | null>;
async function has(key: string): Promise<boolean>;
async function delete(key: string): Promise<void>;
async function clear(): Promise<void>;

// Intelligence Features (Conceptual Signatures)
interface CacheIntelligenceOptions {
  sessionId?: string;
  enablePatternMatching?: boolean;
  enableContextTrees?: boolean;
  fastPathThreshold?: number;
}
async function getIntelligence(query: string, options?: CacheIntelligenceOptions): Promise<CacheIntelligenceResult>;

interface CacheIntelligenceResult { /* ... fields from USAGE.md ... */ }

async function recordToolExecution(sessionId: string, toolName: string, params: any, result: any, success: boolean, executionTimeMs: number, patternId?: string): Promise<void>;

// Analytics (Conceptual Signatures)
async function getPatternAnalytics(): Promise<any>;
async function getContextAnalytics(): Promise<any>;
async function getGlobalStats(): Promise<any>;
async function getSessionIntelligence(sessionId: string): Promise<any | null>;
async function healthCheck(): Promise<any>; // HealthStatus like object
```
- Exposes methods for basic Get/Set/Delete operations, intelligent recommendations via `getIntelligence`, learning via `recordToolExecution`, and various analytics endpoints.

## 7. Memory System (`symphony.memory`)

Manages short-term and long-term memory for agents and the system.

```typescript
// Basic Operations (Conceptual Signatures)
interface MemoryStoreOptions {
  sessionId?: string;
  namespace?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  priority?: number;
  ttl?: number; // Overrides default TTL for this entry
}
async function store(key: string, value: any, type: 'short_term' | 'long_term', options?: MemoryStoreOptions): Promise<void>;

interface MemoryRetrieveOptions {
  namespace?: string;
  includeMetadata?: boolean;
}
async function retrieve(key: string, type: 'short_term' | 'long_term', options?: MemoryRetrieveOptions): Promise<any | null>;

// Search (Conceptual Signature)
interface MemorySearchQuery {
  type?: 'short_term' | 'long_term';
  namespace?: string;
  sessionId?: string;
  tags?: string[];
  textSearch?: string;
  limit?: number;
  sortBy?: string; // e.g., 'timestamp', 'priority'
  sortOrder?: 'asc' | 'desc';
  dateRange?: { start: Date; end: Date };
}
async function search(query: MemorySearchQuery): Promise<MemoryEntry[]>;
interface MemoryEntry { /* ... fields from USAGE.md ... */ }

// Aggregation & Stats (Conceptual Signatures)
async function aggregate(query: { namespace?: string; tags?: string[]; dateRange?: { start: Date; end: Date } }): Promise<any>;
async function getStats(): Promise<any>;
async function getOperationalStats(): Promise<any>;
async function healthCheck(): Promise<any>; // HealthStatus like object
```
- Provides methods for storing, retrieving, searching, aggregating memories, and getting statistics.

## 8. Streaming (`symphony.streaming`)

Handles real-time progress updates for long-running operations.

```typescript
// Conceptual Signatures
interface StreamCreationOptions {
  bufferSize?: number;
  updateInterval?: number;
}
async function createStream(params: { type: string; context: any; options?: StreamCreationOptions }): Promise<string>; // Returns streamId

function subscribe(streamId: string, callback: (update: StreamUpdate) => void): () => void; // Returns unsubscribe function
interface StreamUpdate { type: 'progress' | 'status' | 'data' | 'complete' | 'error', [key: string]: any; }

async function updateProgress(streamId: string, progressUpdate: any): Promise<void>;
async function completeStream(streamId: string, result: any): Promise<void>;
async function errorStream(streamId: string, error: any): Promise<void>;

async function getActiveStreams(): Promise<any[]>;
async function getStreamStatus(streamId: string): Promise<any | null>;
async function getStats(): Promise<any>;
async function healthCheck(): Promise<any>; // HealthStatus like object
```
- Offers an API to create, subscribe to, update, and manage data streams.

## 9. Database (`symphony.db`)

Provides access to the underlying database for direct queries or fetching operational data if direct DB interaction is exposed.

```typescript
// Conceptual Signatures
async function healthCheck(): Promise<any>; // HealthStatus like object
async function getStats(): Promise<any>;
async function getToolExecutions(sessionId?: string, toolName?: string, limit?: number): Promise<any[]>;
async function query(sql: string, params?: any[]): Promise<any[]>;
```
- Allows health checks, stats retrieval, fetching specific SDK-related data (like tool executions), and running custom SQL queries.

## 10. Metrics (`symphony.metrics`)

Provides access to performance and operational metrics collected by the SDK.

```typescript
// Conceptual Signature
async function getAll(): Promise<Record<string, any>>;
// May also include specific metric getters, e.g., getAgentPerformance(agentId), getToolUsage(toolName)
```
- `getAll()`: Retrieves a comprehensive set of metrics collected by the SDK.

## 11. Configuration (`symphony.config`)

Manages the SDK's runtime configuration.

```typescript
// Conceptual Signatures
function getConfig(): Readonly<SymphonyConfig>;
function updateConfig(newConfig: Partial<SymphonyConfig>): void;
function getDependencies?(): any[]; // List of SDK dependencies/services and their status
```
- `getConfig()`: Returns the current SDK configuration (potentially a read-only copy).
- `updateConfig(newConfig)`: Allows dynamic updates to parts of the SDK configuration at runtime.
- `getDependencies?()`: (Conceptual) Provides information about internal SDK services and their status.

---

This API reference should be used in conjunction with `USAGE.md` for concrete implementation examples and `src/types/sdk.ts` for authoritative type definitions. 