# Symphony SDK: Runtime Engine Explained

This document details the runtime behavior of the Symphony SDK, focusing on the dynamic interactions and operational flow within its core components. It explains how requests are processed, how agents execute tasks, and how different parts of the SDK collaborate during execution. This complements `ARCHITECTURE.md` which describes the static structure.

## 1. Agent Task Execution Lifecycle (`AgentExecutor.executeTask()`)

When a task is assigned to an agent via `AgentExecutor.executeTask(taskDescription)`, the following runtime sequence occurs:

1.  **Initialization & Configuration Loading**:
    - The `AgentExecutor` instance uses its `AgentConfig` (provided during its instantiation).
    - It identifies if the agent has tools (`agentHasTools = this.config.tools && this.config.tools.length > 0`). This is a crucial check that dictates much of the subsequent logic.

2.  **System Prompt Generation**:
    - `SystemPromptService.generateSystemPrompt(agentConfig, agentHasTools)` is called. This service constructs a base system prompt. If `agentHasTools` is true, it typically includes descriptions of the available tools, their input schemas, and general instructions for how the agent should consider using them.
    - If `agentConfig.systemPrompt` is provided, it might be used as a base or override.
    - If `agentConfig.directives` are present, they are appended to the generated system prompt.

3.  **JSON Mode Enforcement (if `agentHasTools` is true)**:
    - The `AgentExecutor` appends its standardized, verbose JSON structural requirements (the "ALL CAPS" instructions) to the system prompt. This addendum explicitly tells the LLM:
        - Its entire response MUST be a single valid JSON object.
        - The structure required for calling a tool (`{"tool_name": "...", "parameters": {...}}`), emphasizing the use of EXACT tool names.
        - The structure required if no tool is needed (`{"tool_name": "none", "response": "..."}`).
        - That failure to adhere will result in an error.

4.  **LLM Request Preparation**:
    - An array of `LLMMessage` objects is created: `[{ role: 'system', content: finalSystemPrompt }, { role: 'user', content: taskDescription }]`.
    - An `LLMRequest` object is constructed:
        - `messages`: Set to the array above.
        - `llmConfig`: Populated from `agentConfig.llm` (model, temperature, maxTokens, etc.).
        - `expectsJsonResponse`: Set to `true` if `agentHasTools` is true. This is a hint for the `LLMProvider`.

5.  **LLM Interaction via `LLMHandler`**:
    - `AgentExecutor` calls `this.llm.complete(llmRequest)`. `this.llm` is an instance of an `LLMProvider` (e.g., `OpenAIProvider`) obtained via `LLMHandler.getInstance().getProvider(...)` (typically during `AgentExecutor` initialization).
    - **Inside `LLMHandler.getProvider()`** (Simplified):
        - Determines the target provider (from `request.provider`, or default).
        - Retrieves or initializes the `LLMProvider` instance.
    - **Inside `LLMHandler.complete()`** (Simplified for this context, actual logic involves `request.llmConfig` overrides which might re-register/fetch a provider instance):
        - It ultimately calls `providerInstance.complete(request)`.
    - **Inside `OpenAIProvider.complete()`** (Example for OpenAI):
        - Sees `request.expectsJsonResponse === true`.
        - Sets `response_format: { type: "json_object" }` in the parameters for the OpenAI API call.
        - Makes the actual HTTPS request to the OpenAI API.
    - Other `LLMProvider` implementations would adapt the `LLMRequest` to their specific API needs, relying primarily on the strong system prompting if `expectsJsonResponse` is true and they don't have a native JSON mode toggle like OpenAI.

6.  **LLM Response Processing (if `agentHasTools` is true)**:
    - The `LLMProvider` returns an `LLMResponse`.
    - `AgentExecutor` attempts to `JSON.parse(llmResponse.content)`.
    - **If parsing succeeds**:
        - It looks for `tool_name` (or `toolName`) and `parameters`.
        - **If `tool_name` is valid and not "none", and `parameters` exist**:
            - `ToolRegistry.getInstance().executeTool(toolName, parameters)` is called.
            - **Inside `ToolRegistry.executeTool()`**:
                - The tool's registered `handler` function is retrieved.
                - Input validation against the tool's `inputSchema` is performed (if schema exists).
                - The `handler(parameters)` is invoked.
                - The `ToolResult` from the handler is returned.
            - `AgentExecutor` records this `ToolResult` in its `toolsExecuted` array.
            - The `actualResponseContent` for the agent is set to a summary of the tool execution (e.g., "Tool X executed. Success: true. Result: ...").
        - **If `tool_name` is "none"**:
            - The agent decided no tool was needed.
            - `actualResponseContent` is set to `parsedJson.response` (the LLM's direct textual answer).
        - **If JSON structure is unexpected (e.g., no `tool_name` but JSON is valid)**:
            - A warning is logged.
            - `actualResponseContent` defaults to the raw `llmResponse.content`.
    - **If parsing fails**:
        - An error is logged.
        - `actualResponseContent` defaults to the raw (non-JSON) `llmResponse.content` and likely leads to the task being marked as failed if a tool was expected.

7.  **LLM Response Processing (if `agentHasTools` is false)**:
    - The `llmResponse.content` is treated as the direct textual answer from the LLM. No JSON parsing is attempted by `AgentExecutor` for tool calls.
    - `actualResponseContent` is `llmResponse.content`.

8.  **Final `AgentResult` Construction & Task Success Determination**:
    - An `AgentResult` object is assembled.
    - `overallTaskSuccess` is determined:
        - If any executed tool failed, `overallTaskSuccess` is `false`.
        - If `agentHasTools` was true but NO tools were executed:
            - The system checks if the LLM explicitly outputted `{"tool_name": "none", ...}` by attempting to parse `analysisResult.response` (which is `actualResponseContent` from `analyzeAndExecuteTask`).
            - If `tool_name: "none"` was found, `overallTaskSuccess` remains `true` (LLM made a decision).
            - Otherwise (no tool executed, no explicit "none" tool, and tools were configured), `overallTaskSuccess` is set to `false` (task likely incomplete).
        - Otherwise (tools executed successfully, or no tools configured and LLM responded), `overallTaskSuccess` is `true`.
    - The `AgentResult` (containing `success`, `result: { response, reasoning, toolsExecuted }`, `error`, `metrics`) is returned.

## 2. Tool Execution Runtime (`ToolRegistry.executeTool()`)

1.  **Tool Lookup**: Retrieves the `ToolConfig` for the given `toolName` from its internal map.
2.  **Input Validation** (if `tool.inputSchema` is defined):
    - Uses `ToolUsageVerifier.verifyData(params, tool.inputSchema)` (conceptual).
    - If validation fails, returns a `ToolResult` with `success: false` and error details.
3.  **Handler Invocation**: If validation passes (or no schema), calls `tool.handler(params)`.
4.  **Result Propagation**: Returns the `Promise<ToolResult>` from the handler.
5.  **Contextual Updates** (Conceptual, from `USAGE.md`):
    - May update a learning context via `ContextIntelligenceAPI` if the tool is not a context management tool itself.
6.  **Metrics**: Wraps the result with execution metrics (duration, start/end times).

## 3. LLM Provider Interaction (`LLMHandler`)

- **Provider Initialization**: During `LLMHandler` instantiation (singleton), it attempts to initialize default providers (e.g., OpenAI if `OPENAI_API_KEY` is present).
- **Provider Registration (`registerProvider`)**: Allows adding or updating provider configurations. For OpenAI, it ensures the environment API key is used.
- **Provider Retrieval (`getProvider`)**: Gets a provider instance by name or the default.
- **Request-Specific Configuration (`complete`, `completeStream` methods)**:
    - If an `LLMRequest` includes `llmConfig` (for overriding model, temp, etc., for that specific call), the `LLMHandler` currently re-registers (effectively updates) the provider instance with these temporary settings before the call and then uses that updated instance. This means a request-specific config temporarily alters the shared provider instance. *Note: A more advanced system might clone a provider or apply overrides without mutating the shared instance if true request isolation is needed without re-registration.* The current approach implies that sequential calls with different `llmConfig`s will use a provider reflecting the latest `llmConfig` passed through `registerProvider`.

## 4. System Prompt Assembly

- The final system prompt sent to the LLM is a combination of:
    1.  **Base System Prompt**: Generated by `SystemPromptService(agentConfig, agentHasTools)`. This includes:
        - Agent's role, goal, personality (from `agentConfig.description`, `agentConfig.task`).
        - Descriptions and input schemas of available tools (if `agentHasTools` is true).
        - General instructions on tool usage or task approach.
    2.  **Agent Directives**: `agentConfig.directives`, if provided.
    3.  **SDK JSON Requirements**: The verbose, "ALL CAPS" instructions for JSON structure, appended by `AgentExecutor` if `agentHasTools` is true.
- If `agentConfig.systemPrompt` is provided, it often forms the primary basis, potentially with tool descriptions and JSON requirements still appended by the SDK if tools are present.

This runtime design prioritizes structured LLM interaction for tool-enabled agents and provides a clear flow for task processing and tool invocation.

--- 