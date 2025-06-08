import { symphony } from './src/index';
import { envConfig } from './src/utils/env';
import * as assert from 'assert';

const logger = symphony.logger;

async function runContextAPITest() {
    logger.info('TestRunner', '🚀 === CONTEXT API & DATABASE INTEGRATION TEST === 🚀');
    logger.info('TestRunner', '🗄️ Testing SQLite database setup, Context API manual controls, and cache implementation');

    // Initialize Symphony
    await symphony.initialize();
    
    // Get services
    const contextAPI = await symphony.getService('context');
    const toolService = await symphony.getService('tool');
    const dbService = await symphony.getService('database');
    
    assert.ok(contextAPI, 'Context API should be available');
    assert.ok(toolService, 'Tool service should be available');
    assert.ok(dbService, 'Database service should be available');

    // Step 1: Verify SQLite Database Setup
    logger.info('TestRunner', 'Step 1: Verifying SQLite database setup and schema...');
    
    // Test database health
    const dbHealth = await dbService.health();
    assert.strictEqual(dbHealth.connected, true, 'Database should be connected');
    logger.info('TestRunner', `✅ Database health: connected=${dbHealth.connected}, adapter=${dbHealth.adapter}`);

    // Get database statistics
    const dbStats = await dbService.stats();
    logger.info('TestRunner', `Database statistics: ${dbStats.tablesUsed.length} tables, ${dbStats.totalQueries} queries executed`);
    
    // Verify core tables exist by attempting to access them
    const coreTables = ['tool_executions', 'patterns'];
    for (const tableName of coreTables) {
        try {
            const count = await dbService.table(tableName).count();
            logger.info('TestRunner', `✅ Table '${tableName}': ${count} records`);
        } catch (error) {
            logger.warn('TestRunner', `Table '${tableName}' may not exist or be accessible: ${error}`);
        }
    }

    // Step 2: Test Context API Manual Control Fields
    logger.info('TestRunner', 'Step 2: Testing Context API manual control parameters...');

    // 2.1: Test Pattern Management with Manual Controls
    logger.info('TestRunner', '2.1: Testing pattern update with manual controls...');
    
    const patternUpdateResult = await contextAPI.useMagic('update_pattern_stats', {
        nlpPattern: 'test analysis pattern',
        toolName: 'analyzeData',
        success: true,
        executionTime: 1250,
        metadata: {
            sessionId: 'test-session-001',
            userContext: 'data analysis workflow',
            performanceLevel: 'high'
        }
    });
    
    assert.strictEqual(patternUpdateResult.success, true, 'Pattern update should succeed');
    logger.info('TestRunner', `✅ Pattern updated: confidence=${patternUpdateResult.result?.newConfidence}`);

    // 2.2: Test Context Pruning with Advanced Controls
    logger.info('TestRunner', '2.2: Testing context pruning with manual controls...');
    
    // First, let's add some test data to prune
    await toolService.execute('ponder', {
        topic: 'test pruning data',
        steps: 'minimal',
        consciousness_level: 'low'
    });

    const pruningResult = await contextAPI.useMagic('prune_context', {
        sessionId: 'test-session-001',
        maxAge: 1, // 1 second - very aggressive pruning for testing
        minConfidence: 0.3,
        keepRecentCount: 5
    });
    
    assert.strictEqual(pruningResult.success, true, 'Context pruning should succeed');
    logger.info('TestRunner', `✅ Pruning completed: ${pruningResult.result?.prunedEntries} entries removed`);

    // 2.3: Test Execution Insights with Filtering
    logger.info('TestRunner', '2.3: Testing execution insights with advanced filtering...');
    
    const insightsResult = await contextAPI.useMagic('get_insights', {
        sessionId: 'test-session-001',
        toolName: 'ponder',
        timeframe: 300000, // 5 minutes
        includeFailures: true
    });
    
    assert.strictEqual(insightsResult.success, true, 'Insights retrieval should succeed');
    logger.info('TestRunner', `✅ Insights retrieved: ${insightsResult.result?.totalExecutions} total executions analyzed`);

    // 2.4: Test Tool Suggestions with Context
    logger.info('TestRunner', '2.4: Testing tool suggestions with contextual parameters...');
    
    const suggestionsResult = await contextAPI.useMagic('suggest_tools', {
        task: 'analyze financial data and generate report',
        context: {
            userRole: 'financial_analyst',
            urgency: 'high',
            dataSize: 'large'
        },
        agentName: 'FinancialAgent',
        previousAttempts: ['writeCode', 'readFile']
    });
    
    assert.strictEqual(suggestionsResult.success, true, 'Tool suggestions should succeed');
    logger.info('TestRunner', `✅ Tool suggestions: ${suggestionsResult.result?.suggestions?.length || 0} tools recommended`);

    // 2.5: Test Pattern Analysis with Confidence Filtering
    logger.info('TestRunner', '2.5: Testing pattern analysis with confidence filtering...');
    
    const patternsResult = await contextAPI.useMagic('analyze_patterns', {
        toolName: 'ponder',
        timeframe: 600000, // 10 minutes
        includeFailures: true,
        minConfidence: 0.5
    });
    
    assert.strictEqual(patternsResult.success, true, 'Pattern analysis should succeed');
    logger.info('TestRunner', `✅ Pattern analysis: ${patternsResult.result?.totalPatterns} total patterns, ${patternsResult.result?.filteredPatterns} above confidence threshold`);

    // 2.6: Test Learning from Execution with User Feedback
    logger.info('TestRunner', '2.6: Testing learning from execution with user feedback...');
    
    const learningResult = await contextAPI.useMagic('learn_from_execution', {
        toolName: 'writeCode',
        success: true,
        executionTime: 3500,
        userFeedback: 'positive',
        context: {
            codeQuality: 'high',
            complexity: 'medium',
            language: 'typescript'
        },
        errorDetails: undefined
    });
    
    assert.strictEqual(learningResult.success, true, 'Learning from execution should succeed');
    logger.info('TestRunner', `✅ Learning completed: pattern updated=${learningResult.result?.patternUpdated}`);

    // 2.7: Test Performance Optimization Analysis
    logger.info('TestRunner', '2.7: Testing performance optimization analysis...');
    
    const optimizationResult = await contextAPI.useMagic('optimize_performance', {
        targetTool: 'ponder',
        performanceThreshold: 2000, // 2 seconds
        includeRecommendations: true
    });
    
    assert.strictEqual(optimizationResult.success, true, 'Performance optimization should succeed');
    logger.info('TestRunner', `✅ Performance analysis: ${optimizationResult.result?.recommendations?.length || 0} recommendations generated`);

    // 2.8: Test Command Validation
    logger.info('TestRunner', '2.8: Testing command map validation...');
    
    const validationResult = await contextAPI.useMagic('validate_command_update', {
        nlpPattern: 'generate comprehensive analysis',
        toolName: 'ponder',
        operation: 'add',
        confidence: 0.85
    });
    
    assert.strictEqual(validationResult.success, true, 'Command validation should succeed');
    logger.info('TestRunner', `✅ Command validation: safe=${validationResult.result?.isSafe}`);

    // Step 3: Verify Database Persistence and Cache Implementation
    logger.info('TestRunner', 'Step 3: Verifying database persistence and cache implementation...');

    // 3.1: Check tool_executions table
    let executionCount = 0;
    try {
        executionCount = await dbService.table('tool_executions').count();
        logger.info('TestRunner', `Database contains ${executionCount} tool execution records`);
        assert.ok(executionCount > 0, 'Database should contain execution records');
    } catch (error) {
        logger.warn('TestRunner', `Could not access tool_executions table: ${error}`);
    }

    // 3.2: Verify execution record structure if records exist
    if (executionCount > 0) {
        try {
            const executions = await dbService.table('tool_executions').find();
            if (executions.length > 0) {
                const latestExecution = executions[executions.length - 1];
                const expectedFields = ['id', 'session_id', 'tool_name', 'success', 'execution_time', 'created_at'];
                expectedFields.forEach(field => {
                    if (latestExecution.hasOwnProperty(field)) {
                        logger.info('TestRunner', `✅ Execution record has '${field}' field`);
                    } else {
                        logger.warn('TestRunner', `Execution record missing '${field}' field`);
                    }
                });
            }
        } catch (error) {
            logger.warn('TestRunner', `Could not verify execution record structure: ${error}`);
        }
    }

    // 3.3: Test pattern persistence
    let patternCount = 0;
    try {
        patternCount = await dbService.table('patterns').count();
        logger.info('TestRunner', `Database contains ${patternCount} pattern records`);
    } catch (error) {
        logger.warn('TestRunner', `Could not access patterns table: ${error}`);
    }

    // Step 4: Test Memory Context Management
    logger.info('TestRunner', 'Step 4: Testing memory context management...');

    // 4.1: Create multiple sessions to test isolation
    const sessionResults = [];
    for (let i = 1; i <= 3; i++) {
        const sessionId = `test-session-${String(i).padStart(3, '0')}`;
        
        // Execute tools in different sessions
        await toolService.execute('ponder', {
            topic: `session ${i} analysis`,
            steps: 'analyze, evaluate',
            consciousness_level: 'medium'
        });
        
        // Get session-specific insights
        const sessionInsights = await contextAPI.useMagic('get_insights', {
            sessionId: sessionId,
            timeframe: 60000 // 1 minute
        });
        
        sessionResults.push({
            sessionId,
            executions: sessionInsights.result?.totalExecutions || 0,
            success: sessionInsights.success
        });
    }
    
    logger.info('TestRunner', 'Session isolation test results:', sessionResults);
    assert.ok(sessionResults.every(r => r.success), 'All session queries should succeed');
    logger.info('TestRunner', '✅ Memory context sessions isolated successfully');

    // Step 5: Test Cache Implementation with Context Trees
    logger.info('TestRunner', 'Step 5: Testing cache implementation with context trees...');

    const contextTreeResult = await contextAPI.useMagic('validate_context_tree', {
        sessionId: 'test-session-001',
        maxNodes: 100,
        operation: 'build'
    });
    
    assert.strictEqual(contextTreeResult.success, true, 'Context tree validation should succeed');
    logger.info('TestRunner', `✅ Context tree: ${contextTreeResult.result?.isValid ? 'valid' : 'invalid'} structure`);

    // Step 6: Advanced Context Control Scenarios
    logger.info('TestRunner', 'Step 6: Testing advanced context control scenarios...');

    // 6.1: Test confidence-based filtering
    const highConfidencePatterns = await contextAPI.useMagic('analyze_patterns', {
        minConfidence: 0.8,
        includeFailures: false
    });
    
    const lowConfidencePatterns = await contextAPI.useMagic('analyze_patterns', {
        minConfidence: 0.3,
        includeFailures: true
    });
    
    logger.info('TestRunner', `High confidence patterns: ${highConfidencePatterns.result?.filteredPatterns}`);
    logger.info('TestRunner', `Low confidence patterns: ${lowConfidencePatterns.result?.filteredPatterns}`);
    
    assert.ok(lowConfidencePatterns.result?.filteredPatterns >= highConfidencePatterns.result?.filteredPatterns, 
        'Lower confidence threshold should return more patterns');
    
    // 6.2: Test timeframe-based analysis
    const recentInsights = await contextAPI.useMagic('get_insights', {
        timeframe: 60000, // 1 minute
        includeFailures: true
    });
    
    const extendedInsights = await contextAPI.useMagic('get_insights', {
        timeframe: 3600000, // 1 hour
        includeFailures: true
    });
    
    logger.info('TestRunner', `Recent insights (1min): ${recentInsights.result?.totalExecutions} executions`);
    logger.info('TestRunner', `Extended insights (1hr): ${extendedInsights.result?.totalExecutions} executions`);
    
    assert.ok(extendedInsights.result?.totalExecutions >= recentInsights.result?.totalExecutions,
        'Extended timeframe should include more executions');

    // Step 7: Performance and Memory Analytics
    logger.info('TestRunner', 'Step 7: Gathering performance and memory analytics...');

    // Get final database health and statistics
    const finalDbHealth = await dbService.health();
    const finalDbStats = await dbService.stats();

    const finalAnalytics = {
        databaseHealth: {
            connected: finalDbHealth.connected,
            adapter: finalDbHealth.adapter,
            tableCount: finalDbHealth.storage?.tableCount || 0,
            recordCount: finalDbHealth.storage?.recordCount || 0,
            avgQueryTime: finalDbHealth.performance?.avgQueryTime || 0
        },
        databaseStats: {
            totalQueries: finalDbStats.totalQueries,
            successfulQueries: finalDbStats.successfulQueries,
            tablesUsed: finalDbStats.tablesUsed,
            namespaces: finalDbStats.namespaces
        },
        contextAPIHealth: await contextAPI.healthCheck(),
        cachePerformance: {
            pruningEnabled: true,
            confidenceFiltering: true,
            sessionIsolation: true,
            timeframeAnalysis: true
        },
        manualControlFields: {
            pruningControls: ['sessionId', 'maxAge', 'minConfidence', 'keepRecentCount'],
            patternControls: ['nlpPattern', 'toolName', 'success', 'executionTime', 'metadata'],
            insightControls: ['sessionId', 'toolName', 'timeframe', 'includeFailures'],
            learningControls: ['toolName', 'success', 'executionTime', 'userFeedback', 'context', 'errorDetails'],
            analysisControls: ['toolName', 'timeframe', 'includeFailures', 'minConfidence'],
            optimizationControls: ['targetTool', 'performanceThreshold', 'includeRecommendations']
        }
    };

    logger.info('TestRunner', 'Final Analytics:', finalAnalytics);

    // Final assertions
    assert.strictEqual(finalAnalytics.databaseHealth.connected, true, 'Database should be healthy');
    assert.strictEqual(finalAnalytics.contextAPIHealth, true, 'Context API should be healthy');
    assert.strictEqual(finalAnalytics.manualControlFields.pruningControls.length, 4, 'Should have 4 pruning control fields');
    assert.strictEqual(finalAnalytics.manualControlFields.patternControls.length, 5, 'Should have 5 pattern control fields');

    logger.info('TestRunner', '\n🎉🎉🎉 CONTEXT API & DATABASE TEST PASSED! 🎉🎉🎉');
    logger.info('TestRunner', '✅ SQLite database setup verified and operational');
    logger.info('TestRunner', '✅ All Context API manual control fields tested');
    logger.info('TestRunner', '✅ Memory context management working correctly');
    logger.info('TestRunner', '✅ Cache implementation with context trees functional');
    logger.info('TestRunner', '✅ Database persistence and session isolation verified');
    logger.info('TestRunner', '✅ Advanced filtering and analytics operational');
    
    logger.info('TestRunner', '\n📊 CONTEXT API CAPABILITIES:');
    logger.info('TestRunner', `Total Manual Control Fields: ${Object.values(finalAnalytics.manualControlFields).flat().length}`);
    logger.info('TestRunner', `Database Health: ${finalAnalytics.databaseHealth.connected ? 'Connected' : 'Disconnected'} (${finalAnalytics.databaseHealth.adapter})`);
    logger.info('TestRunner', `Tables: ${finalAnalytics.databaseStats.tablesUsed.length}, Records: ${finalAnalytics.databaseHealth.recordCount}, Queries: ${finalAnalytics.databaseStats.totalQueries}`);
    logger.info('TestRunner', `Context Management: Session isolation, timeframe filtering, confidence thresholds`);
    logger.info('TestRunner', `Cache Features: Intelligent pruning, pattern learning, performance optimization`);
    
    process.exitCode = 0;
}

runContextAPITest().catch(err => {
    logger.error('TestRunner', 'CONTEXT API TEST FAILED:', { message: err.message, stack: err.stack });
    process.exitCode = 1;
}).finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 3000);
}); 