# Refactoring Plan: NLP Pattern Management & Tool Creation

This document outlines the plan to refactor NLP pattern handling within the Symphony SDK to improve separation of concerns, simplify tool creation, and clarify the lifecycle of NLP patterns.

## 1. Guiding Principles

*   **Separation of Concerns:**
    *   `ToolService`: Responsible for tool definition, registration with `ToolRegistry`, and loading NLP patterns into the *runtime* command map for immediate in-session use.
    *   `NlpService`: Solely responsible for the *persistence* lifecycle of NLP patterns (CRUD operations, seeding) in the `nlp_patterns` database table.
    *   `CommandMapProcessor` / `ContextIntelligenceAPI`: Continue to manage the in-memory runtime command map for NLP-to-tool resolution.
*   **Explicitness over Implicitness:** Persisting NLP patterns to the database should be an explicit action, not an automatic side-effect of tool creation.
*   **User Experience:** Keep the primary SDK interface (`symphony.tool.create`, `symphony.nlp.*`) clean and intuitive.
*   **Maintain Existing DI Patterns:** Services will continue to receive their dependencies via constructors.

## 2. Key Changes Required

### 2.1. `ToolConfig` Interface (`src/types/tool.types.ts`)

*   **Remove `persistNlpOnInit?: boolean;` property.**
    *   **Reasoning:** This flag is the source of the current tight coupling between tool creation and NLP persistence. Removing it is central to this refactor.

### 2.2. `ToolService.create()` Method (in `src/symphony.ts`)

*   **Remove logic related to `persistNlpOnInit`.**
    *   The entire `if (toolToRegister.persistNlpOnInit === true) { ... }` block, including the call to `this.nlpService.ensurePatternPersisted()`, will be deleted.
*   **Retain Runtime NLP Loading:**
    *   The existing logic: `if (toolToRegister.nlp) { await this.nlpService.loadPatternToRuntime(nlpPatternDef); ... }` will be **kept**. This ensures that if a tool is defined with an `nlp` string, that pattern is immediately active in the runtime command map for the current session.
*   **New: Default Runtime NLP Registration by Tool Name (Optional Enhancement):**
    *   **Consideration:** If a `ToolConfig` is provided *without* an `nlp` field, should its `name` be automatically registered as an NLP trigger in the runtime command map?
    *   **Proposed Implementation (If Adopted):**
        ```typescript
        // Inside ToolService.create, after toolToRegister is defined
        if (toolToRegister.nlp) {
            const nlpPatternDef: NlpPatternDefinition = {
                toolName: toolToRegister.name,
                nlpPattern: toolToRegister.nlp,
                source: 'tool_config_init'
            };
            // ... existing loadPatternToRuntime logic ...
        } else {
            // If no explicit NLP pattern, register the tool name itself as a runtime trigger
            const nlpPatternDef: NlpPatternDefinition = {
                toolName: toolToRegister.name,
                nlpPattern: toolToRegister.name, // Use tool name as the pattern
                source: 'tool_name_default_runtime'
            };
            try {
                await this.nlpService.loadPatternToRuntime(nlpPatternDef);
                this.logger.info('ToolService', `Tool name '${toolToRegister.name}' registered as default runtime NLP trigger.`);
            } catch (err: any) {
                this.logger.warn('ToolService', `Failed to load tool name '${toolToRegister.name}' as default runtime NLP trigger: ${err.message}.`);
            }
        }
        ```
    *   **Benefit:** Makes all tools discoverable via string matching in the command map by their name by default, even without an explicit `nlp` pattern. Simplifies direct invocation by name if the command map is a central dispatch point.

### 2.3. `NlpService` (`src/nlp/NlpService.ts`)

*   **No changes required to its existing public API for persistence:**
    *   `ensurePatternPersisted(patternDef, options)`
    *   `addNlpPattern(patternDef, options)`
    *   `seedPatterns(patterns, options)`
    *   `seedPatternsFromFile(filePath, options)`
    *   `getNlpPatternById(id)`
    *   `getNlpPatternsByTool(toolName)`
    *   `updateNlpPattern(id, updates)`
    *   `deleteNlpPattern(id)`
    *   These methods become the *explicit and sole SDK-provided ways* to manage the lifecycle of persisted NLP patterns in the `nlp_patterns` table.
*   **`loadPatternToRuntime(patternDef)`:** Remains unchanged, used for in-memory activation.
*   **`loadAllPersistedPatternsToRuntime()`:** Remains unchanged, crucial for loading DB patterns into memory on SDK init.

### 2.4. Agentic/Dynamic NLP Pattern Registration (New Feature - Post-Refactor)

*   To allow agents to dynamically add new NLP triggers they learn or infer:
    *   Introduce a new method in `NlpService` (or potentially a higher-level facade if `symphony.nlp` is the user entry point):
        ```typescript
        // In NlpService.ts
        async addDynamicRuntimeNlpPattern(toolName: string, nlpPattern: string, source: string = 'agent_learned', confidence?: number): Promise<void> {
            this.logger.info('NlpService', `Adding dynamic runtime NLP pattern: '${nlpPattern}' for tool '${toolName}' from source '${source}'`);
            const patternDef: NlpPatternDefinition = { toolName, nlpPattern, source }; // Confidence not directly part of NlpPatternDefinition, handled by CommandMapProcessor if it supports it.
            await this.loadPatternToRuntime(patternDef);
            // Note: ContextIntelligenceAPI/CommandMapProcessor might need adjustment if confidence for runtime patterns is desired here.
            // This does NOT automatically persist it. Persistence would be a separate, deliberate step if needed.
        }
        ```
    *   Expose this via `symphony.nlp.addDynamicRuntimeNlpPattern(...)`.
    *   If these agent-learned patterns also need persistence, the agent logic (or a managing service) would explicitly call `symphony.nlp.ensurePatternPersisted(...)` with the details.

## 3. Impact on Test Scripts (e.g., `testlivedb.ts`, `testPersistNlpOnInit.ts`)

*   The `persistNlpOnInit: true` case in tests will need to be refactored.
*   Instead of relying on `tool.create` to persist, tests will need to:
    1.  Call `sym.tool.create(...)` (without `persistNlpOnInit`).
    2.  Explicitly call `sym.nlp.ensurePatternPersisted(...)` with the tool name and NLP pattern.
    3.  Then verify its presence in the database.
*   This makes the test more accurately reflect the new explicit persistence flow.

## 4. Benefits Achieved

*   **Decoupling:** Tool creation is decoupled from NLP pattern database persistence.
*   **Clarity:** The lifecycle of an NLP pattern (runtime activation vs. persistent storage) becomes clearer and more explicit.
*   **Simplicity:** `ToolService.create` is simplified.
*   **Robustness:** Reduces the chance of tool creation failing due to unrelated database persistence issues (like the current bug being investigated).
*   **Testability:** Easier to test tool creation and NLP persistence in isolation.
*   **Flexibility:** Users/agents have fine-grained control over which NLP patterns are persisted and when.

## 5. Addressing the Current Bug

*   This refactor, by removing the problematic call path (`ToolService.create` -> `nlpService.ensurePatternPersisted` -> `DatabaseService` error) from the default tool creation flow, will likely make the *test pass* for the `persistNlpOnInit: true` scenario (as that scenario will be re-written to use explicit persistence).
*   However, the underlying bug (stale code execution related to `SQLiteAdapter.describeTable` or similar) will **still exist** and needs to be resolved for `NlpService`'s explicit persistence methods (`ensurePatternPersisted`, `seedPatternsFromFile`, etc.) to function reliably.
*   This refactor makes the location of that bug more isolated to `NlpService` calls rather than being tangled with `ToolService.create`.

This plan provides a clear path to a cleaner architecture for NLP management. The primary focus of the *coding work* will be in `ToolConfig` and `ToolService.create`. 