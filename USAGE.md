# Symphony SDK Usage Guide

This guide provides comprehensive documentation for using the Symphony SDK with accurate examples based on the actual implementation.

## Table of Contents

- [Installation & Setup](#installation--setup)
- [Core Concepts](#core-concepts)
- [Symphony Initialization](#symphony-initialization)
- [Tools](#tools)
- [Agents](#agents)
- [Teams](#teams)
- [Pipelines](#pipelines)
- [Cache Intelligence](#cache-intelligence)
- [Memory System](#memory-system)
  - [Streaming](#streaming)
- [Advanced Features](#advanced-features)

## Installation & Setup

```bash
npm install symphony-sdk
```

```typescript
import { Symphony } from 'symphony-sdk';

const symphony = new Symphony({
  llm: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY
  },
  db: {
    enabled: true,
    adapter: 'sqlite',
    path: './symphonic.db'
  }
});

await symphony.initialize();
```

## Core Concepts

Symphony is built around four core orchestration layers:

1. **Tools**: Individual functions that perform specific tasks
2. **Agents**: Intelligent entities that use tools with LLM reasoning
3. **Teams**: Groups of agents that collaborate using coordination strategies
4. **Pipelines**: Structured workflows with advanced error recovery and monitoring

Additional systems:
- **Cache Intelligence**: XML pattern matching and context trees for optimization
- **Memory System**: Short/long-term memory with search and aggregation
- **Streaming**: Real-time progress updates for long-running operations

## Symphony Initialization

### Basic Configuration

```typescript
const symphony = new Symphony({
  llm: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
    maxTokens: 2000
  },
  db: {
    enabled: true,
    adapter: 'sqlite',
    path: './symphonic.db'
  },
  logLevel: 'info'
});
```

### Advanced Configuration

```typescript
const symphony = new Symphony({
  llm: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY
  },
  db: {
    enabled: true,
    adapter: 'sqlite',
    path: './symphonic.db'
  },
  cache: {
    enablePatternMatching: true,
    enableContextTrees: true,
    fastPathThreshold: 0.85,
    contextMaxNodes: 50
  },
  memory: {
    shortTerm: {
      defaultTTL: 3600000, // 1 hour
      maxSize: 100 * 1024 * 1024 // 100MB
    },
    longTerm: {
      defaultTTL: 30 * 24 * 3600000, // 30 days
      maxSize: 1024 * 1024 * 1024 // 1GB
    }
  },
  streaming: {
    maxConcurrentStreams: 50,
    defaultBufferSize: 1000,
    defaultUpdateInterval: 100
  }
});

await symphony.initialize();
```

## Tools

### Standard Tools

Symphony provides built-in tools that work out of the box:

```typescript
// File operations
'readFile'      // Read file contents from filesystem
'writeFile'     // Write content to filesystem

// Web search
'webSearch'     // Search the web using Serper.dev API

// Document processing
'parseDocument' // Parse various document formats

// Code generation
'writeCode'     // Generate code based on specifications

// Planning
'createPlan'    // Create structured execution plans

// Cognitive processing
'ponder'        // Deep thinking with multi-depth analysis
```

### Creating Custom Tools

```typescript
const customTool = await symphony.tool.create({
  name: 'processData',
  description: 'Process and transform data with validation',
  inputs: ['data', 'options'],
  outputs: ['result', 'metadata'],
    handler: async (params) => {
        const startTime = Date.now();

        try {
            // Input validation
      if (!params.data) {
        throw new Error('Data parameter is required');
            }

            const options = {
        format: 'json',
        validate: true,
                ...params.options
            };

      // Processing logic
      let processedData = params.data;
      
      if (options.validate) {
        processedData = await validateData(processedData);
      }
      
      if (options.format === 'json') {
        processedData = JSON.stringify(processedData, null, 2);
      }

            return {
                success: true,
                result: {
          processed: processedData,
                    metadata: {
            originalSize: JSON.stringify(params.data).length,
            processedSize: processedData.length,
            timestamp: Date.now(),
            format: options.format
                    }
                },
                metrics: {
                    duration: Date.now() - startTime,
          startTime,
          endTime: Date.now()
                }
            };
        } catch (error) {
            return {
                success: false,
        error: error.message,
                metrics: {
                    duration: Date.now() - startTime,
          startTime,
          endTime: Date.now()
                }
            };
        }
    },
  
    // Advanced configuration
    timeout: 30000,
    retry: {
        enabled: true,
        maxAttempts: 3,
        delay: 1000,
    backoffFactor: 2
    },
    cache: {
        enabled: true,
        ttl: 3600,
        maxSize: 100
    },
    monitoring: {
        collectMetrics: true,
        logLevel: 'info',
        alertOnFailure: true
    }
});
```

### Using Tools Directly

```typescript
// Using ToolRegistry directly
import { ToolRegistry } from 'symphony-sdk';

const registry = ToolRegistry.getInstance();

// Execute a tool
const result = await registry.executeTool('webSearch', {
  query: 'Symphony SDK documentation'
});

// Get available tools
const tools = registry.getAvailableTools();
console.log('Available tools:', tools);

// Get tool information
const toolInfo = registry.getToolInfo('ponder');
```

## Agents

### Creating Agents

```typescript
const agent = await symphony.agent.create({
  name: 'DataAnalyst',
  description: 'Specialized in data analysis and insights generation',
  task: 'Analyze data and provide actionable insights',
  tools: ['webSearch', 'ponder', 'writeFile', 'createPlan'],
  llm: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2000
  },
  capabilities: ['data_analysis', 'reporting', 'visualization'],
  maxCalls: 10,
  timeout: 60000
});
```

### Agent Execution

```typescript
// Simple execution
const result = await agent.run('Analyze current AI market trends and create a report');

console.log('Agent Result:', {
  success: result.success,
  response: result.result?.response,
  toolCalls: result.metrics?.toolCalls,
  duration: result.metrics?.duration,
  llmUsage: result.metrics?.llmUsage
});

// Execution with options
const result = await agent.run('Research and analyze competitive landscape', {
  timeout: 120000,
  onProgress: (update) => {
    console.log(`Agent status: ${update.status}`);
  },
  onMetrics: (metrics) => {
    console.log(`Performance: ${JSON.stringify(metrics)}`);
                    }
});
```

### Agent Tool Selection

```typescript
// Get intelligent tool recommendation
const toolSelection = await agent.selectTool('Search for recent AI developments');

console.log('Tool Selection:', {
  toolName: toolSelection.toolName,
  confidence: toolSelection.confidence,
  reasoning: toolSelection.reasoning
});
```

## Teams

### Creating Teams

```typescript
const team = await symphony.team.create({
  name: 'DevelopmentTeam',
  description: 'Full-stack development team with specialized roles',
  agents: [
    {
      name: 'Frontend',
      description: 'React and TypeScript specialist',
      task: 'Build user interfaces and frontend components',
      tools: ['writeCode', 'readFile', 'writeFile'],
      llm: 'gpt-4o-mini',
      capabilities: ['react', 'typescript', 'css', 'responsive_design']
    },
    {
      name: 'Backend',
      description: 'Node.js and database specialist', 
      task: 'Build APIs, services, and database schemas',
      tools: ['writeCode', 'readFile', 'writeFile', 'ponder'],
      llm: 'gpt-4o-mini',
      capabilities: ['nodejs', 'express', 'database', 'api_design']
    },
    {
      name: 'DevOps',
      description: 'Infrastructure and deployment specialist',
      task: 'Handle deployment, monitoring, and infrastructure',
      tools: ['writeCode', 'readFile', 'writeFile', 'webSearch'],
      llm: 'gpt-4o-mini',
      capabilities: ['docker', 'kubernetes', 'ci_cd', 'monitoring']
    }
  ],
  strategy: {
    name: 'role_based_collaboration',
    coordinationRules: {
      maxParallelTasks: 3,
      taskTimeout: 300000
        }
    }
});
```

### Team Execution Strategies

```typescript
import { TeamExecutionStrategy } from 'symphony-sdk';

// Parallel execution - all agents work simultaneously
const parallelResult = await team.run('Implement user authentication system', {
  strategy: TeamExecutionStrategy.PARALLEL,
  timeout: 600000
});

// Sequential execution - agents work one after another
const sequentialResult = await team.run('Conduct code review and testing', {
  strategy: TeamExecutionStrategy.SEQUENTIAL
});

// Pipeline execution - output of one agent feeds into the next
const pipelineResult = await team.run('Design, implement, and test new feature', {
  strategy: TeamExecutionStrategy.PIPELINE
});

// Collaborative execution - agents work together on single task
const collaborativeResult = await team.run('Architect complex system design', {
  strategy: TeamExecutionStrategy.COLLABORATIVE
});

// Role-based execution - tasks assigned based on capabilities
const roleBasedResult = await team.run('Build e-commerce platform', {
  strategy: TeamExecutionStrategy.ROLE_BASED,
  requiredCapabilities: ['frontend', 'backend', 'database']
});
```

### Team Context Intelligence

```typescript
// Get comprehensive team context
const context = team.getContext();

console.log('Team Context:', {
  teamName: context.teamName,
  executionPhase: context.executionPhase,
  
  // Member intelligence
  availableMembers: context.members.available.length,
  optimalMember: context.members.optimal,
  workloadBalanced: context.members.workload.balanced,
  
  // Task intelligence
  activeTasks: context.tasks.active,
  completedTasks: context.tasks.completed,
  recentHistory: context.tasks.recentHistory.slice(0, 3),
  
  // Intelligence insights
  recommendedStrategy: context.insights.recommendedStrategy,
  teamEfficiency: context.insights.teamEfficiency,
  optimizations: context.insights.suggestedOptimizations,
  riskFactors: context.insights.riskFactors
});

// Get real-time team status
const status = team.getStatus();
console.log('Team Status:', {
  activeMembers: status.activeMembers,
  taskQueue: status.taskQueue,
  activeExecutions: status.activeExecutions,
  coordinationStrategy: status.coordinationStrategy
});
```

## Pipelines

### Creating Pipelines

```typescript
const pipeline = await symphony.pipeline.create({
  name: 'ContentAnalysisPipeline',
  description: 'Comprehensive content analysis and reporting pipeline',
  version: '1.0.0',
  steps: [
    {
      id: 'fetch_content',
      name: 'Fetch Content',
      type: 'tool',
      tool: 'webSearch',
      inputs: {
        query: '$search_term',
        type: 'search'
      },
      outputs: {
        content: '.'
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMs: 1000,
        retryOn: ['timeout', 'network', 'rate_limit']
      },
    timeout: 30000
    },
    {
      id: 'analyze_content',
      name: 'Analyze Content',
      type: 'tool',
      tool: 'ponder',
      inputs: {
        task: 'Analyze this content for key insights: @fetch_content',
        depth: '2'
      },
      dependencies: ['fetch_content'],
      timeout: 60000
    },
    {
      id: 'generate_report',
      name: 'Generate Report',
      type: 'tool',
      tool: 'writeFile',
      inputs: {
        filename: 'content_analysis_report.md',
        content: '@analyze_content'
      },
      dependencies: ['analyze_content']
    },
    {
      id: 'validate_output',
      name: 'Validate Output',
      type: 'condition',
      condition: {
        expression: '$validate_results === true',
        ifTrue: 'complete',
        ifFalse: 'retry_analysis'
      },
      dependencies: ['generate_report']
    }
  ],
  variables: {
    search_term: '',
    validate_results: true,
    output_format: 'markdown'
  },
  errorHandling: {
    strategy: 'retry',
    maxGlobalRetries: 2
  },
  concurrency: {
    maxParallelSteps: 2,
    resourceLimits: {
      memory: 1024,
      cpu: 80
    }
  }
});
```

### Pipeline Step Types

```typescript
// Tool step - execute a specific tool
{
  id: 'process_data',
  name: 'Process Data',
  type: 'tool',
  tool: 'ponder',
  inputs: { task: 'Process: @previous_step' }
}

// Chain step - execute a tool chain
{
  id: 'research_chain',
  name: 'Research Chain',
  type: 'chain',
  chain: {
    id: 'research_workflow',
    name: 'Research Workflow',
    steps: [/* chain steps */]
  }
}

// Condition step - conditional branching
{
  id: 'check_quality',
  name: 'Check Quality',
  type: 'condition',
  condition: {
    expression: '$quality_score > 0.8',
    ifTrue: 'publish',
    ifFalse: 'improve_quality'
  }
}

// Transform step - data transformation
{
  id: 'format_data',
  name: 'Format Data',
  type: 'transform',
  transform: {
    input: 'raw_data',
    output: 'formatted_data',
    transformation: 'json_stringify'
  }
}

// Parallel step - parallel execution
{
  id: 'parallel_processing',
  name: 'Parallel Processing',
  type: 'parallel',
  parallel: {
    steps: ['step1', 'step2', 'step3'],
    waitForAll: true
  }
}

// Wait step - delays and conditions
{
  id: 'wait_for_processing',
  name: 'Wait for Processing',
  type: 'wait',
  wait: {
    duration: 5000,
    condition: '$processing_complete === true'
  }
}
```

### Pipeline Execution

```typescript
// Execute pipeline
const result = await pipeline.run({
  search_term: 'artificial intelligence trends 2024',
  validate_results: true,
  output_format: 'markdown'
});

console.log('Pipeline Result:', {
  success: result.success,
  pipelineId: result.result?.pipelineId,
  executionId: result.result?.executionId,
  stepsCompleted: result.result?.steps.length,
  totalDuration: result.metrics?.duration,
  intelligence: result.metrics?.intelligence
});
```

### Pipeline Intelligence

   ```typescript
// Get performance profile
const profile = pipeline.executor.getPerformanceProfile();

if (profile) {
  console.log('Performance Profile:', {
    totalDuration: profile.totalDuration,
    stepCount: profile.stepMetrics.length,
    bottlenecks: profile.bottlenecks.map(b => ({
      stepId: b.stepId,
      type: b.type,
      severity: b.severity,
      impact: b.impact,
      recommendation: b.recommendation
    })),
    estimatedImprovement: profile.optimization.estimatedImprovement
  });
}

// Get optimization recommendations
const recommendations = pipeline.executor.getOptimizationRecommendations();

recommendations.forEach((rec, index) => {
  console.log(`Recommendation ${index + 1}:`, {
    category: rec.category,
    priority: rec.priority,
    description: rec.description,
    implementation: rec.implementation,
    estimatedImprovement: rec.estimatedImprovement,
    effort: rec.effort
  });
});

// Circuit breaker management
const cbStatus = pipeline.executor.getCircuitBreakerStatus('fetch_content');
if (cbStatus) {
  console.log('Circuit Breaker:', {
    state: cbStatus.state,
    failureCount: cbStatus.failureCount
  });
}

// Reset circuit breaker if needed
pipeline.executor.resetCircuitBreaker('fetch_content');

// Get intelligence health
const health = pipeline.executor.getIntelligenceHealth();
console.log('Intelligence Health:', health);
```

## Cache Intelligence

### Basic Cache Operations

   ```typescript
// Legacy cache operations (backward compatible)
await symphony.cache.set('user_data', { id: 1, name: 'John' }, 3600);
const userData = await symphony.cache.get('user_data');
const exists = await symphony.cache.has('user_data');
await symphony.cache.delete('user_data');
await symphony.cache.clear();
```

### Intelligence Features

```typescript
// Get intelligent recommendations
const intelligence = await symphony.cache.getIntelligence(
  'search for recent AI developments in natural language processing',
  {
    sessionId: 'user_session_123',
    enablePatternMatching: true,
    enableContextTrees: true,
    fastPathThreshold: 0.85
  }
);

console.log('Cache Intelligence:', {
  recommendation: intelligence.recommendation, // 'fast_path' | 'standard_path' | 'enhanced_context' | 'no_match'
  confidence: intelligence.confidence,
  
  // Pattern match details
  patternMatch: intelligence.patternMatch ? {
    name: intelligence.patternMatch.name,
    confidence: intelligence.patternMatch.confidence,
    toolCall: intelligence.patternMatch.toolCall,
    reasoning: intelligence.patternMatch.reasoning
  } : null,
  
  // Context tree details
  contextTree: intelligence.contextTree ? {
    type: intelligence.contextTree.type,
    name: intelligence.contextTree.name,
    priority: intelligence.contextTree.priority
  } : null,
  
  // Performance metadata
  metadata: intelligence.metadata
});

// Record tool execution for learning
await symphony.cache.recordToolExecution(
  'user_session_123',
  'webSearch',
  { query: 'AI developments', type: 'search' },
  { results: [/* search results */] },
  true, // success
  1250, // execution time in ms
  'SEARCH_WEB_pattern_id'
);
```

### Cache Analytics

```typescript
// Pattern analytics
const patternAnalytics = await symphony.cache.getPatternAnalytics();
console.log('Pattern Analytics:', {
  totalPatterns: patternAnalytics.totalPatterns,
  averageConfidence: patternAnalytics.averageConfidence,
  topPatterns: patternAnalytics.topPatterns.slice(0, 5),
  confidenceDistribution: patternAnalytics.confidenceDistribution
});

// Context analytics
const contextAnalytics = await symphony.cache.getContextAnalytics();
console.log('Context Analytics:', {
  cacheStats: contextAnalytics.cacheStats,
  averageNodes: contextAnalytics.treeMetrics.averageNodes,
  nodeTypes: contextAnalytics.treeMetrics.nodeTypes
});

// Global statistics
const globalStats = symphony.cache.getGlobalStats();
console.log('Global Cache Stats:', {
  totalQueries: globalStats.totalQueries,
  fastPathQueries: globalStats.fastPathQueries,
  patternMatchRate: globalStats.patternMatchRate,
  averageResponseTime: globalStats.averageResponseTime
});

// Session intelligence
const sessionIntelligence = symphony.cache.getSessionIntelligence('user_session_123');
if (sessionIntelligence) {
  console.log('Session Intelligence:', {
    queriesProcessed: sessionIntelligence.queriesProcessed,
    patternsMatched: sessionIntelligence.patternsMatched,
    averageConfidence: sessionIntelligence.averageConfidence,
    insights: sessionIntelligence.insights
  });
}
```

## Memory System

### Basic Memory Operations

```typescript
// Store memories
await symphony.memory.store('user_preference', { theme: 'dark', lang: 'en' }, 'short_term', {
  sessionId: 'session_123',
  namespace: 'user_settings',
  tags: ['preference', 'ui'],
  metadata: { source: 'user_input', confidence: 0.9 }
});

await symphony.memory.store('project_context', projectData, 'long_term', {
  namespace: 'projects',
  tags: ['active', 'important'],
  priority: 10
});

// Retrieve memories
const preference = await symphony.memory.retrieve('user_preference', 'short_term', {
  namespace: 'user_settings',
  includeMetadata: true
});

const projectContext = await symphony.memory.retrieve('project_context', 'long_term');
```

### Memory Search

```typescript
// Search memories with comprehensive query
const searchResults = await symphony.memory.search({
  type: 'short_term',
  namespace: 'user_settings',
  sessionId: 'session_123',
  tags: ['preference'],
  textSearch: 'theme',
  limit: 10,
  sortBy: 'timestamp',
  sortOrder: 'desc',
  dateRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    end: new Date()
  }
});

console.log('Search Results:', searchResults.map(entry => ({
  key: entry.key,
  type: entry.type,
  namespace: entry.namespace,
  tags: entry.tags,
  createdAt: entry.createdAt,
  size: entry.size
})));
```

### Memory Aggregation

```typescript
// Aggregate and analyze memories
const aggregation = await symphony.memory.aggregate({
  namespace: 'user_behavior',
  tags: ['interaction', 'preference'],
  dateRange: {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    end: new Date()
  }
});

console.log('Memory Aggregation:', {
  totalEntries: aggregation.totalEntries,
  totalSize: aggregation.totalSize,
  patterns: aggregation.patterns.map(p => ({
    pattern: p.pattern,
    frequency: p.frequency,
    insights: p.insights
  })),
  insights: aggregation.insights,
  processingTime: aggregation.metadata.processingTime
});
```

### Memory Statistics

```typescript
// Get comprehensive memory statistics
const stats = await symphony.memory.getStats();
console.log('Memory Statistics:', {
  shortTerm: {
    entries: stats.shortTerm.totalEntries,
    size: `${(stats.shortTerm.totalSize / 1024 / 1024).toFixed(2)} MB`,
    averageSize: `${(stats.shortTerm.averageSize / 1024).toFixed(2)} KB`
  },
  longTerm: {
    entries: stats.longTerm.totalEntries,
    size: `${(stats.longTerm.totalSize / 1024 / 1024).toFixed(2)} MB`,
    averageSize: `${(stats.longTerm.averageSize / 1024).toFixed(2)} KB`
  },
  performance: stats.performance,
  topNamespaces: Object.entries(stats.namespaces)
    .sort(([,a], [,b]) => b.entryCount - a.entryCount)
    .slice(0, 5)
});

// Get operational statistics
const operationalStats = symphony.memory.getOperationalStats();
console.log('Operational Stats:', {
  uptime: `${Math.round(operationalStats.uptime / 1000 / 60)} minutes`,
  totalOperations: operationalStats.totalOperations,
  averageResponseTime: `${operationalStats.averageResponseTime}ms`,
  healthStatus: operationalStats.healthStatus,
  memoryUsage: `${(operationalStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`
});
```

## Streaming

### Creating and Managing Streams

```typescript
// Create a stream for long-running operation
const streamId = symphony.streaming.createStream({
  type: 'pipeline',
  context: {
    id: 'data_processing_pipeline',
    name: 'Data Processing Pipeline',
    description: 'Processing large dataset with multiple stages'
  },
  options: {
    bufferSize: 1000,
    updateInterval: 100 // Update every 100ms
  }
});

// Subscribe to stream updates
const unsubscribe = symphony.streaming.subscribe(streamId, (update) => {
  switch (update.type) {
    case 'progress':
      console.log(`Progress: ${update.progress}%`);
      if (update.data) {
        console.log(`Processed: ${update.data.processed}/${update.data.total}`);
      }
      break;
      
    case 'status':
      console.log(`Status: ${update.status}`);
      break;
      
    case 'data':
      console.log('Intermediate result:', update.data);
      break;
      
    case 'complete':
      console.log('Operation completed successfully');
      console.log('Final result:', update.data);
      break;
      
    case 'error':
      console.error('Operation failed:', update.error);
      break;
  }
});

// Update stream progress during operation
symphony.streaming.updateProgress(streamId, {
  type: 'progress',
  progress: 25,
  status: 'Processing stage 1/4',
  data: { stage: 1, processed: 250, total: 1000 }
});

symphony.streaming.updateProgress(streamId, {
  type: 'progress', 
  progress: 50,
  status: 'Processing stage 2/4',
  data: { stage: 2, processed: 500, total: 1000 }
});

// Complete the stream
symphony.streaming.completeStream(streamId, {
  totalProcessed: 1000,
  finalOutput: 'processing_results.json',
  summary: 'Successfully processed 1000 records in 4 stages'
});

// Unsubscribe when done
unsubscribe();
```

### Stream Management

```typescript
// Get active streams
const activeStreams = symphony.streaming.getActiveStreams();
console.log(`Active streams: ${activeStreams.length}`);

// Get specific stream status
const status = symphony.streaming.getStreamStatus(streamId);
console.log('Stream Status:', status);

// Get streaming statistics
const streamingStats = symphony.streaming.getStats();
console.log('Streaming Statistics:', {
  totalStreams: streamingStats.totalStreams,
  activeStreams: streamingStats.activeStreams,
  completedStreams: streamingStats.completedStreams,
  errorStreams: streamingStats.errorStreams,
  averageDuration: streamingStats.averageDuration,
  peakConcurrency: streamingStats.peakConcurrency,
  memoryUsage: `${(streamingStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`
});

// Health check
const streamingHealth = await symphony.streaming.healthCheck();
console.log('Streaming Health:', streamingHealth);
```

## Advanced Features

### Tool Chaining

```typescript
import { ChainExecutor } from 'symphony-sdk';

const chain = {
  id: 'research_analysis_chain',
  name: 'Research and Analysis Chain',
  description: 'Comprehensive research workflow with analysis and reporting',
    steps: [
        {
      id: 'research',
      tool: 'webSearch',
      semantic_number: '1', // Initial step
      static_params: {
        type: 'search'
      }
    },
    {
      id: 'analyze',
      tool: 'ponder',
      semantic_number: '2.1', // First intermediary step
      input_mapping: {
        task: 'research.result',
        depth: 'input.analysis_depth'
            }
        },
        {
      id: 'synthesize',
      tool: 'ponder', 
      semantic_number: '2.2', // Second intermediary step
      input_mapping: {
        task: 'analyze.result',
        depth: 'input.synthesis_depth'
      },
      depends_on: ['analyze']
        },
        {
      id: 'report',
      tool: 'writeFile',
      semantic_number: '3', // Final step
      input_mapping: {
        filename: 'input.output_file',
        content: 'synthesize.result'
      }
    }
  ],
  input_schema: {
    query: 'string',
    analysis_depth: 'string',
    synthesis_depth: 'string',
    output_file: 'string'
            },
  output_mapping: {
    final_report: 'report.result',
    analysis: 'analyze.result',
    synthesis: 'synthesize.result'
  }
};

const chainExecutor = ChainExecutor.getInstance();
const chainResult = await chainExecutor.executeChain(chain, {
  query: 'latest developments in quantum computing',
  analysis_depth: '2',
  synthesis_depth: '3',
  output_file: 'quantum_computing_report.md'
});

console.log('Chain Result:', {
  success: chainResult.success,
  totalDuration: chainResult.metrics.totalDuration,
  stepsCompleted: chainResult.metrics.completedSteps,
  parallelGroups: chainResult.metrics.parallelGroups
});
```

### Database Operations

```typescript
// Health check
const dbHealth = await symphony.db.healthCheck();
console.log('Database Health:', dbHealth);

// Get database statistics
const dbStats = await symphony.db.getStats();
console.log('Database Stats:', {
  tables: Object.keys(dbStats.tables),
  totalQueries: dbStats.performance.totalQueries,
  averageQueryTime: dbStats.performance.averageQueryTime,
  databaseSize: `${(dbStats.storage.totalSize / 1024 / 1024).toFixed(2)} MB`
});

// Tool execution history
const toolExecutions = await symphony.db.getToolExecutions('session_123', 'webSearch', 10);
console.log('Recent Tool Executions:', toolExecutions.map(exec => ({
  toolName: exec.toolName,
  success: exec.success,
  executionTime: exec.executionTime,
  timestamp: new Date(exec.timestamp)
})));

// Custom database queries
const customResults = await symphony.db.query(
  'SELECT tool_name, COUNT(*) as count FROM tool_executions WHERE success = ? GROUP BY tool_name',
  [true]
);
```

### Health Monitoring

```typescript
// Symphony overall health
const symphonyState = symphony.getState();
console.log('Symphony State:', symphonyState);

// Service health checks
const cacheHealth = await symphony.cache.healthCheck();
const memoryHealth = await symphony.memory.healthCheck();
const streamingHealth = await symphony.streaming.healthCheck();

console.log('Service Health Summary:', {
  cache: cacheHealth.status,
  memory: memoryHealth.status,
  streaming: streamingHealth.status,
  database: (await symphony.db.healthCheck()).status
});

// Performance monitoring
const metrics = symphony.metrics.getAll();
console.log('Performance Metrics:', metrics);
```

### Error Handling

```typescript
// Comprehensive error handling
async function safeOperation() {
  try {
    const result = await agent.run('Complex analytical task');
    
    if (result.success) {
      console.log('Success:', result.result);
      return result.result;
    } else {
      console.error('Agent execution failed:', result.error);
      
      // Check for specific error types
      if (result.error?.includes('timeout')) {
        console.log('Handling timeout - retrying with extended timeout');
        return await agent.run('Complex analytical task', { timeout: 120000 });
      } else if (result.error?.includes('rate limit')) {
        console.log('Rate limited - waiting before retry');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return await agent.run('Complex analytical task');
      }
      
      throw new Error(`Agent execution failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    
    // Fallback strategies
    console.log('Attempting fallback approach...');
    
    // Could try different agent, simpler task, or manual intervention
    throw error;
  }
}
```

### Configuration Management

```typescript
// Get current configuration
const config = symphony.getConfig();
console.log('Current Config:', {
  llmProvider: config.llm.provider,
  llmModel: config.llm.model,
  databaseEnabled: config.db?.enabled,
  logLevel: config.logLevel
});

// Update configuration dynamically
symphony.updateConfig({
  llm: {
    temperature: 0.8,
    maxTokens: 4000
  },
  logLevel: 'debug'
});

// Get dependencies
const dependencies = symphony.getDependencies();
console.log('Service Dependencies:', dependencies);
```

This usage guide reflects the actual Symphony implementation with accurate examples, proper error handling, and comprehensive feature coverage. All code examples are based on the real API definitions and will work with the current Symphony SDK.
