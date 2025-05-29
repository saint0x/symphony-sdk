import { Logger } from '../utils/logger';
import { SQLiteAdapter } from './adapters/sqlite';
import {
  IDatabaseService,
  DatabaseConfig,
  DatabaseAdapter,
  SetOptions,
  TableOperations,
  TableSchema,
  DatabaseHealth,
  DatabaseStats,
  DatabaseConnectionError,
  DatabaseValidationError,
  DatabaseError
} from './types';

export class DatabaseService implements IDatabaseService {
  private adapter: DatabaseAdapter | null = null;
  private logger: Logger;
  private config: DatabaseConfig = {};
  private initialized = false;
  private adapters: Map<string, () => DatabaseAdapter> = new Map();

  constructor(config: DatabaseConfig = {}) {
    this.config = config;
    this.logger = Logger.getInstance('DatabaseService');
    
    // Register built-in adapters
    this.registerBuiltInAdapters();
  }

  private registerBuiltInAdapters(): void {
    this.adapters.set('sqlite', () => new SQLiteAdapter());
    // Future adapters can be registered here
    // this.adapters.set('postgresql', () => new PostgreSQLAdapter());
    // this.adapters.set('redis', () => new RedisAdapter());
  }

  async initialize(config: DatabaseConfig = {}): Promise<void> {
    if (this.initialized) {
      this.logger.warn('DatabaseService', 'Database already initialized');
      return;
    }

    this.config = { ...this.config, ...config };
    
    if (!this.config.enabled) {
      this.logger.info('DatabaseService', 'Database service disabled by configuration');
      return;
    }

    try {
      this.logger.info('DatabaseService', 'Initializing database service', {
        adapter: this.config.adapter || 'sqlite',
        path: this.config.path
      });

      // Use specified adapter or default to SQLite
      const adapterName = this.config.adapter || 'sqlite';
      await this.useAdapter(adapterName, this.config);

      this.initialized = true;
      this.logger.info('DatabaseService', 'Database service initialized successfully');
    } catch (error) {
      this.logger.error('DatabaseService', 'Failed to initialize database service', { error });
      throw new DatabaseConnectionError(`Database initialization failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
    }
    this.initialized = false;
    this.logger.info('DatabaseService', 'Database service disconnected');
  }

  async use(adapter: string | DatabaseAdapter, config?: any): Promise<void> {
    if (typeof adapter === 'string') {
      await this.useAdapter(adapter, config);
    } else {
      this.adapter = adapter;
      await this.adapter.connect(config || this.config);
    }
  }

  private async useAdapter(name: string, config: DatabaseConfig): Promise<void> {
    const adapterFactory = this.adapters.get(name);
    
    if (!adapterFactory) {
      throw new DatabaseValidationError(`Unknown adapter: ${name}. Available adapters: ${Array.from(this.adapters.keys()).join(', ')}`);
    }

    this.adapter = adapterFactory();
    await this.adapter.connect(config);
    
    this.logger.info('DatabaseService', `Using ${name} adapter`);
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.adapter) {
      throw new DatabaseConnectionError('Database not initialized. Call initialize() first.');
    }
  }

  // Key-value operations
  async get(key: string, namespace?: string): Promise<any> {
    this.ensureInitialized();
    return this.adapter!.get(key, namespace);
  }

  async set(key: string, value: any, options?: SetOptions): Promise<void> {
    this.ensureInitialized();
    return this.adapter!.set(key, value, options);
  }

  async delete(key: string, namespace?: string): Promise<boolean> {
    this.ensureInitialized();
    return this.adapter!.delete(key, namespace);
  }

  async find(pattern: string, filter?: Record<string, any>, namespace?: string): Promise<any[]> {
    this.ensureInitialized();
    return this.adapter!.find(pattern, filter, namespace);
  }

  // Table operations
  table(name: string): TableOperations {
    this.ensureInitialized();
    return this.adapter!.table(name);
  }

  // Schema management
  schema = {
    create: async (tableName: string, schema: TableSchema): Promise<void> => {
      this.ensureInitialized();
      if (!this.adapter!.createTable) {
        throw new DatabaseValidationError('Current adapter does not support schema creation');
      }
      return this.adapter!.createTable(tableName, schema);
    },

    drop: async (tableName: string): Promise<void> => {
      this.ensureInitialized();
      if (!this.adapter!.dropTable) {
        throw new DatabaseValidationError('Current adapter does not support schema modification');
      }
      return this.adapter!.dropTable(tableName);
    },

    exists: async (tableName: string): Promise<boolean> => {
      this.ensureInitialized();
      try {
        await this.table(tableName).count();
        return true; // If count succeeds, table exists
      } catch {
        return false;
      }
    },

    describe: async (tableName: string): Promise<TableSchema> => {
      this.ensureInitialized();
      // This is adapter-specific - for SQLite we can query sqlite_master
      if (!this.adapter!.query) {
        throw new DatabaseValidationError('Current adapter does not support schema inspection');
      }
      
      try {
        const columns = await this.adapter!.query(`PRAGMA table_info(${tableName})`);
        const schema: TableSchema = {};
        
        for (const column of columns) {
          schema[column.name] = {
            type: this.mapSQLiteTypeToSchema(column.type),
            primary: column.pk === 1,
            required: column.notnull === 1,
            default: column.dflt_value
          };
        }
        
        return schema;
      } catch (error) {
        throw new DatabaseValidationError(`Failed to describe table ${tableName}: ${error}`);
      }
    }
  };

  private mapSQLiteTypeToSchema(sqliteType: string): 'integer' | 'string' | 'real' | 'boolean' | 'json' | 'datetime' {
    const type = sqliteType.toUpperCase();
    if (type.includes('INT')) return 'integer';
    if (type.includes('TEXT') || type.includes('CHAR') || type.includes('CLOB')) return 'string';
    if (type.includes('REAL') || type.includes('FLOA') || type.includes('DOUB')) return 'real';
    if (type.includes('BOOL')) return 'boolean';
    if (type.includes('JSON')) return 'json';
    if (type.includes('DATE') || type.includes('TIME')) return 'datetime';
    return 'string'; // Default fallback
  }

  // Utilities
  async health(): Promise<DatabaseHealth> {
    this.ensureInitialized();
    
    try {
      // Basic connectivity test
      if (this.adapter!.query) {
        await this.adapter!.query('SELECT 1');
      } else {
        await this.get('__health_check__');
      }
      
      const stats = (this.adapter as any).getStats ? (this.adapter as any).getStats() : {
        totalQueries: 0,
        successfulQueries: 0,
        failedQueries: 0,
        avgQueryTime: 0
      };

      // Get table count and approximate record count
      let tableCount = 0;
      let recordCount = 0;
      
      if (this.adapter!.query) {
        try {
          const tables = await this.adapter!.query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
          );
          tableCount = tables.length;
          
          // Get approximate total record count
          for (const table of tables) {
            try {
              const count = await this.table(table.name).count();
              recordCount += count;
            } catch {
              // Skip tables we can't access
            }
          }
        } catch {
          // Fallback for non-SQLite adapters
        }
      }

      return {
        connected: true,
        adapter: this.config.adapter || 'sqlite',
        performance: {
          avgQueryTime: stats.avgQueryTime,
          totalQueries: stats.totalQueries,
          errorRate: stats.totalQueries > 0 ? stats.failedQueries / stats.totalQueries : 0
        },
        storage: {
          size: 'unknown', // Could be implemented per adapter
          tableCount,
          recordCount
        }
      };
    } catch (error) {
      return {
        connected: false,
        adapter: this.config.adapter || 'sqlite',
        performance: {
          avgQueryTime: 0,
          totalQueries: 0,
          errorRate: 1
        },
        storage: {
          size: 'unknown',
          tableCount: 0,
          recordCount: 0
        }
      };
    }
  }

  async stats(): Promise<DatabaseStats> {
    this.ensureInitialized();
    
    const adapterStats = (this.adapter as any).getStats ? (this.adapter as any).getStats() : {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      avgQueryTime: 0,
      uptime: 0
    };

    // Get table names
    let tablesUsed: string[] = [];
    if (this.adapter!.query) {
      try {
        const tables = await this.adapter!.query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
        tablesUsed = tables.map(t => t.name);
      } catch {
        // Fallback for non-SQLite adapters
      }
    }

    // Get namespaces
    let namespaces: string[] = [];
    try {
      if (this.adapter!.query) {
        const result = await this.adapter!.query('SELECT DISTINCT namespace FROM user_data');
        namespaces = result.map((r: any) => r.namespace);
      } else {
        namespaces = ['default'];
      }
    } catch {
      namespaces = ['default'];
    }

    return {
      adapter: this.config.adapter || 'sqlite',
      uptime: adapterStats.uptime,
      totalQueries: adapterStats.totalQueries,
      successfulQueries: adapterStats.successfulQueries,
      failedQueries: adapterStats.failedQueries,
      avgQueryTime: adapterStats.avgQueryTime,
      slowestQuery: { sql: 'unknown', time: 0 }, // Could be tracked per adapter
      fastestQuery: { sql: 'unknown', time: 0 },
      tablesUsed,
      namespaces
    };
  }

  async backup(path?: string): Promise<void> {
    this.ensureInitialized();
    
    // This is adapter-specific functionality
    if ((this.adapter as any).backup) {
      return (this.adapter as any).backup(path);
    } else {
      throw new DatabaseValidationError('Current adapter does not support backup functionality');
    }
  }

  async raw(sql: string, params?: any[]): Promise<any[]> {
    this.ensureInitialized();
    
    if (!this.adapter!.query) {
      throw new DatabaseValidationError('Current adapter does not support raw SQL queries');
    }
    
    this.logger.warn('DatabaseService', 'Executing raw SQL query', { sql });
    return this.adapter!.query(sql, params);
  }

  // XML Pattern helpers (for cache intelligence)
  async getXMLPatterns(active: boolean = true): Promise<any[]> {
    return this.table('xml_patterns')
      .where({ active })
      .orderBy('confidence_score', 'desc')
      .find();
  }

  async saveXMLPattern(pattern: any): Promise<void> {
    await this.table('xml_patterns').insert(pattern);
  }

  /**
   * Update pattern confidence score (core self-learning function)
   */
  async updatePatternConfidence(patternId: string, newConfidence: number): Promise<void> {
    if (!this.adapter) {
      throw new DatabaseError('Database not initialized', 'CONNECTION_ERROR');
    }

    try {
      await this.adapter.table('xml_patterns')
        .update(
          { pattern_id: patternId },
          { 
            confidence_score: newConfidence,
            updated_at: new Date().toISOString()
          }
        );
    } catch (error: any) {
      this.logger.error('DatabaseService', 'Failed to update pattern confidence', { error: error.message });
      throw new DatabaseError(`Failed to update pattern confidence: ${error.message}`, 'QUERY_ERROR');
    }
  }

  /**
   * Record pattern execution for learning analytics
   */
  async recordPatternExecution(execution: {
    pattern_id: number;
    execution_id: string;
    input_text: string;
    extracted_variables: string;
    tool_result: string;
    success: boolean;
    execution_time_ms: number;
    confidence_before?: number;
    confidence_after?: number;
    session_id?: string;
    user_context?: string;
  }): Promise<void> {
    if (!this.adapter) {
      throw new DatabaseError('Database not initialized', 'CONNECTION_ERROR');
    }

    try {
      await this.adapter.table('pattern_executions').insert({
        ...execution,
        created_at: new Date().toISOString()
      });
    } catch (error: any) {
      this.logger.error('DatabaseService', 'Failed to record pattern execution', { error: error.message });
      throw new DatabaseError(`Failed to record pattern execution: ${error.message}`, 'QUERY_ERROR');
    }
  }

  // Context session helpers
  async createSession(sessionData: any): Promise<string> {
    const result = await this.table('context_sessions').insert(sessionData);
    return result.id!.toString();
  }

  async getActiveSession(): Promise<any | null> {
    return this.table('context_sessions')
      .where({ active: true })
      .orderBy('last_activity', 'desc')
      .findOne();
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    if (!this.adapter) {
      throw new DatabaseError('Database not initialized', 'CONNECTION_ERROR');
    }

    try {
      await this.adapter.table('context_sessions')
        .update(
          { session_id: sessionId },
          { 
            last_activity: new Date().toISOString()
          }
        );
    } catch (error: any) {
      this.logger.error('DatabaseService', 'Failed to update session activity', { error: error.message });
      throw new DatabaseError(`Failed to update session activity: ${error.message}`, 'QUERY_ERROR');
    }
  }

  // Tool execution tracking
  /**
   * Record tool execution for performance tracking
   */
  async recordToolExecution(execution: {
    execution_id: string;
    tool_name: string;
    tool_version?: string;
    session_id?: string;
    pattern_id?: number;
    agent_id?: string;
    input_parameters: string;
    output_result?: string;
    error_details?: string;
    success: boolean;
    execution_time_ms: number;
    memory_used_mb?: number;
    cpu_time_ms?: number;
    confidence_score?: number;
    user_feedback?: number;
  }): Promise<void> {
    if (!this.adapter) {
      throw new DatabaseError('Database not initialized', 'CONNECTION_ERROR');
    }

    try {
      await this.adapter.table('tool_executions').insert({
        ...execution,
        created_at: new Date().toISOString()
      });
    } catch (error: any) {
      this.logger.error('DatabaseService', 'Failed to record tool execution', { error: error.message });
      throw new DatabaseError(`Failed to record tool execution: ${error.message}`, 'QUERY_ERROR');
    }
  }

  /**
   * Get comprehensive tool analytics
   */
  async getToolAnalytics(): Promise<Array<{
    tool_name: string;
    total_executions: number;
    successful_executions: number;
    success_rate: number;
    avg_execution_time: number;
    min_execution_time: number;
    max_execution_time: number;
    unique_sessions: number;
  }>> {
    if (!this.adapter) {
      throw new DatabaseError('Database not initialized', 'CONNECTION_ERROR');
    }

    try {
      // Use the view we created in the schema
      const results = await this.adapter.query!(`
        SELECT * FROM tool_analytics ORDER BY total_executions DESC
      `);
      
      return results;
    } catch (error: any) {
      this.logger.error('DatabaseService', 'Failed to get tool analytics', { error: error.message });
      throw new DatabaseError(`Failed to get tool analytics: ${error.message}`, 'QUERY_ERROR');
    }
  }

  // Performance metrics
  async recordMetric(metric: any): Promise<void> {
    await this.table('performance_metrics').insert(metric);
  }

  async getMetrics(metricType: string, timePeriod: string = 'day'): Promise<any[]> {
    return this.table('performance_metrics')
      .where({ metric_type: metricType, time_period: timePeriod })
      .orderBy('created_at', 'desc')
      .limit(100)
      .find();
  }
}

// Export for use in Symphony
export default DatabaseService; 