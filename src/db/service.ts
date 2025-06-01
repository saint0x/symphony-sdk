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
  DatabaseError,
  XMLPattern,
  PatternExecution,
  ToolExecution,
  SessionContext
} from './types';
import { StoredNlpPattern } from '../types/tool.types';
import { mapNlpPatternQueryToDbRecord, nlpPatternToDbRecord, dbRecordToNlpPattern } from './mappers';

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
    
    // If database config is provided (path, adapter, etc), assume it should be enabled
    // Only disable if explicitly set to enabled: false
    const isEnabled = this.config.enabled !== false && (
      this.config.path !== undefined ||
      this.config.adapter !== undefined ||
      this.config.connection !== undefined ||
      Object.keys(this.config).length > 0
    );
    
    if (!isEnabled) {
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
        this.logger.error('DatabaseService', `Failed to describe table '${tableName}' during schema.describe`, { error });
        throw new DatabaseValidationError(`Failed to describe table ${tableName}: ${(error as Error).message}`);
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
  async getXMLPatterns(activeOnly?: boolean): Promise<XMLPattern[]> {
    this.logger.info('DatabaseService', 'Getting XML patterns', { activeOnly });
    
    try {
      let query = this.table('xml_patterns');
      if (activeOnly) {
        query = query.where({ active: true });
      }
      
      const patterns = await query.find();
      return patterns.map(p => ({
        id: p.id,
        pattern_id: p.pattern_id,
        group_id: p.group_id,
        pattern_name: p.pattern_name,
        confidence_score: p.confidence_score,
        trigger_text: p.trigger_text,
        variables: p.variables,
        examples: p.examples,
        tool_name: p.tool_name,
        tool_parameters: p.tool_parameters,
        success_count: p.success_count,
        failure_count: p.failure_count,
        last_used: p.last_used,
        updated_at: p.updated_at,
        average_latency_ms: p.average_latency_ms,
        active: p.active
      }));
    } catch (error) {
      this.logger.error('DatabaseService', 'Failed to get XML patterns', { error });
      return [];
    }
  }

  async saveXMLPattern(pattern: Omit<XMLPattern, 'id'>): Promise<void> {
    this.logger.info('DatabaseService', 'Saving XML pattern', { patternId: pattern.pattern_id });
    
    try {
      await this.table('xml_patterns').insert({
        pattern_id: pattern.pattern_id,
        group_id: pattern.group_id,
        pattern_name: pattern.pattern_name,
        confidence_score: pattern.confidence_score,
        trigger_text: pattern.trigger_text,
        variables: JSON.stringify(pattern.variables),
        examples: JSON.stringify(pattern.examples),
        tool_name: pattern.tool_name,
        tool_parameters: JSON.stringify(pattern.tool_parameters),
        success_count: pattern.success_count,
        failure_count: pattern.failure_count,
        last_used: pattern.last_used,
        average_latency_ms: pattern.average_latency_ms,
        active: pattern.active,
        created_at: new Date(),
        updated_at: new Date()
      });
    } catch (error) {
      this.logger.error('DatabaseService', 'Failed to save XML pattern', { error, patternId: pattern.pattern_id });
      throw error;
    }
  }

  /**
   * Update pattern confidence score (core self-learning function)
   */
  async updatePatternConfidence(patternId: string, newConfidence: number): Promise<void> {
    this.logger.info('DatabaseService', 'Updating pattern confidence', { patternId, newConfidence });
    
    try {
      await this.table('xml_patterns').update(
        { pattern_id: patternId },
        { confidence_score: newConfidence, updated_at: new Date() }
      );
    } catch (error) {
      this.logger.error('DatabaseService', 'Failed to update pattern confidence', { error, patternId });
      throw error;
    }
  }

  /**
   * Record pattern execution for learning analytics
   */
  async recordPatternExecution(execution: PatternExecution): Promise<void> {
    this.logger.info('DatabaseService', 'Recording pattern execution', { executionId: execution.execution_id });
    
    try {
      await this.table('pattern_executions').insert({
        pattern_id: execution.pattern_id,
        execution_id: execution.execution_id,
        input_text: execution.input_text,
        extracted_variables: JSON.stringify(execution.extracted_variables),
        tool_result: JSON.stringify(execution.tool_result),
        success: execution.success,
        execution_time_ms: execution.execution_time_ms,
        confidence_before: execution.confidence_before,
        confidence_after: execution.confidence_after,
        session_id: execution.session_id,
        user_context: JSON.stringify(execution.user_context),
        created_at: new Date()
      });
    } catch (error) {
      this.logger.error('DatabaseService', 'Failed to record pattern execution', { error, executionId: execution.execution_id });
      throw error;
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
  async recordToolExecution(execution: Omit<ToolExecution, 'id'>): Promise<void> {
    this.logger.info('DatabaseService', 'Recording tool execution', { executionId: execution.execution_id });
    
    try {
      await this.table('tool_executions').insert({
        execution_id: execution.execution_id,
        tool_name: execution.tool_name,
        tool_version: execution.tool_version,
        session_id: execution.session_id,
        pattern_id: execution.pattern_id,
        agent_id: execution.agent_id,
        input_parameters: execution.input_parameters || (execution.parameters ? JSON.parse(execution.parameters) : {}),
        output_result: execution.output_result || (execution.result ? JSON.parse(execution.result) : {}),
        error_details: execution.error_message || execution.error_details,
        success: execution.success,
        execution_time_ms: execution.execution_time_ms,
        memory_used_mb: execution.memory_used_mb,
        cpu_time_ms: execution.cpu_time_ms,
        confidence_score: execution.confidence_score,
        user_feedback: execution.user_feedback,
        created_at: new Date()
      });
    } catch (error) {
      this.logger.error('DatabaseService', 'Failed to record tool execution', { error, executionId: execution.execution_id });
      throw error;
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

  // Session and Context Methods
  async getSessionContext(sessionId: string): Promise<SessionContext | null> {
    this.logger.info('DatabaseService', 'Getting session context', { sessionId });
    
    try {
      const session = await this.table('context_sessions').where({ session_id: sessionId }).findOne();
      if (!session) return null;
      
      return {
        session_id: session.session_id,
        session_type: session.session_type,
        started_at: session.started_at,
        last_activity: session.last_activity,
        ended_at: session.ended_at,
        active: session.active,
        context_data: JSON.parse(session.context_data || '{}'),
        parent_session_id: session.parent_session_id,
        tool_calls: session.tool_calls || 0,
        pattern_matches: session.pattern_matches || 0,
        cache_hits: session.cache_hits || 0,
        success_rate: session.success_rate || 0
      };
    } catch (error) {
      this.logger.error('DatabaseService', 'Failed to get session context', { error, sessionId });
      return null;
    }
  }
  
  async getToolExecutions(sessionId: string, limit?: number): Promise<ToolExecution[]> {
    this.logger.info('DatabaseService', 'Getting tool executions', { sessionId, limit });
    
    try {
      let query = this.table('tool_executions')
        .where({ session_id: sessionId })
        .orderBy('created_at', 'desc');
        
      if (limit) {
        query = query.limit(limit);
      }
      
      const executions = await query.find();
      return executions.map(e => ({
        id: e.id,
        execution_id: e.execution_id,
        tool_name: e.tool_name,
        tool_version: e.tool_version,
        session_id: e.session_id,
        pattern_id: e.pattern_id,
        agent_id: e.agent_id,
        parameters: e.parameters,
        result: e.result,
        error_message: e.error_message,
        success: e.success,
        execution_time_ms: e.execution_time_ms,
        memory_used_mb: e.memory_used_mb,
        cpu_time_ms: e.cpu_time_ms,
        confidence_score: e.confidence_score,
        user_feedback: e.user_feedback,
        retry_count: e.retry_count,
        created_at: e.created_at
      }));
    } catch (error) {
      this.logger.error('DatabaseService', 'Failed to get tool executions', { error, sessionId });
      return [];
    }
  }
  
  async getWorkflowExecutions(sessionId: string): Promise<any[]> {
    this.logger.info('DatabaseService', 'Getting workflow executions', { sessionId });
    
    try {
      // For now, return empty array as workflow tables might not be set up yet
      // In future, this would query workflow_executions table
      return [];
    } catch (error) {
      this.logger.error('DatabaseService', 'Failed to get workflow executions', { error, sessionId });
      return [];
    }
  }

  // Health check for cache intelligence
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; [key: string]: any }> {
    try {
      const dbHealth = await this.health();
      
      return {
        status: dbHealth.connected ? 'healthy' : 'unhealthy',
        database: dbHealth,
        adapter: this.config.adapter || 'none',
        timestamp: new Date()
      };
    } catch (error: any) {
      this.logger.error('DatabaseService', 'Health check failed', { error });
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  private async ensureNlpPatternsTableExists(): Promise<void> {
    this.ensureInitialized();
    const tableName = 'nlp_patterns';
    try {
        const tableExists = await this.schema.exists(tableName);
        if (!tableExists) {
            this.logger.info('DatabaseService', `Table '${tableName}' does not exist. Creating...`);
            await this.schema.create(tableName, {
                id: { type: 'string', primary: true },
                tool_name: { type: 'string', required: true, index: true },
                nlp_pattern: { type: 'string', required: true },
                version: { type: 'string' },
                is_active: { type: 'boolean', default: true, index: true },
                source: { type: 'string' },
                created_at: { type: 'datetime', default: 'CURRENT_TIMESTAMP' },
                updated_at: { type: 'datetime', default: 'CURRENT_TIMESTAMP' }
            });
            this.logger.info('DatabaseService', `Table '${tableName}' created successfully.`);
        }
    } catch (error) {
        this.logger.error('DatabaseService', `Error ensuring table '${tableName}' exists or creating it.`, { error });
        throw error;
    }
  }

  // --- Implementation for StoredNlpPattern methods ---

  async findNlpPatternRecord(query: Partial<Omit<StoredNlpPattern, 'createdAt' | 'updatedAt'>>): Promise<StoredNlpPattern | null> {
    await this.ensureNlpPatternsTableExists();
    this.ensureInitialized();
    const dbQuery = mapNlpPatternQueryToDbRecord(query);
    this.logger.debug('DatabaseService', 'Finding NLP pattern record', { originalQuery: query, dbQuery });
    try {
      const record = await this.adapter!.table('nlp_patterns').where(dbQuery).findOne();
      return dbRecordToNlpPattern(record);
    } catch (error) {
      this.logger.error('DatabaseService', 'Error finding NLP pattern record', { error, originalQuery: query });
      return null;
    }
  }

  async saveNlpPatternRecord(pattern: StoredNlpPattern): Promise<StoredNlpPattern> {
    await this.ensureNlpPatternsTableExists();
    this.ensureInitialized();
    this.logger.debug('DatabaseService', 'Saving NLP pattern record', { patternId: pattern.id, toolName: pattern.toolName });
    try {
      const existing = await this.adapter!.table('nlp_patterns').where({ id: pattern.id }).findOne();
      
      if (existing) {
        this.logger.debug('DatabaseService', `Updating existing NLP pattern record: ${pattern.id}`);
        // For updates, ensure createdAt is not part of the payload to DB, and use isUpdate=true for the mapper
        const { createdAt, ...updatePayload } = pattern;
        const dataToUpdateForDb = nlpPatternToDbRecord(updatePayload, true);
        await this.adapter!.table('nlp_patterns').update({ id: pattern.id }, dataToUpdateForDb);
      } else {
        this.logger.debug('DatabaseService', `Inserting new NLP pattern record: ${pattern.id}`);
        const dataToInsertForDb = nlpPatternToDbRecord(pattern, false);
        await this.adapter!.table('nlp_patterns').insert(dataToInsertForDb);
      }
      const savedOrUpdatedRecord = await this.adapter!.table('nlp_patterns').where({ id: pattern.id }).findOne();
      const resultPattern = dbRecordToNlpPattern(savedOrUpdatedRecord);
      if (!resultPattern) {
        throw new DatabaseError(`Failed to fetch pattern after save/update: ${pattern.id}`, 'FETCH_AFTER_SAVE_FAILED');
      }
      return resultPattern;
    } catch (error) {
      this.logger.error('DatabaseService', 'Error saving NLP pattern record', { error, patternId: pattern.id });
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Failed to save NLP pattern record: ${(error as Error).message}`, 'QUERY_ERROR', error);
    }
  }

  async getNlpPatternRecordById(id: string): Promise<StoredNlpPattern | null> {
    await this.ensureNlpPatternsTableExists();
    this.ensureInitialized();
    this.logger.debug('DatabaseService', 'Getting NLP pattern record by ID', { id });
    try {
      const record = await this.adapter!.table('nlp_patterns').where({ id }).findOne();
      return dbRecordToNlpPattern(record);
    } catch (error) {
      this.logger.error('DatabaseService', 'Error getting NLP pattern record by ID', { error, id });
      return null;
    }
  }

  async getNlpPatternRecordsByTool(toolName: string): Promise<StoredNlpPattern[]> {
    await this.ensureNlpPatternsTableExists();
    this.ensureInitialized();
    const dbQuery = mapNlpPatternQueryToDbRecord({ toolName });
    this.logger.debug('DatabaseService', 'Getting NLP pattern records by tool', { toolName, dbQuery });
    try {
      const records = await this.adapter!.table('nlp_patterns').where(dbQuery).find();
      return records.map(dbRecordToNlpPattern).filter(p => p !== null) as StoredNlpPattern[];
    } catch (error) {
      this.logger.error('DatabaseService', 'Error getting NLP pattern records by tool', { error, toolName });
      return [];
    }
  }

  async updateNlpPatternRecord(id: string, updates: Partial<Omit<StoredNlpPattern, 'id' | 'createdAt'>>): Promise<StoredNlpPattern | null> {
    await this.ensureNlpPatternsTableExists();
    this.ensureInitialized();
    this.logger.debug('DatabaseService', 'Updating NLP pattern record', { id, updates });
    try {
      // For updates, ensure createdAt is not part of the payload to DB, and use isUpdate=true for the mapper
      // The `updates` object already Omit<..., 'createdAt'>, so we don't need to worry about it being in `updates` itself.
      const dataToUpdateForDb = nlpPatternToDbRecord({ ...updates, id }, true);
      // Explicitly delete created_at from the mapped object before sending to DB, just in case mapper added it somehow (though it shouldn't for isUpdate=true)
      if (dataToUpdateForDb.created_at !== undefined) {
        delete dataToUpdateForDb.created_at;
      }

      const result = await this.adapter!.table('nlp_patterns').update({ id }, dataToUpdateForDb);
      if (result.success && result.rowsAffected > 0) {
        const updatedRecord = await this.adapter!.table('nlp_patterns').where({ id }).findOne();
        return dbRecordToNlpPattern(updatedRecord);
      }
      this.logger.warn('DatabaseService', 'NLP pattern record not found or not updated', { id });
      return null;
    } catch (error) {
      this.logger.error('DatabaseService', 'Error updating NLP pattern record', { error, id });
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Failed to update NLP pattern record: ${(error as Error).message}`, 'QUERY_ERROR', error);
    }
  }

  async deleteNlpPatternRecord(id: string): Promise<boolean> {
    await this.ensureNlpPatternsTableExists();
    this.ensureInitialized();
    this.logger.debug('DatabaseService', 'Deleting NLP pattern record', { id });
    try {
      const result = await this.adapter!.table('nlp_patterns').delete({ id });
      return result.success && result.rowsDeleted > 0;
    } catch (error) {
      this.logger.error('DatabaseService', 'Error deleting NLP pattern record', { error, id });
      return false;
    }
  }

  async countNlpPatternRecords(query?: Partial<Omit<StoredNlpPattern, 'createdAt' | 'updatedAt'>>): Promise<number> {
    await this.ensureNlpPatternsTableExists();
    this.ensureInitialized();
    const dbQuery = query ? mapNlpPatternQueryToDbRecord(query) : {};
    this.logger.debug('DatabaseService', 'Counting NLP pattern records', { originalQuery: query, dbQuery });
    try {
      return await this.adapter!.table('nlp_patterns').where(dbQuery).count();
    } catch (error) {
      this.logger.error('DatabaseService', 'Error counting NLP pattern records', { error, originalQuery: query });
      return 0;
    }
  }

  async getAllNlpPatternRecords(query?: Partial<Omit<StoredNlpPattern, 'createdAt' | 'updatedAt'>>): Promise<StoredNlpPattern[]> {
    await this.ensureNlpPatternsTableExists();
    this.ensureInitialized();
    const dbQuery = query ? mapNlpPatternQueryToDbRecord(query) : {};
    this.logger.debug('DatabaseService', 'Getting all NLP pattern records', { originalQuery: query, dbQuery });
    try {
      const records = await this.adapter!.table('nlp_patterns').where(dbQuery).find();
      return records.map(dbRecordToNlpPattern).filter(p => p !== null) as StoredNlpPattern[];
    } catch (error) {
      this.logger.error('DatabaseService', 'Error getting all NLP pattern records', { error, originalQuery: query });
      return [];
    }
  }
}

// Export for use in Symphony
export default DatabaseService; 