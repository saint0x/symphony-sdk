import { StoredNlpPattern } from '../types/tool.types';

/**
 * Database configuration options
 */
export interface DatabaseConfig {
  enabled?: boolean;
  adapter?: 'sqlite' | 'postgresql' | 'mysql' | 'redis' | 'custom';
  path?: string;                    // For SQLite
  connection?: any;                 // For external databases
  options?: {
    maxConnections?: number;
    timeout?: number;
    autoBackup?: boolean;
    maxSize?: string;              // '100MB'
    namespace?: string;            // Default namespace for keys
  };
}

export interface SetOptions {
  ttl?: number;                     // Time to live in seconds
  namespace?: string;               // Override default namespace
  type?: 'json' | 'string' | 'number' | 'boolean';
}

export interface TableSchema {
  [columnName: string]: ColumnDefinition;
}

export interface ColumnDefinition {
  type: 'integer' | 'string' | 'real' | 'boolean' | 'json' | 'datetime';
  primary?: boolean;
  autoIncrement?: boolean;
  required?: boolean;
  unique?: boolean;
  index?: boolean;
  default?: any;
  references?: {
    table: string;
    column: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  };
}

export interface InsertResult {
  id?: number | string;
  rowsAffected: number;
  success: boolean;
}

export interface UpdateResult {
  rowsAffected: number;
  success: boolean;
}

export interface DeleteResult {
  rowsDeleted: number;
  success: boolean;
}

export interface TableQuery {
  // Chaining operations return TableQuery for fluent interface
  where(conditions: Record<string, any>): TableQuery;
  whereIn(field: string, values: any[]): TableQuery;
  whereGte(field: string, value: any): TableQuery;
  whereLte(field: string, value: any): TableQuery;
  whereLike(field: string, pattern: string): TableQuery;
  orderBy(field: string, direction?: 'asc' | 'desc'): TableQuery;
  limit(count: number): TableQuery;
  offset(count: number): TableQuery;
  
  // Advanced operations
  join(table: string, leftField: string, rightField: string): TableQuery;
  select(fields: string[]): TableQuery;
  groupBy(field: string): TableQuery;
  having(conditions: Record<string, any>): TableQuery;
  
  // Direct operations
  insert(data: Record<string, any>): Promise<InsertResult>;
  insertMany(data: Record<string, any>[]): Promise<InsertResult[]>;
  update(where: Record<string, any>, data: Record<string, any>): Promise<UpdateResult>;
  delete(where: Record<string, any>): Promise<DeleteResult>;
  
  // Immediate queries
  find(): Promise<any[]>;
  findOne(): Promise<any | null>;
  count(): Promise<number>;
  exists(where: Record<string, any>): Promise<boolean>;
  
  // Aggregation
  aggregate(operations: AggregateOperations): Promise<Record<string, any>>;
}

export interface TableOperations {
  // Query building (fluent interface)
  where(conditions: Record<string, any>): TableQuery;
  whereIn(field: string, values: any[]): TableQuery;
  whereGte(field: string, value: any): TableQuery;
  whereLte(field: string, value: any): TableQuery;
  whereLike(field: string, pattern: string): TableQuery;
  orderBy(field: string, direction?: 'asc' | 'desc'): TableQuery;
  limit(count: number): TableQuery;
  offset(count: number): TableQuery;
  
  // Direct operations
  insert(data: Record<string, any>): Promise<InsertResult>;
  insertMany(data: Record<string, any>[]): Promise<InsertResult[]>;
  update(where: Record<string, any>, data: Record<string, any>): Promise<UpdateResult>;
  delete(where: Record<string, any>): Promise<DeleteResult>;
  
  // Immediate queries
  find(): Promise<any[]>;
  findOne(): Promise<any | null>;
  count(): Promise<number>;
  exists(where: Record<string, any>): Promise<boolean>;
}

export interface AggregateOperations {
  [alias: string]: 'count' | 'sum' | 'avg' | 'min' | 'max' | string; // string for 'avg:field_name'
}

export interface DatabaseHealth {
  connected: boolean;
  adapter: string;
  performance: {
    avgQueryTime: number;
    totalQueries: number;
    errorRate: number;
  };
  storage: {
    size: string;
    tableCount: number;
    recordCount: number;
  };
}

export interface DatabaseStats {
  adapter: string;
  uptime: number;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  avgQueryTime: number;
  slowestQuery: { sql: string; time: number };
  fastestQuery: { sql: string; time: number };
  tablesUsed: string[];
  namespaces: string[];
}

// XML Pattern specific types (for cache intelligence)
export interface XMLPattern {
  id?: number; // Database auto-increment ID
  pattern_id: string;
  group_id: number;
  pattern_name: string;
  confidence_score: number;
  trigger_text: string;
  variables: any;
  examples: any;
  tool_name: string;
  tool_parameters: any;
  success_count: number;
  failure_count: number;
  last_used?: Date;
  updated_at?: Date;
  average_latency_ms: number;
  active: boolean;
}

export interface PatternExecution {
  id?: number; // Database auto-increment ID
  pattern_id: number;
  execution_id: string;
  input_text: string;
  extracted_variables: any;
  tool_result: any;
  success: boolean;
  execution_time_ms: number;
  confidence_before?: number;
  confidence_after?: number;
  session_id?: string;
  user_context?: any;
  created_at?: Date;
}

export interface ContextSession {
  session_id: string;
  session_type: 'user' | 'system' | 'learning';
  started_at: Date;
  last_activity: Date;
  ended_at?: Date;
  active: boolean;
  context_data: any;
  parent_session_id?: string;
  tool_calls: number;
  pattern_matches: number;
  cache_hits: number;
  success_rate: number;
}

// Add alias for backward compatibility
export type SessionContext = ContextSession;

export interface ToolExecution {
  id?: number; // Database auto-increment ID
  execution_id: string;
  tool_name: string;
  tool_version?: string;
  session_id?: string;
  pattern_id?: number;
  agent_id?: string;
  input_parameters?: any; // Made optional for compatibility
  parameters?: string; // JSON string version for database storage
  output_result?: any; // Made optional for compatibility  
  result?: string; // JSON string version for database storage
  error_details?: string;
  error_message?: string; // Alternative field name for compatibility
  success: boolean;
  execution_time_ms: number;
  memory_used_mb?: number; // Made optional
  cpu_time_ms?: number; // Made optional
  confidence_score?: number;
  user_feedback?: number;
  retry_count?: number;
  created_at?: Date;
}

/**
 * Comprehensive Database Service Interface
 * Single source of truth for all database operations in Symphony SDK
 */
export interface IDatabaseService {
  // Initialization
  initialize(config?: DatabaseConfig): Promise<void>;
  disconnect(): Promise<void>;
  
  // Adapter management
  use(adapter: string | any, config?: any): Promise<void>;
  
  // Key-value operations
  get(key: string, namespace?: string): Promise<any>;
  set(key: string, value: any, options?: SetOptions): Promise<void>;
  delete(key: string, namespace?: string): Promise<boolean>;
  find(pattern: string, filter?: Record<string, any>, namespace?: string): Promise<any[]>;
  
  // Table operations
  table(name: string): TableOperations;
  
  // Schema management
  schema: {
    create(tableName: string, schema: TableSchema): Promise<void>;
    drop(tableName: string): Promise<void>;
    exists(tableName: string): Promise<boolean>;
    describe(tableName: string): Promise<TableSchema>;
  };
  
  // Utilities
  health(): Promise<DatabaseHealth>;
  stats(): Promise<DatabaseStats>;
  backup?(path?: string): Promise<void>;
  
  // Raw access (escape hatch)
  raw?(sql: string, params?: any[]): Promise<any[]>;
  
  // Cache Intelligence Methods
  getXMLPatterns(activeOnly?: boolean): Promise<XMLPattern[]>;
  saveXMLPattern(pattern: Omit<XMLPattern, 'id'>): Promise<void>;
  updatePatternConfidence(patternId: string, newConfidence: number): Promise<void>;
  recordPatternExecution(execution: PatternExecution): Promise<void>;
  
  // Session and Context Methods
  getSessionContext(sessionId: string): Promise<SessionContext | null>;
  getToolExecutions(sessionId: string, limit?: number): Promise<ToolExecution[]>;
  getWorkflowExecutions(sessionId: string): Promise<any[]>;
  recordToolExecution(execution: Omit<ToolExecution, 'id'>): Promise<void>;
  
  // Health check for cache intelligence
  healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; [key: string]: any }>;

  // --- Methods for StoredNlpPattern (Managed by NlpService) ---
  findNlpPatternRecord(query: Partial<Omit<StoredNlpPattern, 'createdAt' | 'updatedAt'>>): Promise<StoredNlpPattern | null>;
  saveNlpPatternRecord(pattern: StoredNlpPattern): Promise<StoredNlpPattern>; 
  getNlpPatternRecordById(id: string): Promise<StoredNlpPattern | null>;
  getNlpPatternRecordsByTool(toolName: string): Promise<StoredNlpPattern[]>;
  updateNlpPatternRecord(id: string, updates: Partial<Omit<StoredNlpPattern, 'id' | 'createdAt' | 'updatedAt'>>): Promise<StoredNlpPattern | null>;
  deleteNlpPatternRecord(id: string): Promise<boolean>;
  countNlpPatternRecords(query?: Partial<Omit<StoredNlpPattern, 'createdAt' | 'updatedAt'>>): Promise<number>;
  getAllNlpPatternRecords(query?: Partial<Omit<StoredNlpPattern, 'createdAt' | 'updatedAt'>>): Promise<StoredNlpPattern[]>;
} 