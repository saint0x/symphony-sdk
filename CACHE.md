# Symphony SDK Cache & Runtime Intelligence

This document details the specialized caching and runtime intelligence mechanisms within the Symphony SDK. Unlike traditional data caches, the "cache" in this context primarily refers to two key components that aid in efficient and context-aware AI operations:

1.  **Command Map (`CommandMapProcessor` & `ContextIntelligenceAPI`):** For NLP-to-Tool mapping.
2.  **Context Tree (`ContextTreeBuilder`):** For constructing rich, contextual information for system awareness and prompt injection.

These components work together to provide runtime understanding and a dynamic "working memory" for agents and the SDK itself.

## 1. Command Map: NLP-to-Tool Invocation

The Command Map provides the ability to translate natural language queries or predefined patterns into specific tool invocations. It acts as a runtime lookup for NLP-driven actions.

**Core Components:**

*   **`ToolRegistry`:** The central registry where all tools (their definitions and handlers) are stored.
*   **`CommandMapProcessor` (`src/cache/map-processor.ts`):**
    *   Maintains an in-memory map (`Map<string, Pattern>`) where keys are NLP trigger strings (or pattern IDs) and values are `Pattern` objects detailing the associated tool, parameter mappings, confidence, etc.
    *   **Initialization:**
        *   Loads predefined patterns from an XML file (e.g., `src/cache/command-map.xml`) during its initialization. These are typically system-level or core tool NLP triggers.
        *   Can also load and reconcile these XML patterns with versions stored in the `xml_patterns` database table.
    *   **Runtime Additions:**
        *   `addRuntimePatternToMemory(nlpPattern: string, toolCallDetails: RuntimeToolCallDetails)`: Allows new NLP patterns to be added to the in-memory map during a session. `toolCallDetails` specifies the target tool name and parameters. This is the primary mechanism for dynamically extending NLP understanding.
        *   `persistRuntimePattern(patternToPersist: Pattern)`: Can persist a runtime-added `Pattern` object to the `xml_patterns` database table (note: this differs from the `nlp_patterns` table used by `NlpService` for user/SDK-defined patterns).
        *   `addAndPersistRuntimePattern(...)`: Combines the above two.
    *   **Processing:**
        *   `processUserInput(input: string, sessionId?: string)`: Takes a user input string, attempts to find the best matching pattern in its map, extracts variables, and determines the tool call to make.
*   **`ContextIntelligenceAPI` (`src/cache/intelligence-api.ts`):**
    *   Acts as a higher-level interface that often utilizes `CommandMapProcessor`.
    *   `registerToolNlpMapping({ toolName, nlpPattern, source })`: This is a key method called (e.g., by `NlpService`) to register a simple NLP pattern string and associate it directly with a `toolName`. It typically uses `CommandMapProcessor.addRuntimePatternToMemory` under the hood.
*   **`NlpService` (`src/nlp/NlpService.ts`):**
    *   `loadPatternToRuntime(patternDef: NlpPatternDefinition)`: Takes an `NlpPatternDefinition` (which includes `toolName` and `nlpPattern`) and calls `contextIntelligenceApi.registerToolNlpMapping` to make it active in the runtime command map.
    *   `loadAllPersistedPatternsToRuntime()`: Loads all active patterns from the `nlp_patterns` database table and registers them into the runtime command map via `loadPatternToRuntime`. This happens during SDK initialization.

**How it Works Currently:**

1.  **Initialization:**
    *   `CommandMapProcessor` loads system XML patterns.
    *   `NlpService` (during SDK init via `ToolRegistry.initializeAutoPopulation`) loads all active patterns from the `nlp_patterns` DB into the runtime command map via `ContextIntelligenceAPI`.
2.  **Tool Creation (`ToolService.create`):**
    *   If a `ToolConfig` includes an `nlp` string, `ToolService` calls `NlpService.loadPatternToRuntime()`.
    *   This registers the tool's `nlp` string with its `toolName` in the runtime command map via `ContextIntelligenceAPI`.
    *   **No database persistence of this NLP pattern occurs automatically from `tool.create`** (assuming `persistNlpOnInit` is removed or false, which is the recommended path).
3.  **Dynamic Additions (e.g., by an Agent/System):**
    *   A service could expose functionality that calls `CommandMapProcessor.addRuntimePatternToMemory` (likely via `ContextIntelligenceAPI` or `NlpService`) to teach the system new NLP phrases for existing tools during a session.
4.  **Invocation:**
    *   When natural language input needs to be processed for tool invocation (e.g., by an agent or a central dispatcher), it would query the `CommandMapProcessor` (e.g., via `CacheIntelligenceService.getIntelligence` or a similar high-level SDK function).
    *   The `CommandMapProcessor` finds the best match and returns the intended tool and parameters.

**Functionality Provided by Command Map:**
*   Enables natural language understanding for tool invocation.
*   Maps user-friendly phrases or specific patterns to concrete tool actions.
*   Allows dynamic, in-session learning/registration of new NLP triggers.
*   Decouples the raw LLM from needing to know every exact tool function signature if common tasks have NLP triggers.

## 2. Context Tree (`ContextTreeBuilder`)

The Context Tree dynamically constructs a hierarchical representation of the current state and relevant history for a given session. This tree is intended to be a rich source of context for agents or for injection into LLM prompts to improve situational awareness and response quality.

**Core Components:**

*   **`ContextTreeBuilder` (`src/cache/tree-builder.ts`):**
    *   **Initialization:**
        *   Can be initialized with a path to a base context template JSON file. If not provided, uses a default minimal structure.
    *   **Building the Tree (`buildContextTree(sessionId, query?)`):**
        *   This is the primary method. It is **read-only** from the perspective of external callers wanting to *modify* the tree structure directly.
        *   It constructs the tree by fetching data from various `DatabaseService` methods:
            *   `database.getSessionContext(sessionId)`: For session-specific data, user preferences, current task.
            *   `database.getToolExecutions(sessionId, query?.limit)`: For recent tool usage.
            *   `database.getWorkflowExecutions(sessionId)`: For active/recent workflows.
            *   `database.getXMLPatterns(true)`: For information about learned/adapted patterns (currently from `xml_patterns`).
        *   It assembles this data into a hierarchical structure of `ContextNode` objects.
    *   **Nodes Types:** Includes `environment`, `workflow`, `tool` (executions), `user_data` (session info, preferences), `task`, and `learning` (adapted patterns).
    *   **Caching:** Implements a simple in-memory LRU cache for recently built trees to avoid redundant reconstruction.
    *   **Prompt Generation (`getContextForPrompt(sessionId, options?)`):** Flattens and formats the tree into a string suitable for LLM prompt injection, prioritizing relevant nodes.

**How it Works Currently:**

1.  **Data Collection:** When a context tree is requested for a `sessionId`, the `ContextTreeBuilder` queries the `DatabaseService` for the latest relevant information (session details, tool logs, workflow states, pattern confidences, etc.).
2.  **Structure Assembly:** It organizes this information into a predefined, yet dynamic, hierarchical structure defined by its internal `build<Type>Node` methods (e.g., `buildEnvironmentNode`, `buildToolExecutionNode`).
3.  **No Direct External Updates to Tree Structure:**
    *   Agents or other services **do not directly call methods like `contextTreeBuilder.addNode(...)` or `updateNode(...)`**.
    *   The tree is a *representation* of the current state derived primarily from the database.
4.  **"Updating" the Context Tree (Implicitly):**
    *   For the context tree to reflect new information (e.g., a tool was just run, user preferences changed), that new information **must first be persisted to the database** by the relevant service (e.g., `ToolService` via `ToolRegistry` might log tool execution, a user profile service might update session context in the DB).
    *   The *next time* `buildContextTree` is called, it will fetch this updated data from the database and construct a new tree that reflects these changes.

**Functionality Provided by Context Tree:**
*   Provides a structured, comprehensive snapshot of the current session's context.
*   Includes environment details, recent tool activity, active workflows, user session data, and learning adaptations.
*   Can be transformed into a string format suitable for augmenting LLM prompts, giving the LLM better situational awareness.
*   Helps in maintaining a "short-term to medium-term working memory" for the system regarding a specific interaction or session.

## Relationship & Injection into System Prompts

*   The **Command Map** is used by the system (e.g., an agent or NLP routing logic) to understand *how to act* based on an NLP input.
*   The **Context Tree** is generated to provide *situational awareness*. Its string representation (from `getContextForPrompt`) can be injected into system prompts for LLMs or be available to agents for decision-making.

This combination allows the system to both understand natural language commands (via Command Map) and operate with a rich understanding of the ongoing interaction and environment (via Context Tree).

## Current State of Update Logic:

*   **Command Map (Runtime):**
    *   **Can be updated:** Yes, via `NlpService.loadPatternToRuntime()` (called by `ToolService.create` if `nlp` is in config) or by direct use of `CommandMapProcessor.addRuntimePatternToMemory()`. This adds new NLP triggers for the current session.
*   **Command Map (Persistent - `xml_patterns` via `CommandMapProcessor`):**
    *   **Can be updated:** Yes, `CommandMapProcessor.persistRuntimePattern()` allows saving new patterns. Updates to existing XML patterns would typically involve modifying the source XML and re-initializing or specific DB updates.
*   **Command Map (Persistent - `nlp_patterns` via `NlpService`):**
    *   **Can be updated:** Yes, via `NlpService.ensurePatternPersisted()`, `addNlpPattern()`, `updateNlpPattern()`, `deleteNlpPattern()`, and `seedPatternsFromFile()`. This is the primary mechanism for managing user/SDK-defined NLP patterns meant for persistence and auto-loading.
*   **Context Tree:**
    *   **Cannot be directly updated by an agent/service calling a method on `ContextTreeBuilder`.**
    *   **Is updated implicitly:** By services writing new data (tool executions, session changes, workflow states) to the database. The `ContextTreeBuilder` then reconstructs the tree with this new data on its next build.

This documentation should clarify the current mechanisms. The "cache" is dynamic and intelligent, not just a simple key-value store for data. 