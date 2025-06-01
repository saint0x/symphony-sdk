import { NlpPatternDefinition, StoredNlpPattern } from '../types/tool.types';

/**
 * Interface for DatabaseService operations related to NLP patterns.
 */
export interface IDatabaseService {
    // ... other existing database service methods ...

    /**
     * Finds a single NLP pattern based on a query (e.g., toolName and nlpPattern string for exact match).
     * This is crucial for the "check-exists" part of seeding/adding patterns.
     * @param query An object specifying criteria to find the pattern.
     *              Example: { toolName: string, nlpPattern: string } or { id: string }
     * @returns A promise resolving to the StoredNlpPattern or null if not found.
     */
    findNlpPattern(query: Partial<StoredNlpPattern>): Promise<StoredNlpPattern | null>;

    /**
     * Saves a new NLP pattern to the database or updates an existing one if an ID is matched.
     * This method should handle the creation of a unique ID if not provided and pattern.id is undefined.
     * It should also set createdAt and updatedAt timestamps.
     * @param pattern The NLP pattern definition to save/update. If pattern.id is provided and matches an existing record, it updates.
     * @returns A promise resolving to the saved/updated StoredNlpPattern.
     */
    saveNlpPattern(pattern: NlpPatternDefinition): Promise<StoredNlpPattern>;

    /**
     * Retrieves a specific NLP pattern by its unique ID from the database.
     * @param patternId The unique ID of the pattern.
     * @returns A promise resolving to the StoredNlpPattern or null if not found.
     */
    getNlpPatternById(patternId: string): Promise<StoredNlpPattern | null>;

    /**
     * Retrieves all stored NLP patterns for a given tool name from the database.
     * @param toolName The name of the tool.
     * @returns A promise resolving to an array of StoredNlpPattern objects.
     */
    getNlpPatternsByTool(toolName: string): Promise<StoredNlpPattern[]>;

    /**
     * Updates an existing NLP pattern in the database, identified by its ID.
     * Should only update fields provided in the 'updates' object and automatically update 'updatedAt'.
     * @param patternId The ID of the pattern to update.
     * @param updates A partial StoredNlpPattern object containing the fields to update.
     * @returns A promise resolving to the updated StoredNlpPattern.
     * @throws Error if the pattern with the given ID is not found.
     */
    updateNlpPattern(patternId: string, updates: Partial<Omit<StoredNlpPattern, 'id' | 'createdAt' | 'updatedAt'>>): Promise<StoredNlpPattern>;

    /**
     * Deletes an NLP pattern from the database by its ID.
     * @param patternId The ID of the pattern to delete.
     * @returns A promise resolving to true if deletion was successful, false otherwise.
     */
    deleteNlpPattern(patternId: string): Promise<boolean>;

     /**
     * Counts NLP patterns matching a specific query.
     * @param query A partial StoredNlpPattern object to filter by.
     * @returns A promise resolving to the number of matching patterns.
     */
    countNlpPatterns(query?: Partial<StoredNlpPattern>): Promise<number>;

    // Potentially a method for batch operations if your DB adapter supports it efficiently
    // batchUpsertNlpPatterns(patterns: NlpPatternDefinition[]): Promise<NlpManagementResult>;
} 