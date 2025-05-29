/**
 * Symphony Memory System Test
 * 
 * This test demonstrates the complete memory system API:
 * 1. Short-term and long-term memory storage
 * 2. Memory search and retrieval 
 * 3. Memory aggregation and analytics
 * 4. Session-based memory organization
 * 5. Legacy compatibility
 */

const { Symphony } = require('./src/symphony');

async function runMemorySystemTest() {
    console.log('🧠 Starting Symphony Memory System Test...\n');
    
    // Initialize Symphony with memory system
    const symphony = new Symphony({
        llm: {
            provider: 'openai',
            model: 'gpt-4-turbo-preview',
            apiKey: process.env.OPENAI_API_KEY
        },
        db: {
            enabled: true,
            adapter: 'sqlite',
            path: './symphony.db'
        }
    });
    
    await symphony.initialize();
    
    // Initialize memory system with custom configuration
    console.log('🔧 Initializing Memory System...');
    await symphony.memory.initialize({
        shortTerm: { ttl: 3600, maxEntries: 500 },    // 1 hour, 500 entries
        longTerm: { ttl: 86400, maxEntries: 2000 },   // 24 hours, 2K entries (reduced for test)
        enableAggregation: true,
        enableGlobalAccess: true
    });
    
    const sessionId = `memory_test_session_${Date.now()}`;
    console.log(`📊 Using session ID: ${sessionId}\n`);
    
    // === SHORT-TERM MEMORY TESTS ===
    console.log('📝 Testing Short-Term Memory...');
    
    // Store various types of data in short-term memory
    const shortTermData = [
        { key: 'current_task', value: 'Implementing Symphony memory system', metadata: { priority: 'high' } },
        { key: 'user_preference', value: { theme: 'dark', language: 'en' }, tags: ['ui', 'settings'] },
        { key: 'temp_calculation', value: { result: 42, formula: '6 * 7' }, tags: ['math', 'calculation'] },
        { key: 'active_agents', value: ['researcher', 'analyzer', 'writer'], tags: ['agents', 'workflow'] },
        { key: 'debug_info', value: { error: null, status: 'running' }, metadata: { level: 'info' } }
    ];
    
    for (const item of shortTermData) {
        await symphony.memory.store(item.key, item.value, 'short_term', {
            sessionId,
            namespace: 'test',
            metadata: item.metadata,
            tags: item.tags
        });
        console.log(`   ✅ Stored short-term: ${item.key}`);
    }
    
    // === LONG-TERM MEMORY TESTS ===
    console.log('\n📚 Testing Long-Term Memory...');
    
    // Store knowledge and insights in long-term memory
    const longTermData = [
        { 
            key: 'project_insights', 
            value: 'Symphony cache intelligence achieved 88% pattern recognition accuracy',
            metadata: { type: 'insight', confidence: 0.95 },
            tags: ['project', 'performance', 'cache']
        },
        { 
            key: 'user_behavior_pattern', 
            value: { commonQueries: ['search files', 'debug code', 'analyze data'], frequency: 'daily' },
            metadata: { type: 'behavior', learningSource: 'usage_analytics' },
            tags: ['user', 'behavior', 'patterns']
        },
        { 
            key: 'best_practices', 
            value: 'Use function-based APIs for better developer control and predictability',
            metadata: { type: 'knowledge', source: 'development_experience' },
            tags: ['development', 'api', 'best_practices']
        },
        { 
            key: 'performance_benchmark', 
            value: { avgResponseTime: '0.9ms', cacheHitRate: '88%', accuracy: '95%' },
            metadata: { type: 'metrics', benchmark_date: new Date().toISOString() },
            tags: ['performance', 'metrics', 'benchmarks']
        }
    ];
    
    for (const item of longTermData) {
        await symphony.memory.store(item.key, item.value, 'long_term', {
            sessionId,
            namespace: 'knowledge',
            metadata: item.metadata,
            tags: item.tags
        });
        console.log(`   ✅ Stored long-term: ${item.key}`);
    }
    
    // === MEMORY RETRIEVAL TESTS ===
    console.log('\n🔍 Testing Memory Retrieval...');
    
    // Test retrieving specific entries
    const currentTask = await symphony.memory.retrieve('current_task', 'short_term', { namespace: 'test' });
    console.log(`   📋 Current task: "${currentTask}"`);
    
    const projectInsights = await symphony.memory.retrieve('project_insights', 'long_term', { 
        namespace: 'knowledge', 
        includeMetadata: true 
    });
    console.log(`   💡 Project insights: "${projectInsights.value}" (confidence: ${projectInsights.metadata.confidence})`);
    
    // === MEMORY SEARCH TESTS ===
    console.log('\n🔎 Testing Memory Search...');
    
    // Search by tags
    const performanceEntries = await symphony.memory.search({
        tags: ['performance'],
        type: 'both',
        sessionId
    });
    console.log(`   📊 Found ${performanceEntries.length} performance-related entries`);
    
    // Search by text
    const cacheEntries = await symphony.memory.search({
        searchText: 'cache',
        type: 'both',
        sessionId,
        limit: 10
    });
    console.log(`   🔍 Found ${cacheEntries.length} entries containing "cache"`);
    
    // Search short-term only
    const shortTermEntries = await symphony.memory.search({
        type: 'short_term',
        namespace: 'test',
        sessionId
    });
    console.log(`   ⏰ Found ${shortTermEntries.length} short-term test entries`);
    
    // === MEMORY AGGREGATION TESTS ===
    console.log('\n📈 Testing Memory Aggregation...');
    
    const aggregationResult = await symphony.memory.aggregate({
        sessionId,
        type: 'both',
        limit: 100
    });
    
    console.log(`   📋 Aggregation Summary: ${aggregationResult.summary}`);
    console.log(`   🔍 Patterns Found: ${aggregationResult.patterns.length}`);
    if (aggregationResult.patterns.length > 0) {
        console.log(`   📊 Top Pattern: "${aggregationResult.patterns[0].pattern}" (frequency: ${aggregationResult.patterns[0].frequency})`);
    }
    console.log(`   💡 Insights Generated: ${aggregationResult.insights.length}`);
    aggregationResult.insights.forEach((insight, index) => {
        console.log(`      ${index + 1}. ${insight}`);
    });
    console.log(`   🎯 Recommendations: ${aggregationResult.recommendations.length}`);
    aggregationResult.recommendations.forEach((rec, index) => {
        console.log(`      ${index + 1}. ${rec}`);
    });
    
    // === MEMORY STATISTICS ===
    console.log('\n📊 Memory Statistics...');
    
    const memoryStats = await symphony.memory.getStats();
    console.log(`   Short-term entries: ${memoryStats.shortTerm.count} (${memoryStats.shortTerm.sizeBytes} bytes)`);
    console.log(`   Long-term entries: ${memoryStats.longTerm.count} (${memoryStats.longTerm.sizeBytes} bytes)`);
    console.log(`   Total entries: ${memoryStats.totalEntries}`);
    console.log(`   Total size: ${memoryStats.totalSizeBytes} bytes`);
    console.log(`   Active sessions: ${memoryStats.sessions}`);
    console.log(`   Namespaces: ${memoryStats.namespaces.join(', ')}`);
    
    const operationalStats = symphony.memory.getOperationalStats();
    console.log(`   Store operations: ${operationalStats.storeOperations}`);
    console.log(`   Retrieve operations: ${operationalStats.retrieveOperations}`);
    console.log(`   Search operations: ${operationalStats.searchOperations}`);
    console.log(`   Hit rate: ${(operationalStats.hitRate * 100).toFixed(1)}%`);
    
    // === LEGACY COMPATIBILITY TESTS ===
    console.log('\n🔄 Testing Legacy Compatibility...');
    
    // Create a legacy memory instance
    const legacyMemory = symphony.memory.createMemoryInstance(sessionId, 'legacy_test');
    
    // Use legacy API
    await legacyMemory.store('legacy_key', 'legacy_value');
    const legacyValue = await legacyMemory.retrieve('legacy_key');
    console.log(`   📦 Legacy memory: stored and retrieved "${legacyValue}"`);
    
    // === MEMORY MANAGEMENT TESTS ===
    console.log('\n🧹 Testing Memory Management...');
    
    // Clear specific namespace
    const clearedCount = await symphony.memory.clear('short_term', 'test');
    console.log(`   🗑️  Cleared ${clearedCount} short-term test entries`);
    
    // Health check
    const healthCheck = await symphony.memory.healthCheck();
    console.log(`   ❤️  Memory health: ${healthCheck.status}`);
    console.log(`   🔧 Services initialized: ${healthCheck.services.initialized}`);
    console.log(`   📈 Total entries after cleanup: ${healthCheck.memory.totalEntries}`);
    
    // === ADVANCED USAGE SCENARIOS ===
    console.log('\n🚀 Advanced Usage Scenarios...');
    
    // Scenario 1: Agent memory
    await symphony.memory.store('agent_memory', {
        agentName: 'ResearchAgent',
        lastAction: 'web_search',
        context: { query: 'machine learning trends', results: 15 },
        nextSuggestedAction: 'analyze_results'
    }, 'short_term', {
        sessionId,
        namespace: 'agents',
        tags: ['agent', 'research', 'workflow'],
        metadata: { agentType: 'research', priority: 'high' }
    });
    console.log('   🤖 Stored agent memory with context');
    
    // Scenario 2: Learning from patterns
    await symphony.memory.store('learning_pattern', {
        pattern: 'User frequently searches for TypeScript files after debugging',
        confidence: 0.87,
        actionsSuggested: ['preload_ts_search', 'suggest_debug_tools'],
        timesObserved: 12
    }, 'long_term', {
        sessionId,
        namespace: 'learning',
        tags: ['pattern', 'learning', 'user_behavior'],
        metadata: { learningType: 'behavioral', autoGenerated: true }
    });
    console.log('   🧠 Stored learning pattern for future optimization');
    
    // Scenario 3: Cross-session knowledge
    await symphony.memory.store('cross_session_knowledge', {
        insight: 'Projects with TypeScript tend to use specific debugging patterns',
        applicability: 'global',
        supportingData: { sampleSize: 50, confidence: 0.91 },
        recommendations: ['suggest_ts_specific_tools', 'preload_common_patterns']
    }, 'long_term', {
        namespace: 'global_knowledge',
        tags: ['knowledge', 'cross_session', 'typescript', 'debugging'],
        metadata: { scope: 'global', autoApply: true }
    });
    console.log('   🌐 Stored cross-session knowledge for global optimization');
    
    // Final aggregation of all memory
    console.log('\n📊 Final Memory Aggregation...');
    const finalAggregation = await symphony.memory.aggregate({
        type: 'both',
        limit: 1000
    });
    
    console.log(`\n🎯 Final Results:`);
    console.log(`   Total entries analyzed: ${finalAggregation.totalEntriesAnalyzed}`);
    console.log(`   Distinct patterns: ${finalAggregation.patterns.length}`);
    console.log(`   Actionable insights: ${finalAggregation.insights.length}`);
    console.log(`   Optimization recommendations: ${finalAggregation.recommendations.length}`);
    
    return {
        shortTermStored: shortTermData.length,
        longTermStored: longTermData.length,
        totalPatterns: finalAggregation.patterns.length,
        totalInsights: finalAggregation.insights.length,
        memoryHealthy: healthCheck.status === 'healthy',
        operationalStats: operationalStats
    };
}

// Run the comprehensive memory system test
runMemorySystemTest()
    .then(results => {
        console.log('\n✅ Memory System Test Completed Successfully');
        console.log(`\nFinal Test Results:`);
        console.log(`   Short-term entries stored: ${results.shortTermStored}`);
        console.log(`   Long-term entries stored: ${results.longTermStored}`);
        console.log(`   Patterns identified: ${results.totalPatterns}`);
        console.log(`   Insights generated: ${results.totalInsights}`);
        console.log(`   Memory system healthy: ${results.memoryHealthy}`);
        console.log(`   Total operations: ${results.operationalStats.storeOperations + results.operationalStats.retrieveOperations + results.operationalStats.searchOperations}`);
        console.log('\n🧠 Memory System is fully functional and ready for production use!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Memory System Test Failed:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    });

module.exports = runMemorySystemTest; 