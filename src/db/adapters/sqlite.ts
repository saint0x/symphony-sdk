import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '../../utils/logger';
import {
  DatabaseAdapter,
  DatabaseConfig,
  SetOptions,
  TableOperations,
  TableQuery,
  TableSchema,
  WhereCondition,
  OrderRule,
  JoinClause,
  InsertResult,
  UpdateResult,
  DeleteResult,
  AggregateOperations,
  TransactionContext,
  DatabaseConnectionError,
  DatabaseQueryError,
  DatabaseError
} from '../types';

export class SQLiteAdapter implements DatabaseAdapter {
  private db: Database | null = null;
  private logger: Logger;
  private stats = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    queryTimes: [] as number[],
    startTime: Date.now()
  };

  constructor() {
    this.logger = Logger.getInstance('SQLiteAdapter');
  }

  async connect(config: DatabaseConfig): Promise<void> {
    const dbPath = config.path || './symphonic.db';

    try {
      this.logger.info('SQLiteAdapter', `Connecting to database: ${dbPath}`);

      this.db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      // Enable WAL mode and foreign keys
      await this.db.exec('PRAGMA journal_mode = WAL');
      await this.db.exec('PRAGMA foreign_keys = ON');
      await this.db.exec('PRAGMA synchronous = NORMAL');

      // Initialize schema if needed
      await this.initializeSchema();

      this.logger.info('SQLiteAdapter', 'Database connection established successfully');
    } catch (error) {
      this.logger.error('SQLiteAdapter', 'Failed to connect to database', { error });
      throw new DatabaseConnectionError(`Failed to connect to SQLite database: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.logger.info('SQLiteAdapter', 'Database connection closed');
    }
  }

  private async initializeSchema(): Promise<void> {
    if (!this.db) throw new DatabaseConnectionError('Database not connected');

    try {
      // Check if schema is already initialized
      const tables = await this.db.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );

      if (tables.length === 0) {
        this.logger.info('SQLiteAdapter', 'Initializing database schema');
        
        // Read and execute schema
        const schemaPath = join(__dirname, '../schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');
        
        // Split by semicolon and execute each statement
        const statements = schema.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            await this.db.exec(statement.trim());
          }
        }
        
        this.logger.info('SQLiteAdapter', 'Schema initialized successfully');
      } else {
        this.logger.info('SQLiteAdapter', `Database already initialized with ${tables.length} tables`);
      }
    } catch (error) {
      this.logger.error('SQLiteAdapter', 'Failed to initialize schema', { error });
      throw new DatabaseConnectionError(`Failed to initialize schema: ${error}`);
    }
  }

  private async executeQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) throw new DatabaseConnectionError('Database not connected');

    const startTime = Date.now();
    this.stats.totalQueries++;

    try {
      this.logger.debug('SQLiteAdapter', 'Executing query', { sql, params });
      
      const result = await this.db.all(sql, params);
      const duration = Date.now() - startTime;
      
      this.stats.successfulQueries++;
      this.stats.queryTimes.push(duration);
      
      // Keep only last 100 query times for stats
      if (this.stats.queryTimes.length > 100) {
        this.stats.queryTimes = this.stats.queryTimes.slice(-100);
      }

      this.logger.debug('SQLiteAdapter', 'Query executed successfully', { 
        duration, 
        rowCount: result.length 
      });
      
      return result;
    } catch (error) {
      this.stats.failedQueries++;
      this.logger.error('SQLiteAdapter', 'Query failed', { sql, params, error });
      throw new DatabaseQueryError(`Query failed: ${error}`, { sql, params });
    }
  }

  private async executeRun(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) throw new DatabaseConnectionError('Database not connected');

    const startTime = Date.now();
    this.stats.totalQueries++;

    try {
      this.logger.debug('SQLiteAdapter', 'Executing run query', { sql, params });
      
      const result = await this.db.run(sql, params);
      const duration = Date.now() - startTime;
      
      this.stats.successfulQueries++;
      this.stats.queryTimes.push(duration);

      this.logger.debug('SQLiteAdapter', 'Run query executed successfully', { 
        duration, 
        changes: result.changes,
        lastID: result.lastID
      });
      
      return result;
    } catch (error) {
      this.stats.failedQueries++;
      this.logger.error('SQLiteAdapter', 'Run query failed', { sql, params, error });
      throw new DatabaseQueryError(`Run query failed: ${error}`, { sql, params });
    }
  }

  // Key-value operations
  async get(key: string, namespace: string = 'default'): Promise<any> {
    const result = await this.executeQuery(
      'SELECT value, value_type FROM user_data WHERE namespace = ? AND key = ? AND (expires_at IS NULL OR expires_at > datetime("now"))',
      [namespace, key]
    );

    if (result.length === 0) return null;

    const row = result[0];
    
    // Update access tracking
    await this.executeRun(
      'UPDATE user_data SET last_accessed = datetime("now"), access_count = access_count + 1 WHERE namespace = ? AND key = ?',
      [namespace, key]
    );

    // Parse value based on type
    switch (row.value_type) {
      case 'json':
        return JSON.parse(row.value);
      case 'number':
        return Number(row.value);
      case 'boolean':
        return row.value === 'true';
      default:
        return row.value;
    }
  }

  async set(key: string, value: any, options: SetOptions = {}): Promise<void> {
    const namespace = options.namespace || 'default';
    const valueType = options.type || (typeof value === 'object' ? 'json' : typeof value);
    
    let serializedValue: string;
    switch (valueType) {
      case 'json':
        serializedValue = JSON.stringify(value);
        break;
      case 'boolean':
        serializedValue = value ? 'true' : 'false';
        break;
      default:
        serializedValue = String(value);
    }

    const expiresAt = options.ttl ? 
      `datetime('now', '+${options.ttl} seconds')` : 
      null;

    const sql = `
      INSERT OR REPLACE INTO user_data (namespace, key, value, value_type, expires_at, updated_at)
      VALUES (?, ?, ?, ?, ${expiresAt ? expiresAt : 'NULL'}, datetime('now'))
    `;

    await this.executeRun(sql, [namespace, key, serializedValue, valueType]);
  }

  async delete(key: string, namespace: string = 'default'): Promise<boolean> {
    const result = await this.executeRun(
      'DELETE FROM user_data WHERE namespace = ? AND key = ?',
      [namespace, key]
    );
    
    return result.changes > 0;
  }

  async find(pattern: string, filter: Record<string, any> = {}, namespace: string = 'default'): Promise<any[]> {
    let sql = 'SELECT key, value, value_type FROM user_data WHERE namespace = ?';
    const params: any[] = [namespace];

    // Add pattern matching
    if (pattern !== '*') {
      sql += ' AND key LIKE ?';
      params.push(pattern.replace(/\*/g, '%'));
    }

    // Add filters
    for (const [filterKey, filterValue] of Object.entries(filter)) {
      sql += ` AND json_extract(value, '$.${filterKey}') = ?`;
      params.push(filterValue);
    }

    sql += ' AND (expires_at IS NULL OR expires_at > datetime("now"))';

    const results = await this.executeQuery(sql, params);
    
    return results.map(row => ({
      key: row.key,
      value: row.value_type === 'json' ? JSON.parse(row.value) : row.value
    }));
  }

  // Table operations
  table(name: string): TableOperations {
    this.ensureConnected();
    return new SQLiteTableOperations(this, name);
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    return this.executeQuery(sql, params);
  }

  async createTable(name: string, schema: TableSchema): Promise<void> {
    const columns: string[] = [];
    const indexes: string[] = [];

    for (const [columnName, definition] of Object.entries(schema)) {
      let columnDef = `${columnName} `;
      
      // Map types
      switch (definition.type) {
        case 'integer':
          columnDef += 'INTEGER';
          break;
        case 'string':
          columnDef += 'TEXT';
          break;
        case 'real':
          columnDef += 'REAL';
          break;
        case 'boolean':
          columnDef += 'BOOLEAN';
          break;
        case 'json':
          columnDef += 'JSON';
          break;
        case 'datetime':
          columnDef += 'DATETIME';
          break;
      }

      if (definition.primary) {
        columnDef += ' PRIMARY KEY';
        if (definition.autoIncrement) {
          columnDef += ' AUTOINCREMENT';
        }
      }

      if (definition.required) {
        columnDef += ' NOT NULL';
      }

      if (definition.unique) {
        columnDef += ' UNIQUE';
      }

      if (definition.default !== undefined) {
        columnDef += ` DEFAULT ${definition.default}`;
      }

      if (definition.references) {
        columnDef += ` REFERENCES ${definition.references.table}(${definition.references.column})`;
        if (definition.references.onDelete) {
          columnDef += ` ON DELETE ${definition.references.onDelete}`;
        }
      }

      columns.push(columnDef);

      // Create index if needed
      if (definition.index) {
        indexes.push(`CREATE INDEX idx_${name}_${columnName} ON ${name}(${columnName})`);
      }
    }

    const createTableSQL = `CREATE TABLE ${name} (${columns.join(', ')})`;
    await this.executeRun(createTableSQL);

    // Create indexes
    for (const indexSQL of indexes) {
      await this.executeRun(indexSQL);
    }
  }

  async dropTable(name: string): Promise<void> {
    this.ensureConnected();
    await this.executeRun(`DROP TABLE IF EXISTS ${name}`);
  }

  async transaction(callback: (tx: TransactionContext) => Promise<void>): Promise<void> {
    if (!this.db) throw new DatabaseConnectionError('Database not connected');

    await this.db.exec('BEGIN TRANSACTION');
    
    try {
      const tx: TransactionContext = {
        get: (key: string, namespace?: string) => this.get(key, namespace),
        set: (key: string, value: any, options?: SetOptions) => this.set(key, value, options),
        table: (name: string) => this.table(name),
        query: (sql: string, params?: any[]) => this.query(sql, params)
      };

      await callback(tx);
      await this.db.exec('COMMIT');
    } catch (error) {
      await this.db.exec('ROLLBACK');
      throw error;
    }
  }

  // Internal query methods for table operations
  async _executeQuery(sql: string, params: any[] = []): Promise<any[]> {
    return this.executeQuery(sql, params);
  }

  async _executeRun(sql: string, params: any[] = []): Promise<any> {
    return this.executeRun(sql, params);
  }

  getStats() {
    const avgQueryTime = this.stats.queryTimes.length > 0 
      ? this.stats.queryTimes.reduce((a, b) => a + b, 0) / this.stats.queryTimes.length 
      : 0;

    return {
      totalQueries: this.stats.totalQueries,
      successfulQueries: this.stats.successfulQueries,
      failedQueries: this.stats.failedQueries,
      avgQueryTime,
      uptime: Date.now() - this.stats.startTime
    };
  }

  async describeTable(tableName: string): Promise<TableSchema> {
    this.ensureConnected();
    this.logger.debug('SQLiteAdapter', `Describing table ${tableName}`);
    try {
      const columns: any[] = await this.query(`PRAGMA table_info(${tableName})`);
      if (!columns || columns.length === 0) {
          throw new DatabaseError(`Table ${tableName} not found or has no columns.`, 'NOT_FOUND');
      }
      const schema: TableSchema = {};
      for (const column of columns) {
          schema[column.name] = {
              type: this.mapSQLiteType(column.type),
              primary: column.pk === 1,
              required: column.notnull === 1,
              default: column.dflt_value,
              // Note: PRAGMA table_info doesn't directly give unique or index info easily.
              // More complex parsing of PRAGMA index_list and PRAGMA index_info would be needed for those.
              // Foreign key info would require PRAGMA foreign_key_list.
              // For simplicity, we're only mapping what table_info directly provides.
          };
      }
      return schema;
    } catch (error: any) {
        this.logger.error('SQLiteAdapter', `Failed to describe table ${tableName}`, { message: error.message, stack: error.stack });
        if (error instanceof DatabaseError) throw error;
        throw new DatabaseError(`Failed to describe table ${tableName}: ${error.message}`, 'QUERY_ERROR', error);
    }
  }

  private ensureConnected(): void {
    if (!this.db) throw new DatabaseConnectionError('Database not connected');
  }

  private mapSQLiteType(type: string): 'integer' | 'string' | 'real' | 'boolean' | 'json' | 'datetime' {
    switch (type.toUpperCase()) {
      case 'INTEGER':
      case 'INT':
        return 'integer';
      case 'TEXT':
      case 'VARCHAR':
      case 'CHAR':
      case 'CLOB':
        return 'string';
      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
        return 'real';
      case 'BOOLEAN':
      case 'BOOL':
        return 'boolean';
      case 'JSON':
        return 'json';
      case 'DATETIME':
      case 'DATE':
      case 'TIMESTAMP':
        return 'datetime';
      default:
        this.logger.warn('SQLiteAdapter', `Unknown SQLite type encountered in mapSQLiteType: '${type}'. Defaulting to string or consider mapping it.`);
        return 'string';
    }
  }
}

class SQLiteTableOperations implements TableOperations, TableQuery {
  private conditions: WhereCondition[] = [];
  private orderRules: OrderRule[] = [];
  private joinClauses: JoinClause[] = [];
  private selectFields: string[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private groupByField?: string;
  private havingConditions: Record<string, any> = {};

  constructor(
    private adapter: SQLiteAdapter,
    private tableName: string
  ) {}

  // Fluent query building
  where(conditions: Record<string, any>): TableQuery {
    for (const [field, value] of Object.entries(conditions)) {
      this.conditions.push({
        field,
        operator: '=',
        value,
        connector: 'AND'
      });
    }
    return this;
  }

  whereIn(field: string, values: any[]): TableQuery {
    this.conditions.push({
      field,
      operator: 'IN',
      value: values,
      connector: 'AND'
    });
    return this;
  }

  whereGte(field: string, value: any): TableQuery {
    this.conditions.push({
      field,
      operator: '>=',
      value,
      connector: 'AND'
    });
    return this;
  }

  whereLte(field: string, value: any): TableQuery {
    this.conditions.push({
      field,
      operator: '<=',
      value,
      connector: 'AND'
    });
    return this;
  }

  whereLike(field: string, pattern: string): TableQuery {
    this.conditions.push({
      field,
      operator: 'LIKE',
      value: pattern,
      connector: 'AND'
    });
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): TableQuery {
    this.orderRules.push({
      field,
      direction: direction.toUpperCase() as 'ASC' | 'DESC'
    });
    return this;
  }

  limit(count: number): TableQuery {
    this.limitValue = count;
    return this;
  }

  offset(count: number): TableQuery {
    this.offsetValue = count;
    return this;
  }

  join(table: string, leftField: string, rightField: string): TableQuery {
    this.joinClauses.push({
      type: 'INNER',
      table,
      leftField,
      rightField
    });
    return this;
  }

  select(fields: string[]): TableQuery {
    this.selectFields = fields;
    return this;
  }

  groupBy(field: string): TableQuery {
    this.groupByField = field;
    return this;
  }

  having(conditions: Record<string, any>): TableQuery {
    this.havingConditions = { ...this.havingConditions, ...conditions };
    return this;
  }

  // Query execution
  async find(): Promise<any[]> {
    const { sql, params } = this.buildSelectQuery();
    return this.adapter._executeQuery(sql, params);
  }

  async findOne(): Promise<any | null> {
    this.limitValue = 1;
    const results = await this.find();
    return results.length > 0 ? results[0] : null;
  }

  async count(): Promise<number> {
    const { sql, params } = this.buildSelectQuery('COUNT(*) as count');
    const result = await this.adapter._executeQuery(sql, params);
    return result[0]?.count || 0;
  }

  async exists(where: Record<string, any>): Promise<boolean> {
    const query = new SQLiteTableOperations(this.adapter, this.tableName).where(where);
    const count = await query.count();
    return count > 0;
  }

  async delete(): Promise<DeleteResult> {
    const { sql, params } = this.buildDeleteQuery();
    const result = await this.adapter._executeRun(sql, params);
    return {
      rowsDeleted: result.changes,
      success: result.changes > 0
    };
  }

  // Direct operations
  async insert(data: Record<string, any>): Promise<InsertResult> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(', ');

    const sql = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
    const result = await this.adapter._executeRun(sql, values);

    return {
      id: result.lastID,
      rowsAffected: result.changes,
      success: result.changes > 0
    };
  }

  async insertMany(data: Record<string, any>[]): Promise<InsertResult[]> {
    const results: InsertResult[] = [];
    
    for (const item of data) {
      const result = await this.insert(item);
      results.push(result);
    }

    return results;
  }

  async update(where: Record<string, any>, data: Record<string, any>): Promise<UpdateResult> {
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${whereClause}`;
    const params = [...Object.values(data), ...Object.values(where)];
    
    const result = await this.adapter._executeRun(sql, params);

    return {
      rowsAffected: result.changes,
      success: result.changes > 0
    };
  }

  async aggregate(operations: AggregateOperations): Promise<Record<string, any>> {
    const selectParts: string[] = [];
    
    for (const [alias, operation] of Object.entries(operations)) {
      if (operation.includes(':')) {
        const [func, field] = operation.split(':');
        selectParts.push(`${func.toUpperCase()}(${field}) as ${alias}`);
      } else {
        selectParts.push(`${operation.toUpperCase()}(*) as ${alias}`);
      }
    }

    const { sql, params } = this.buildSelectQuery(selectParts.join(', '));
    const result = await this.adapter._executeQuery(sql, params);
    
    return result[0] || {};
  }

  private buildSelectQuery(selectClause?: string): { sql: string; params: any[] } {
    const params: any[] = [];
    let sql = `SELECT ${selectClause || (this.selectFields.length > 0 ? this.selectFields.join(', ') : '*')} FROM ${this.tableName}`;

    // Add joins
    for (const join of this.joinClauses) {
      sql += ` ${join.type} JOIN ${join.table} ON ${join.leftField} = ${join.rightField}`;
    }

    // Add where conditions
    if (this.conditions.length > 0) {
      sql += ' WHERE ';
      const whereParts: string[] = [];

      for (const condition of this.conditions) {
        let conditionSQL = `${condition.field} ${condition.operator}`;
        
        if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
          const placeholders = condition.value.map(() => '?').join(', ');
          conditionSQL += ` (${placeholders})`;
          params.push(...condition.value);
        } else {
          conditionSQL += ' ?';
          params.push(condition.value);
        }

        whereParts.push(conditionSQL);
      }

      sql += whereParts.join(' AND ');
    }

    // Add group by
    if (this.groupByField) {
      sql += ` GROUP BY ${this.groupByField}`;
    }

    // Add having
    if (Object.keys(this.havingConditions).length > 0) {
      const havingParts = Object.entries(this.havingConditions)
        .map(([key, value]) => {
          params.push(value);
          return `${key} = ?`;
        });
      sql += ` HAVING ${havingParts.join(' AND ')}`;
    }

    // Add order by
    if (this.orderRules.length > 0) {
      const orderParts = this.orderRules.map(rule => `${rule.field} ${rule.direction}`);
      sql += ` ORDER BY ${orderParts.join(', ')}`;
    }

    // Add limit and offset
    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return { sql, params };
  }

  private buildDeleteQuery(): { sql: string; params: any[] } {
    const params: any[] = [];
    let sql = `DELETE FROM ${this.tableName}`;

    if (this.conditions.length > 0) {
      sql += ' WHERE ';
      const whereParts: string[] = [];

      for (const condition of this.conditions) {
        let conditionSQL = `${condition.field} ${condition.operator}`;
        
        if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
          const placeholders = condition.value.map(() => '?').join(', ');
          conditionSQL += ` (${placeholders})`;
          params.push(...condition.value);
        } else {
          conditionSQL += ' ?';
          params.push(condition.value);
        }

        whereParts.push(conditionSQL);
      }

      sql += whereParts.join(' AND ');
    }

    return { sql, params };
  }
} 