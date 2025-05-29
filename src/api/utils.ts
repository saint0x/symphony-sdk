/**
 * Symphony SDK Cache, Memory & Database API Definitions
 * 
 * This file contains the complete public API definitions for Symphony's intelligent
 * caching system, memory management, and database operations.
 */

// ===== CACHE INTELLIGENCE API =====

export interface ICacheService {
  // Legacy cache interface for backward compatibility
  get(key: string, namespace?: string): Promise<any>;
  set(key: string, value: any, ttl?: number, namespace?: string): Promise<void>;
  delete(key: string, namespace?: string): Promise<void>;
  has(key: string, namespace?: string): Promise<boolean>;
  clear(namespace?: string): Promise<void>;
  
  // Cache intelligence interface
  getIntelligence(userInput: string, options?: IntelligenceOptions): Promise<IntelligenceResult>;
  recordToolExecution(
    sessionId: string,
    toolName: string,
    parameters: Record<string, any>,
    result: any,
    success: boolean,
    executionTime: number,
    patternId?: string
  ): Promise<void>;
  
  // Analytics and monitoring
  getPatternAnalytics(): Promise<PatternAnalytics>;
  getContextAnalytics(): Promise<ContextAnalytics>;
  getGlobalStats(): GlobalCacheStats;
  getSessionIntelligence(sessionId: string): SessionIntelligence | undefined;
  
  // Utility methods
  clearCaches(): void;
  healthCheck(): Promise<CacheHealthStatus>;
  initialize(options?: IntelligenceOptions): Promise<void>;
}

export interface IntelligenceOptions {
  enablePatternMatching?: boolean;
  enableContextTrees?: boolean;
  fastPathThreshold?: number;
  contextMaxNodes?: number;
  xmlPatternPath?: string;
  contextTemplatePath?: string;
  sessionId?: string;
  namespace?: string;
}

export interface IntelligenceResult {
  recommendation: 'fast_path' | 'standard_path' | 'enhanced_context' | 'no_match';
  confidence: number;
  patternMatch?: XMLPatternMatch;
  contextTree?: ContextTreeNode;
  systemPromptEnhancement?: string;
  metadata: {
    processingTime: number;
    patternsEvaluated: number;
    contextNodesBuilt: number;
    cacheHits: number;
    suggestions: string[];
  };
}

export interface XMLPatternMatch {
  id: string;
  name: string;
  confidence: number;
  toolCall: {
    tool: string;
    parameters: Record<string, any>;
  };
  variableExtraction: Record<string, any>;
  reasoning: string;
}

export interface ContextTreeNode {
  id: string;
  type: 'tool' | 'workflow' | 'team' | 'task' | 'environment' | 'user_data';
  name: string;
  data: any;
  priority: number;
  timestamp: number;
  children?: ContextTreeNode[];
  metadata?: Record<string, any>;
}

export interface PatternAnalytics {
  totalPatterns: number;
  averageConfidence: number;
  topPatterns: Array<{
    id: string;
    name: string;
    confidence: number;
    executionCount: number;
    successRate: number;
    averageExecutionTime: number;
  }>;
  confidenceDistribution: Record<string, number>;
  categoryBreakdown: Record<string, number>;
}

export interface ContextAnalytics {
  cacheStats: {
    size: number;
    maxSize: number;
    hitRate: number;
    averageNodeDepth: number;
  };
  treeMetrics: {
    averageNodes: number;
    averageDepth: number;
    nodeTypes: Record<string, number>;
  };
  temporalAnalysis: {
    freshData: number;
    staleData: number;
    averageAge: number;
  };
}

export interface GlobalCacheStats {
  totalQueries: number;
  fastPathQueries: number;
  standardPathQueries: number;
  enhancedContextQueries: number;
  noMatchQueries: number;
  sessions: number;
  averageResponseTime: number;
  cacheHitRate: number;
  patternMatchRate: number;
  contextTreeUtilization: number;
}

export interface SessionIntelligence {
  sessionId: string;
  queriesProcessed: number;
  patternsMatched: number;
  contextTreesBuilt: number;
  averageConfidence: number;
  toolExecutions: Array<{
    toolName: string;
    timestamp: number;
    success: boolean;
    executionTime: number;
    patternId?: string;
  }>;
  insights: {
    preferredTools: string[];
    workflowPatterns: string[];
    efficiencyScore: number;
  };
}

export interface CacheHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    initialized: boolean;
    patternMatching: boolean;
    contextTrees: boolean;
    database: boolean;
  };
  performance: {
    averageResponseTime: number;
    memoryUsage: number;
    cacheSize: number;
    errorRate: number;
  };
  recommendations?: string[];
}

// XML Pattern definitions
export interface XMLPattern {
  id: string;
  name: string;
  group: string;
  confidence: number;
  pattern: string;
  description: string;
  toolCall: {
    tool: string;
    parameters: Record<string, string>;
  };
  variables: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array';
    required: boolean;
    description?: string;
  }>;
  examples: string[];
  metadata?: Record<string, any>;
}

export interface PatternExecution {
  id: string;
  patternId: string;
  sessionId: string;
  userInput: string;
  extractedVariables: Record<string, any>;
  toolCall: {
    tool: string;
    parameters: Record<string, any>;
  };
  result: any;
  success: boolean;
  executionTime: number;
  confidence: number;
  timestamp: number;
}

export interface SessionContext {
  sessionId: string;
  contextData: Record<string, any>;
  toolExecutions: Array<{
    toolName: string;
    parameters: Record<string, any>;
    result: any;
    timestamp: number;
  }>;
  createdAt: number;
  updatedAt: number;
}

// ===== MEMORY SYSTEM API =====

export interface IMemoryService {
  // Core memory operations
  store(
    key: string, 
    value: any, 
    type?: 'short_term' | 'long_term',
    options?: MemoryStoreOptions
  ): Promise<void>;
  
  retrieve(
    key: string, 
    type?: 'short_term' | 'long_term',
    options?: MemoryRetrieveOptions
  ): Promise<any>;
  
  search(query: MemoryQuery): Promise<MemoryEntry[]>;
  delete(key: string, type?: 'short_term' | 'long_term', namespace?: string): Promise<boolean>;
  clear(type?: 'short_term' | 'long_term', namespace?: string): Promise<number>;
  
  // Advanced memory operations
  aggregate(query: MemoryQuery): Promise<AggregationResult>;
  getStats(): Promise<MemoryStats>;
  getOperationalStats(): OperationalStats;
  
  // Utility methods
  healthCheck(): Promise<MemoryHealthStatus>;
  initialize(config?: MemoryConfig): Promise<void>;
  
  // Legacy compatibility
  createMemoryInstance(sessionId?: string, namespace?: string): Memory;
}

export interface MemoryStoreOptions {
  sessionId?: string;
  namespace?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  customTTL?: number;
  priority?: number;
}

export interface MemoryRetrieveOptions {
  namespace?: string;
  includeMetadata?: boolean;
  sessionId?: string;
}

export interface MemoryQuery {
  type?: 'short_term' | 'long_term';
  namespace?: string;
  sessionId?: string;
  tags?: string[];
  textSearch?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'priority' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  metadata?: Record<string, any>;
}

export interface MemoryEntry {
  key: string;
  value: any;
  type: 'short_term' | 'long_term';
  namespace?: string;
  sessionId?: string;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  priority: number;
  size: number;
}

export interface AggregationResult {
  totalEntries: number;
  totalSize: number;
  patterns: Array<{
    pattern: string;
    frequency: number;
    examples: string[];
    insights: string[];
  }>;
  insights: {
    summary: string;
    topPatterns: string[];
    recommendations: string[];
    temporalTrends: string[];
  };
  metadata: {
    processingTime: number;
    aggregationMethod: string;
    confidence: number;
  };
}

export interface MemoryStats {
  shortTerm: {
    totalEntries: number;
    totalSize: number;
    averageSize: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  };
  longTerm: {
    totalEntries: number;
    totalSize: number;
    averageSize: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  };
  namespaces: Record<string, {
    entryCount: number;
    totalSize: number;
  }>;
  sessions: Record<string, {
    entryCount: number;
    totalSize: number;
    lastActivity: Date;
  }>;
  tags: Record<string, number>;
  performance: {
    averageStoreTime: number;
    averageRetrieveTime: number;
    cacheHitRate: number;
  };
}

export interface OperationalStats {
  uptime: number;
  totalOperations: number;
  operationsByType: Record<string, number>;
  averageResponseTime: number;
  memoryUsage: number;
  healthStatus: 'healthy' | 'degraded' | 'critical';
  lastCleanup: Date;
  cleanupStats: {
    entriesRemoved: number;
    spaceReclaimed: number;
  };
}

export interface MemoryHealthStatus {
  status: 'healthy' | 'degraded' | 'critical';
  services: {
    database: boolean;
    shortTermMemory: boolean;
    longTermMemory: boolean;
    search: boolean;
    aggregation: boolean;
  };
  performance: {
    responseTime: number;
    memoryUsage: number;
    diskUsage: number;
    errorRate: number;
  };
  issues?: string[];
  recommendations?: string[];
}

export interface MemoryConfig {
  shortTerm?: {
    defaultTTL?: number; // milliseconds
    maxSize?: number; // bytes
    cleanupInterval?: number; // milliseconds
  };
  longTerm?: {
    defaultTTL?: number; // milliseconds
    maxSize?: number; // bytes
    cleanupInterval?: number; // milliseconds
  };
  database?: {
    path?: string;
    adapter?: 'sqlite' | 'postgres' | 'mysql';
    connectionString?: string;
  };
  search?: {
    indexing?: boolean;
    fuzzyMatching?: boolean;
    minQueryLength?: number;
  };
}

// Legacy Memory Interface
export interface Memory {
  store(key: string, value: any, type?: 'short_term' | 'long_term' | 'episodic'): Promise<void>;
  retrieve(key: string, type?: 'short_term' | 'long_term' | 'episodic'): Promise<any>;
  search(query: string, type?: 'short_term' | 'long_term' | 'episodic'): Promise<any[]>;
  delete(key: string, type?: 'short_term' | 'long_term' | 'episodic'): Promise<boolean>;
  clear(type?: 'short_term' | 'long_term' | 'episodic'): Promise<void>;
  getStats(): any;
}

// ===== DATABASE API =====

export interface IDatabaseService {
  // Core database operations
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<DatabaseHealthStatus>;
  
  // Cache intelligence database operations
  storeXMLPattern(pattern: XMLPattern): Promise<void>;
  getXMLPatterns(): Promise<XMLPattern[]>;
  updatePatternConfidence(patternId: string, newConfidence: number): Promise<void>;
  recordPatternExecution(execution: PatternExecution): Promise<void>;
  getPatternExecutions(patternId: string, limit?: number): Promise<PatternExecution[]>;
  
  storeSessionContext(context: SessionContext): Promise<void>;
  getSessionContext(sessionId: string): Promise<SessionContext | null>;
  updateSessionContext(sessionId: string, updates: Partial<SessionContext>): Promise<void>;
  
  // Memory system database operations
  storeMemoryEntry(entry: MemoryEntry): Promise<void>;
  getMemoryEntry(key: string, type: 'short_term' | 'long_term', namespace?: string): Promise<MemoryEntry | null>;
  searchMemoryEntries(query: MemoryQuery): Promise<MemoryEntry[]>;
  deleteMemoryEntry(key: string, type: 'short_term' | 'long_term', namespace?: string): Promise<boolean>;
  cleanupExpiredMemoryEntries(): Promise<number>;
  getMemoryStats(): Promise<MemoryStats>;
  
  // Tool execution logging
  recordToolExecution(
    sessionId: string,
    toolName: string,
    parameters: Record<string, any>,
    result: any,
    success: boolean,
    executionTime: number,
    metadata?: Record<string, any>
  ): Promise<void>;
  
  getToolExecutions(
    sessionId?: string,
    toolName?: string,
    limit?: number,
    offset?: number
  ): Promise<ToolExecutionRecord[]>;
  
  // Generic database operations
  query(sql: string, params?: any[]): Promise<any[]>;
  execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number }>;
  transaction(operations: Array<{ sql: string; params?: any[] }>): Promise<any[]>;
  
  // Schema management
  createTables(): Promise<void>;
  dropTables(): Promise<void>;
  migrate(version: string): Promise<void>;
  getVersion(): Promise<string>;
  
  // Performance and monitoring
  getStats(): Promise<DatabaseStats>;
  optimize(): Promise<void>;
  backup(path?: string): Promise<string>;
  restore(path: string): Promise<void>;
}

export interface DatabaseHealthStatus {
  status: 'healthy' | 'degraded' | 'critical';
  connection: boolean;
  schema: boolean;
  performance: {
    averageQueryTime: number;
    connectionCount: number;
    databaseSize: number;
    errorRate: number;
  };
  issues?: string[];
  recommendations?: string[];
}

export interface ToolExecutionRecord {
  id: string;
  sessionId: string;
  toolName: string;
  parameters: Record<string, any>;
  result: any;
  success: boolean;
  executionTime: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface DatabaseStats {
  tables: Record<string, {
    rowCount: number;
    sizeBytes: number;
    lastModified: Date;
  }>;
  performance: {
    totalQueries: number;
    averageQueryTime: number;
    slowQueries: number;
    errorCount: number;
  };
  storage: {
    totalSize: number;
    indexSize: number;
    dataSize: number;
    freeSpace: number;
  };
  connections: {
    active: number;
    peak: number;
    total: number;
  };
}

export interface DatabaseConfig {
  adapter: 'sqlite' | 'postgres' | 'mysql';
  path?: string; // For SQLite
  connectionString?: string; // For Postgres/MySQL
  pool?: {
    min?: number;
    max?: number;
    acquireTimeout?: number;
    createTimeout?: number;
    destroyTimeout?: number;
    idleTimeout?: number;
    reapInterval?: number;
  };
  migration?: {
    directory?: string;
    autoMigrate?: boolean;
  };
  logging?: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    logQueries?: boolean;
    slowQueryThreshold?: number;
  };
}

// ===== SHARED TYPES =====

export interface CacheIntelligenceConfig {
  xmlPatternPath?: string;
  contextTemplatePath?: string;
  enablePatternMatching?: boolean;
  enableContextTrees?: boolean;
  fastPathThreshold?: number;
  contextMaxNodes?: number;
  cacheTTL?: number;
  maxCacheSize?: number;
}

export interface IntelligenceServiceHealth {
  patternMatching: {
    enabled: boolean;
    patternsLoaded: number;
    averageMatchTime: number;
    errorRate: number;
  };
  contextTrees: {
    enabled: boolean;
    cacheSize: number;
    hitRate: number;
    averageBuildTime: number;
  };
  database: {
    connected: boolean;
    responseTime: number;
    errorRate: number;
  };
  overall: 'healthy' | 'degraded' | 'critical';
} 