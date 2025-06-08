// Database Module - Export all public APIs
export { DatabaseService } from './service';
export { SQLiteAdapter } from './adapters/sqlite';

// Export all types
export type {
  DatabaseConfig,
  DatabaseAdapter,
  SetOptions,
  TableOperations,
  TableQuery,
  TableSchema,
  ColumnDefinition,
  InsertResult,
  UpdateResult,
  DeleteResult,
  AggregateOperations,
  TransactionContext,
  WhereCondition,
  OrderRule,
  JoinClause,
  DatabaseHealth,
  DatabaseStats,
  XMLPattern,
  PatternExecution,
  ContextSession,
  ToolExecution
} from './types';

// Export IDatabaseService interface from the correct module
export type { IDatabaseService } from './IDatabaseService';

// Export error classes
export {
  DatabaseError,
  DatabaseConnectionError,
  DatabaseValidationError,
  DatabaseQueryError
} from './types';

// Default export for convenience
export { DatabaseService as default } from './service'; 