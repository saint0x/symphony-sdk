# Symphony SDK: Architecture Overview

This document provides a technical breakdown of the Symphony SDK's architecture, its core layers, and how they interact to enable complex AI-driven applications.

## Core Philosophy

The Symphony SDK is designed to be a modular, extensible, and robust framework for building and orchestrating AI agents and workflows. Key design principles include:
- **Layered Abstraction**: Clear separation of concerns between tools, agents, teams, and pipelines.
- **Developer Experience**: Intuitive APIs and sensible defaults, with flexibility for customization.
- **Determinism & Reliability**: Emphasis on structured communication (e.g., JSON for tool calls), robust error handling, and clear success/failure reporting.
- **Observability**: Built-in mechanisms for logging, metrics, and health monitoring.
- **Extensibility**: Easy integration of custom tools, agents, and even LLM providers.

## SDK Layers and Components

The SDK is structured into several key layers and supporting components:

### 1. Core Orchestration Layers

These form the primary hierarchy for building applications:

- **Tools (`ToolRegistry`, `ToolConfig`, `ToolResult`):**
  - **Functionality**: The most granular layer, representing individual, executable capabilities (e.g., file I/O, web search, custom business logic).
  - **Implementation**: Each tool is defined by a `ToolConfig` (specifying its name, description, input schema, and handler function) and registered with the global `ToolRegistry`.
  - **Interaction**: Tools are invoked by agents (via the `AgentExecutor`) or pipeline steps, receiving parameters and returning a `ToolResult` (indicating success/failure and data).

- **Agents (`AgentExecutor`, `AgentConfig`, `AgentResult`):**
  - **Functionality**: Intelligent entities that use an LLM to reason about tasks and utilize a defined set of tools to achieve goals.
  - **Implementation**: Defined by `AgentConfig` (specifying name, description, task, tools, LLM settings, system prompt, directives). Execution is primarily handled by `AgentExecutor`.
  - **Interaction**: `AgentExecutor` takes a task description and the agent's configuration. It:
    1.  Constructs a system prompt (combining agent-specific prompts with SDK-appended JSON structural guidance if tools are present).
    2.  Communicates with the configured LLM (via `LLMHandler` and the appropriate `LLMProvider`).
    3.  If tools are present, it expects a JSON response from the LLM indicating a tool call (`{"tool_name": "...", "parameters": {...}}`) or no tool (`{"tool_name": "none", "response": "..."}`).
    4.  Parses the LLM's JSON response and, if a tool is indicated, invokes the tool via `ToolRegistry.executeTool()`.
    5.  Formats the final `AgentResult`, including the LLM's response/reasoning and details of any tools executed.
  - **JSON Mode**: This is a critical, automatic feature for agents configured with tools. The SDK (specifically `AgentExecutor`) appends robust instructions to the system prompt to ensure the LLM responds in a parsable JSON format. For OpenAI, this is further enhanced by setting `response_format: { type: "json_object" }` in the API call (handled by the `OpenAIProvider` based on an `expectsJsonResponse` hint from `AgentExecutor`).

- **Teams (`TeamCoordinator` - Conceptual, `TeamConfig`, `TeamResult`):**
  - **Functionality**: Groups of specialized agents collaborating on larger tasks, managed by coordination strategies (e.g., parallel, sequential, role-based delegation).
  - **Implementation**: Defined by `TeamConfig` (specifying member agents, strategy, delegation rules). Execution is orchestrated by a `TeamCoordinator` (or similar entity, potentially exposed via `symphony.team.run()`).
  - **Interaction**: The `TeamCoordinator` receives a team-level task, breaks it down (potentially using a manager agent or LLM-driven planning), delegates sub-tasks to appropriate member agents, and aggregates results.

- **Pipelines (`PipelineExecutor` - Conceptual, `PipelineConfig`, `PipelineResult`):**
  - **Functionality**: Define and execute complex, multi-step workflows involving sequences of tools, agents, or even other teams/pipelines. Support data flow, conditional logic, error handling, and parallelism.
  - **Implementation**: Defined by `PipelineConfig` (specifying steps, variables, error strategies). Execution is managed by a `PipelineExecutor` (potentially exposed via `symphony.pipeline.run()`).
  - **Interaction**: The `PipelineExecutor` processes steps sequentially (respecting dependencies), passing outputs from one step as inputs to another, evaluating conditions, and managing the overall workflow state.

### 2. LLM Abstraction Layer

- **`LLMHandler`**: A central service that manages different LLM provider instances. It handles:
  - Registration of LLM providers (e.g., OpenAI, Anthropic).
  - Selection of the appropriate provider based on configuration or request.
  - Potentially request-specific configuration overrides.
- **`LLMProvider` (Interface and Implementations, e.g., `OpenAIProvider`):**
  - **Functionality**: Adapters for specific LLM APIs (e.g., OpenAI API, Anthropic API).
  - **Implementation**: Each provider implements the `LLMProvider` interface (`complete`, `completeStream`).
  - **Interaction**: `AgentExecutor` (via `this.llm`) calls `complete()` or `completeStream()` on the active `LLMProvider` instance, passing an `LLMRequest`. The provider translates this into an API call to the specific LLM service.
  - **OpenAIProvider Specifics**: Leverages the `expectsJsonResponse` flag in `LLMRequest` (set by `AgentExecutor` for tool-enabled agents) to enable OpenAI's native `response_format: { type: "json_object" }`.
- **`LLMRequest` / `LLMResponse` / `LLMConfig` / `LLMMessage` (Types):** Standardized interfaces for interacting with LLMs, ensuring consistency across providers.

### 3. Supporting Systems

- **System Prompt Service (`SystemPromptService`):**
  - **Functionality**: Responsible for generating the initial system prompt for an agent based on its `AgentConfig` (including its description, task, and list of tools) and whether tools are present.
  - **Interaction**: Called by `AgentExecutor` during task execution. The output of this service is then further augmented by `AgentExecutor` with the verbose JSON structural requirements if tools are enabled.

- **Cache Intelligence (`symphony.cache`, `ContextIntelligenceAPI` - Conceptual):
  - **Functionality**: Provides mechanisms for caching LLM calls, tool responses, and employing advanced techniques like pattern matching and context trees to optimize performance and reduce redundant computations.
  - **Interaction**: Can be integrated at various levels (e.g., `LLMHandler` might use it for caching LLM responses, `AgentExecutor` might cache tool results).

- **Memory System (`symphony.memory`):
  - **Functionality**: Offers short-term (session-based) and long-term (persistent) memory capabilities for agents and the system to store and retrieve contextual information, user preferences, conversation history, etc.
  - **Interaction**: Agents can be designed to interact with this system to maintain context across interactions or learn over time.

- **Streaming Service (`symphony.streaming`):
  - **Functionality**: Facilitates real-time progress updates and intermediate data streaming for long-running operations, particularly useful for pipelines and complex agent tasks.
  - **Interaction**: Components like `AgentExecutor` or `PipelineExecutor` can publish updates to streams, which client applications can subscribe to.

- **Database Service (`symphony.db`):
  - **Functionality**: Provides an abstraction layer for database interactions, used for persisting SDK configurations, logs, metrics, memory, and cache data (if configured).
  - **Interaction**: Various SDK components might use this service for persistence. Users might also be exposed to limited query capabilities for operational data.

- **Logging (`Logger`) & Metrics (`symphony.metrics`):
  - **Functionality**: Core services for observability. The `Logger` provides structured logging across the SDK. The metrics system collects data on performance, token usage, etc.
  - **Interaction**: Used throughout the SDK. Users can configure log levels and access collected metrics.

## Data Flow for a Tool-Enabled Agent Task

1.  `AgentExecutor.executeTask(taskDescription)` is called.
2.  `AgentExecutor` determines the agent has tools.
3.  `SystemPromptService.generateSystemPrompt()` creates a base system prompt (including tool descriptions).
4.  `AgentExecutor` appends the verbose JSON structural requirements to this system prompt.
5.  `AgentExecutor` prepares an `LLMRequest` containing the full system prompt and user task, and sets `expectsJsonResponse = true`.
6.  `AgentExecutor` calls `this.llm.complete(llmRequest)` (where `this.llm` is an `LLMProvider` instance obtained from `LLMHandler`).
7.  The specific `LLMProvider` (e.g., `OpenAIProvider`):
    - If OpenAI, sees `expectsJsonResponse` and adds `response_format: { type: "json_object" }` to its API call parameters.
    - Makes the API call to the LLM service.
8.  LLM responds (ideally with structured JSON).
9.  `LLMProvider` returns an `LLMResponse`.
10. `AgentExecutor` parses `llmResponse.content` as JSON.
11. If a tool call is found (`tool_name` and `parameters`):
    - `AgentExecutor` calls `ToolRegistry.getInstance().executeTool(toolName, parameters)`.
    - The tool's `handler` executes and returns a `ToolResult`.
12. `AgentExecutor` processes the `ToolResult` and formulates the final `AgentResult` for the `executeTask` call.
13. If `tool_name: "none"` is found, `AgentExecutor` uses the content of the `response` field as the agent's textual answer.

This architecture aims to provide a powerful yet manageable framework for developing sophisticated AI applications.

--- 