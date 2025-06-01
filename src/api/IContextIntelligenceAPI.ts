/**
 * Interface for the ContextIntelligenceAPI, focusing on methods relevant to NLP pattern management at runtime.
 */
export interface IContextIntelligenceAPI {
    // ... other existing ContextIntelligenceAPI methods ...

    /**
     * Registers an NLP pattern mapping for a tool in the in-memory command map for runtime use.
     * This is intended for immediate, session-specific availability of an NLP pattern
     * without necessarily persisting it to the database (persistence is handled by NlpService via DatabaseService).
     *
     * This method was previously (conceptually) part of the chain that led to DB writes.
     * Now, its role when called by NlpService.loadPatternToRuntime or during tool.create
     * (with persistNlpOnInit=false) is purely for in-memory registration.
     *
     * @param mapping An object containing the tool name and its NLP pattern, and optionally a source.
     *                Example: { toolName: string, nlpPattern: string, source?: string }
     * @returns A promise that resolves when the mapping is successfully registered in memory.
     */
    registerToolNlpMapping(mapping: { toolName: string; nlpPattern: string; source?: string }): Promise<void>;

    /**
     * (Optional) Checks if a specific NLP pattern is already registered in the runtime command map for a tool.
     * @param toolName The name of the tool.
     * @param nlpPattern The NLP pattern string.
     * @returns A promise resolving to true if the pattern is registered in memory, false otherwise.
     */
    isNlpPatternRegisteredInMemory?(toolName: string, nlpPattern: string): Promise<boolean>;

    /**
     * (Optional) Clears or removes an NLP pattern from the in-memory command map for a specific tool.
     * @param toolName The name of the tool.
     * @param nlpPattern The NLP pattern string to remove.
     * @returns A promise resolving when the operation is complete.
     */
    unregisterToolNlpMapping?(toolName: string, nlpPattern: string): Promise<void>;
} 