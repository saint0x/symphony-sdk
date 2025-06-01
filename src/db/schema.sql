-- Symphony Database Schema
-- Comprehensive persistence for AI orchestration platform
-- SQLite-optimized with JSON support and proper indexing

-- Enable foreign key support and WAL mode for better concurrency
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- ================================================================
-- XML COMMAND MAPS & PATTERNS (Cache Intelligence Core)
-- ================================================================

-- Pattern Groups (file_operations, code_editing, etc.)
CREATE TABLE pattern_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- XML Patterns (core cache intelligence)
CREATE TABLE xml_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_id TEXT NOT NULL UNIQUE,           -- FILE_SEARCH, EDIT_FILE, etc.
    group_id INTEGER NOT NULL,
    pattern_name TEXT NOT NULL,
    confidence_score REAL NOT NULL DEFAULT 0.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    
    -- Linguistic components
    trigger_text TEXT NOT NULL,               -- "search for * in *"
    variables JSON,                           -- Variable definitions and types
    examples JSON,                            -- Usage examples
    
    -- Tool mapping
    tool_name TEXT NOT NULL,                  -- Target tool name
    tool_parameters JSON,                     -- Parameter mapping template
    
    -- Learning metrics
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_used DATETIME,
    average_latency_ms INTEGER DEFAULT 0,
    
    -- Metadata
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (group_id) REFERENCES pattern_groups(id) ON DELETE CASCADE
);

-- NLP Patterns (Managed by NlpService, for user-defined and seeded patterns)
CREATE TABLE IF NOT EXISTS nlp_patterns (
    id TEXT PRIMARY KEY,
    tool_name TEXT NOT NULL,
    nlp_pattern TEXT NOT NULL,
    version TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pattern usage history (for learning optimization)
CREATE TABLE pattern_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_id INTEGER NOT NULL,
    execution_id TEXT NOT NULL,               -- Unique execution identifier
    
    -- Execution details
    input_text TEXT NOT NULL,                 -- Original user input
    extracted_variables JSON,                 -- Variables extracted from input
    tool_result JSON,                         -- Tool execution result
    
    -- Performance metrics
    success BOOLEAN NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    confidence_before REAL,
    confidence_after REAL,
    
    -- Context
    session_id TEXT,
    user_context JSON,                        -- Additional context data
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pattern_id) REFERENCES xml_patterns(id) ON DELETE CASCADE
);

-- ================================================================
-- CONTEXT TREES (Session & Cross-Session Intelligence)
-- ================================================================

-- Context tree sessions
CREATE TABLE context_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    session_type TEXT NOT NULL DEFAULT 'user',  -- user, system, learning
    
    -- Session metadata
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    active BOOLEAN DEFAULT TRUE,
    
    -- Context data
    context_data JSON,                        -- Full context tree JSON
    parent_session_id TEXT,                   -- For session chaining
    
    -- Metrics
    tool_calls INTEGER DEFAULT 0,
    pattern_matches INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0.0
);

-- Agent state tracking
CREATE TABLE agent_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    
    -- Tool health tracking
    active_tools JSON,                        -- Current tool registry state
    tool_health JSON,                         -- Success rates, latencies
    
    -- Runtime state
    current_task TEXT,
    execution_queue JSON,                     -- Pending executions
    memory_usage_mb INTEGER DEFAULT 0,
    
    -- Performance
    avg_response_time_ms INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0.0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES context_sessions(session_id) ON DELETE CASCADE
);

-- Learning configuration and evolution
CREATE TABLE learning_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_type TEXT NOT NULL,               -- pattern_evolution, type_inference, etc.
    config_data JSON NOT NULL,               -- Configuration parameters
    
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================
-- EXECUTION HISTORY & ANALYTICS
-- ================================================================

-- Tool execution tracking (comprehensive analytics)
CREATE TABLE tool_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL UNIQUE,
    
    -- Tool details
    tool_name TEXT NOT NULL,
    tool_version TEXT,
    
    -- Execution context
    session_id TEXT,
    pattern_id INTEGER,                       -- NULL if no pattern match
    agent_id TEXT,
    
    -- Input/Output
    input_parameters JSON,
    output_result JSON,
    error_details TEXT,
    
    -- Performance
    success BOOLEAN NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    memory_used_mb INTEGER DEFAULT 0,
    cpu_time_ms INTEGER DEFAULT 0,
    
    -- Learning data
    confidence_score REAL,
    user_feedback INTEGER,                    -- -1, 0, 1 for negative, neutral, positive
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pattern_id) REFERENCES xml_patterns(id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES context_sessions(session_id) ON DELETE SET NULL
);

-- Chain execution tracking
CREATE TABLE chain_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL UNIQUE,
    chain_name TEXT NOT NULL,
    
    -- Chain structure
    steps_total INTEGER NOT NULL,
    steps_completed INTEGER DEFAULT 0,
    current_step TEXT,
    
    -- Chain data
    input_data JSON,
    output_data JSON,
    step_results JSON,                        -- Results from each step
    
    -- Performance
    success BOOLEAN,
    total_duration_ms INTEGER,
    parallel_efficiency REAL,                -- Parallelization effectiveness
    
    -- Context
    session_id TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    
    FOREIGN KEY (session_id) REFERENCES context_sessions(session_id) ON DELETE SET NULL
);

-- Team coordination tracking
CREATE TABLE team_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL UNIQUE,
    team_name TEXT NOT NULL,
    strategy TEXT NOT NULL,                   -- parallel, sequential, pipeline, etc.
    
    -- Team composition
    agents JSON NOT NULL,                     -- Agent configurations
    coordination_data JSON,                   -- Strategy-specific data
    
    -- Results
    task_description TEXT,
    result_data JSON,
    success BOOLEAN,
    duration_ms INTEGER,
    
    -- Context
    session_id TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES context_sessions(session_id) ON DELETE SET NULL
);

-- Pipeline execution tracking  
CREATE TABLE pipeline_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL UNIQUE,
    pipeline_name TEXT NOT NULL,
    
    -- Pipeline definition
    pipeline_definition JSON NOT NULL,        -- Full pipeline config
    steps_total INTEGER NOT NULL,
    
    -- Execution state
    current_step INTEGER DEFAULT 0,
    steps_completed INTEGER DEFAULT 0,
    step_results JSON,                        -- Results from each step
    
    -- Performance
    success BOOLEAN,
    total_duration_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    
    -- Context
    session_id TEXT,
    input_data JSON,
    output_data JSON,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    
    FOREIGN KEY (session_id) REFERENCES context_sessions(session_id) ON DELETE SET NULL
);

-- ================================================================
-- USER DATA STORAGE (Flexible Schema)
-- ================================================================

-- Key-value storage for user applications
CREATE TABLE user_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    namespace TEXT NOT NULL DEFAULT 'default', -- Allow data separation
    key TEXT NOT NULL,
    value JSON,                                -- Flexible JSON storage
    value_type TEXT DEFAULT 'json',           -- json, string, number, boolean
    
    -- Metadata
    expires_at DATETIME,                       -- Optional TTL
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Access tracking
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    
    UNIQUE(namespace, key)
);

-- User-defined tables (dynamic schema)
CREATE TABLE user_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL UNIQUE,
    schema_definition JSON NOT NULL,          -- Column definitions
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Flexible table data storage
CREATE TABLE user_table_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    row_data JSON NOT NULL,                   -- Flexible row storage
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (table_name) REFERENCES user_tables(table_name) ON DELETE CASCADE
);

-- ================================================================
-- ANALYTICS & PERFORMANCE TRACKING
-- ================================================================

-- System performance metrics
CREATE TABLE performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type TEXT NOT NULL,               -- tool_performance, pattern_success, etc.
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    
    -- Aggregation info
    time_period TEXT NOT NULL,               -- hour, day, week, month
    aggregation_type TEXT NOT NULL,          -- avg, sum, count, max, min
    
    -- Dimensions
    dimensions JSON,                          -- Additional grouping data
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Learning analytics
CREATE TABLE learning_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type TEXT NOT NULL,               -- confidence_evolution, pattern_accuracy
    entity_type TEXT NOT NULL,               -- pattern, tool, agent, session
    entity_id TEXT NOT NULL,
    
    -- Metric data
    metric_data JSON NOT NULL,
    improvement_delta REAL,                  -- Change from previous measurement
    confidence_level REAL,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================

-- XML Patterns
CREATE INDEX idx_patterns_confidence ON xml_patterns(confidence_score DESC);
CREATE INDEX idx_patterns_tool ON xml_patterns(tool_name);
CREATE INDEX idx_patterns_last_used ON xml_patterns(last_used DESC);
CREATE INDEX idx_patterns_active ON xml_patterns(active) WHERE active = TRUE;

-- Pattern Executions
CREATE INDEX idx_pattern_exec_pattern ON pattern_executions(pattern_id);
CREATE INDEX idx_pattern_exec_session ON pattern_executions(session_id);
CREATE INDEX idx_pattern_exec_success ON pattern_executions(success);
CREATE INDEX idx_pattern_exec_time ON pattern_executions(created_at DESC);

-- Context Sessions
CREATE INDEX idx_sessions_active ON context_sessions(active) WHERE active = TRUE;
CREATE INDEX idx_sessions_type ON context_sessions(session_type);
CREATE INDEX idx_sessions_activity ON context_sessions(last_activity DESC);

-- Tool Executions
CREATE INDEX idx_tool_exec_tool ON tool_executions(tool_name);
CREATE INDEX idx_tool_exec_session ON tool_executions(session_id);
CREATE INDEX idx_tool_exec_success ON tool_executions(success);
CREATE INDEX idx_tool_exec_time ON tool_executions(created_at DESC);
CREATE INDEX idx_tool_exec_performance ON tool_executions(execution_time_ms);

-- User Data
CREATE INDEX idx_user_data_namespace ON user_data(namespace);
CREATE INDEX idx_user_data_expires ON user_data(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_user_data_accessed ON user_data(last_accessed DESC);

-- Performance Metrics
CREATE INDEX idx_perf_metrics_type_time ON performance_metrics(metric_type, time_period, created_at DESC);

-- NLP Patterns
CREATE INDEX IF NOT EXISTS idx_nlp_patterns_tool_name ON nlp_patterns(tool_name);
CREATE INDEX IF NOT EXISTS idx_nlp_patterns_is_active ON nlp_patterns(is_active);

-- ================================================================
-- INITIAL DATA SETUP
-- ================================================================

-- Default pattern groups
INSERT INTO pattern_groups (type, description) VALUES 
    ('file_operations', 'File system operations and searches'),
    ('code_editing', 'Code modification and editing operations'),
    ('search_operations', 'Text and pattern search operations'),
    ('terminal_operations', 'Command execution and system operations'),
    ('web_operations', 'Web search and API operations'),
    ('analysis_operations', 'Data analysis and reasoning operations');

-- Default learning configuration
INSERT INTO learning_config (config_type, config_data) VALUES 
    ('pattern_evolution', '{"threshold": 0.8, "min_samples": 10, "learning_rate": 0.05, "decay_rate": 0.01}'),
    ('type_inference', '{"confidence_threshold": 0.9, "sample_size": 50, "update_frequency": "1h"}'),
    ('performance_optimization', '{"cache_ttl": "1h", "prune_threshold": 0.7, "max_patterns": 100, "min_confidence": 0.85}');

-- ================================================================
-- VIEWS FOR COMMON QUERIES
-- ================================================================

-- Pattern performance view
CREATE VIEW pattern_performance AS
SELECT 
    p.pattern_id,
    p.pattern_name,
    p.confidence_score,
    p.success_count,
    p.failure_count,
    CASE 
        WHEN (p.success_count + p.failure_count) > 0 
        THEN CAST(p.success_count AS REAL) / (p.success_count + p.failure_count)
        ELSE 0.0 
    END as success_rate,
    p.average_latency_ms,
    p.last_used,
    pg.type as group_type
FROM xml_patterns p
JOIN pattern_groups pg ON p.group_id = pg.id
WHERE p.active = TRUE;

-- Tool analytics view
CREATE VIEW tool_analytics AS
SELECT 
    tool_name,
    COUNT(*) as total_executions,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_executions,
    CAST(SUM(CASE WHEN success THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as success_rate,
    AVG(execution_time_ms) as avg_execution_time,
    MIN(execution_time_ms) as min_execution_time,
    MAX(execution_time_ms) as max_execution_time,
    COUNT(DISTINCT session_id) as unique_sessions
FROM tool_executions
GROUP BY tool_name;

-- Session analytics view  
CREATE VIEW session_analytics AS
SELECT 
    session_id,
    session_type,
    tool_calls,
    pattern_matches,
    cache_hits,
    success_rate,
    started_at,
    last_activity,
    CASE 
        WHEN ended_at IS NOT NULL 
        THEN (julianday(ended_at) - julianday(started_at)) * 24 * 60 * 60 
        ELSE (julianday('now') - julianday(started_at)) * 24 * 60 * 60
    END as duration_seconds
FROM context_sessions; 