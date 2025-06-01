import { StoredNlpPattern } from '../types/tool.types';

// Helper to convert StoredNlpPattern/NlpPatternDefinition query to DB record query (snake_case)
export function mapNlpPatternQueryToDbRecord(query: Partial<Omit<StoredNlpPattern, 'createdAt' | 'updatedAt'>>): any {
    const dbQuery: any = {};
    if (query.id !== undefined) dbQuery.id = query.id;
    if (query.toolName !== undefined) dbQuery.tool_name = query.toolName;
    if (query.nlpPattern !== undefined) dbQuery.nlp_pattern = query.nlpPattern;
    if (query.version !== undefined) dbQuery.version = query.version;
    if (query.isActive !== undefined) dbQuery.is_active = query.isActive;
    if (query.source !== undefined) dbQuery.source = query.source;
    return dbQuery;
}

// Helper to convert StoredNlpPattern object to DB record for saving/updating (snake_case)
// For updates, ensure only provided fields are included.
export function nlpPatternToDbRecord(pattern: Partial<StoredNlpPattern>, isUpdate: boolean = false): any {
    const record: any = {};
    // Include all fields that might be present in StoredNlpPattern
    if (pattern.id !== undefined) record.id = pattern.id;
    if (pattern.toolName !== undefined) record.tool_name = pattern.toolName;
    if (pattern.nlpPattern !== undefined) record.nlp_pattern = pattern.nlpPattern;
    if (pattern.version !== undefined) record.version = pattern.version;
    if (pattern.isActive !== undefined) record.is_active = pattern.isActive;
    if (pattern.source !== undefined) record.source = pattern.source;
    
    if (!isUpdate) { // For insert, include createdAt if not present
        record.created_at = (pattern.createdAt instanceof Date ? pattern.createdAt.toISOString() : pattern.createdAt) || new Date().toISOString();
    }
    // Always include updatedAt
    record.updated_at = (pattern.updatedAt instanceof Date ? pattern.updatedAt.toISOString() : pattern.updatedAt) || new Date().toISOString();
    
    // Clean up undefined fields to avoid issues with some DB adapters
    Object.keys(record).forEach(key => {
        if (record[key] === undefined) {
          delete record[key];
        }
    });
    return record;
}

// Helper to convert DB record (snake_case) to StoredNlpPattern object
export function dbRecordToNlpPattern(record: any): StoredNlpPattern | null {
    if (!record) return null;
    return {
        id: record.id,
        toolName: record.tool_name,
        nlpPattern: record.nlp_pattern,
        version: record.version,
        isActive: typeof record.is_active === 'number' ? record.is_active === 1 : record.is_active, // SQLite stores boolean as 0/1
        source: record.source,
        createdAt: new Date(record.created_at),
        updatedAt: new Date(record.updated_at),
    } as StoredNlpPattern;
} 