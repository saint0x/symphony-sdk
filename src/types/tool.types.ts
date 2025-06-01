import { ParameterSchema } from '../utils/verification';

/**
 * Represents the result of a tool execution.
 */
export interface ToolResult {
    success: boolean;
    result?: any;
    error?: string;
    details?: any; // Added to hold validation errors or other details
    metrics?: {
        duration: number;
        startTime: number;
        endTime: number;
    };
}

/**
 * Configuration for creating a tool.
 * Based on LLM.xml and our discussions.
 */
export interface ToolConfig {
    name: string;
    description?: string;
    type: string; // e.g., 'filesystem', 'web', 'custom'
    inputSchema?: { [paramName: string]: ParameterSchema }; // Added for input validation
    inputs?: string[]; // Names of input parameters
    outputs?: string[]; // Names of output fields
    handler?: (params: any) => Promise<ToolResult>;
    nlp?: string; // Natural language patterns for potential NLP-based tool invocation
    apiKey?: string; // API key if the tool directly calls an external service
    timeout?: number; // Timeout in milliseconds for the tool's handler execution
    retryCount?: number; // Number of times to retry the handler (requires custom logic or framework support)
    maxSize?: number; // Generic property, e.g., for limiting input/output size
    capabilities?: string[]; // Describes capabilities of the tool
    config?: Record<string, any>; // Nested object for other tool-specific configurations
}

// --- NLP Service Related Types ---

/**
 * Defines an NLP pattern for a tool, used for seeding or runtime registration.
 */
export interface NlpPatternDefinition {
    toolName: string;
    nlpPattern: string;
    /**
     * Optional unique identifier for this specific pattern.
     * If not provided, one might be generated during persistence.
     */
    id?: string;
    /**
     * Optional version for the pattern, useful for updates and tracking.
     */
    version?: string;
    /**
     * Optional flag to indicate if this pattern is currently active.
     * @default true
     */
    isActive?: boolean;
     /**
     * Optional source or origin of this NLP pattern (e.g., 'default_seed', 'user_defined', 'learned_runtime').
     */
    source?: string;
}

/**
 * Detailed information about an error that occurred during an operation, particularly for batch processes.
 */
export interface ErrorDetail {
    identifier?: string; // Could be toolName, patternId, or other relevant ID
    item?: NlpPatternDefinition | any; // The item that caused the error
    message: string;
    code?: string; // Optional error code
    error?: any; // Original error object if available
}

/**
 * Result of an NLP pattern seeding or batch management operation.
 */
export interface NlpManagementResult {
    /** Number of new patterns successfully created/seeded. */
    created: number;
    /** Number of existing patterns successfully updated. */
    updated: number;
    /** Number of patterns that were skipped (e.g., already exist and no overwrite requested). */
    skipped: number;
    /** Number of patterns that failed to process. */
    failed: number;
    /** Array of errors encountered during the operation. */
    errors: ErrorDetail[];
    /** Total number of patterns processed or attempted. */
    totalAttempted: number;
}

/**
 * Represents an NLP pattern as stored in and retrieved from the database.
 */
export interface StoredNlpPattern extends NlpPatternDefinition {
    id: string; // Unique identifier for the stored pattern (e.g., UUID or hash-based)
    createdAt: Date;
    updatedAt: Date;
    // isActive and source are inherited from NlpPatternDefinition if made part of it
}

/**
 * Options for seeding NLP patterns.
 */
export interface NlpSeedOptions {
    /**
     * If true, existing patterns with the same identifier (e.g., toolName + nlpPattern combination, or provided id)
     * will be overwritten/updated. If false, they will be skipped.
     * @default false
     */
    forceOverwrite?: boolean;
    /**
     * Default source to attribute to the seeded patterns if not specified in individual definitions.
     * @default 'seed_operation'
     */
    defaultSource?: string;
}

/**
 * Interface for the NlpService.
 */
export interface INlpService {
    /**
     * Seeds a list of NLP patterns into the persistence layer.
     * Checks for existence before creating/updating based on options.
     * @param patterns Array of NlpPatternDefinition objects.
     * @param options Options for the seeding operation.
     * @returns A promise resolving to an NlpManagementResult.
     */
    seedPatterns(patterns: NlpPatternDefinition[], options?: NlpSeedOptions): Promise<NlpManagementResult>;

    /**
     * Seeds NLP patterns from a JSON or YAML file into the persistence layer.
     * @param filePath Path to the file containing an array of NlpPatternDefinition objects.
     * @param options Options for the seeding operation.
     * @returns A promise resolving to an NlpManagementResult.
     */
    seedPatternsFromFile(filePath: string, options?: NlpSeedOptions): Promise<NlpManagementResult>;

    /**
     * Retrieves a specific NLP pattern by its unique ID.
     * @param patternId The unique ID of the pattern.
     * @returns A promise resolving to the StoredNlpPattern or null if not found.
     */
    getNlpPatternById(patternId: string): Promise<StoredNlpPattern | null>;

    /**
     * Retrieves all stored NLP patterns for a given tool.
     * @param toolName The name of the tool.
     * @returns A promise resolving to an array of StoredNlpPattern objects.
     */
    getNlpPatternsByTool(toolName: string): Promise<StoredNlpPattern[]>;

    /**
     * Adds a new NLP pattern to the persistence layer.
     * This method might be used for runtime additions if needed, separate from bulk seeding.
     * It should still perform checks to avoid duplicates unless explicitly told to update.
     * @param pattern The NLP pattern definition to add.
     * @param options Options, e.g., to allow update if exists.
     * @returns A promise resolving to the StoredNlpPattern.
     */
    addNlpPattern(pattern: NlpPatternDefinition, options?: { allowUpdate?: boolean }): Promise<StoredNlpPattern>;

    /**
     * Updates an existing NLP pattern.
     * @param patternId The ID of the pattern to update.
     * @param updates Partial NlpPatternDefinition containing fields to update.
     * @returns A promise resolving to the updated StoredNlpPattern.
     */
    updateNlpPattern(patternId: string, updates: Partial<Omit<StoredNlpPattern, 'id' | 'createdAt' | 'updatedAt'>>): Promise<StoredNlpPattern>;

    /**
     * Deletes an NLP pattern by its ID.
     * @param patternId The ID of the pattern to delete.
     * @returns A promise resolving to true if deletion was successful, false otherwise.
     */
    deleteNlpPattern(patternId: string): Promise<boolean>;

    /**
     * Ensures a given NLP pattern is persisted. Checks if it exists (based on toolName and nlpPattern string),
     * creates it if it doesn't, or updates it if forceOverwrite is true.
     * This is a convenience method that might be used internally by ToolService when persistNlpOnInit is true.
     * @param pattern The NLP pattern definition.
     * @param options Options like forceOverwrite.
     * @returns A promise resolving to the StoredNlpPattern.
     */
    ensurePatternPersisted(pattern: NlpPatternDefinition, options?: { forceOverwrite?: boolean }): Promise<StoredNlpPattern>;

     /**
     * Loads an NLP pattern into the runtime command map for immediate use within the current session.
     * This does NOT persist the pattern to the database.
     * @param pattern The NLP pattern definition to load into memory.
     */
    loadPatternToRuntime(pattern: NlpPatternDefinition): Promise<void>; // Interacts with ContextIntelligence or CommandMap

    /**
     * Loads all active, persisted NLP patterns from the database into the runtime 
     * (in-memory) command map for immediate use.
     * This is typically called once during SDK initialization.
     * @returns A promise resolving to an object detailing the outcome of the load operation.
     */
    loadAllPersistedPatternsToRuntime(): Promise<{ loaded: number; failed: number; errors: ErrorDetail[] }>;
} 