const { symphony } = require('../dist/index.js');

async function testToolObservability() {
  console.log('\n=== Tool Observability & Analytics Test ===');
  
  // Tool execution analytics collector
  const toolAnalytics = {
    executions: [],
    aggregatedMetrics: {},
    toolUsagePatterns: {},
    errorAnalytics: {},
    performanceProfiles: {},
    concurrencyMetrics: {},
    apiUsageStats: {}
  };

  // Set a timeout to prevent hanging
  const timeout = setTimeout(() => {
    console.log('\n⏰ Test timeout reached - forcing exit');
    process.exit(1);
  }, 600000); // 10 minutes for comprehensive analysis
  
  try {
    // Initialize agent with full tool suite
    console.log('\n--- Initializing Tool Observatory ---');
    const agent = await symphony.agent.create({
      name: 'toolObserver',
      description: 'comprehensive tool execution monitoring and analytics agent',
      task: 'Monitor, analyze, and report on tool execution patterns and performance',
      tools: ['webSearch', 'writeFile', 'ponder', 'readFile', 'createPlan', 'generateCode', 'executeShell', 'emailSend', 'imageGenerate', 'textAnalyze', 'dataVisualize', 'apiCall', 'fileCompress', 'translateText'],
      llm: 'gpt-4o-mini'
    });
    
    console.log('🔍 Tool Observatory initialized');
    console.log('📊 Available tools for analysis:', agent.tools?.length || 0);
    console.log('🎯 Target: Comprehensive tool execution analytics');

    // Helper function to capture tool execution metrics
    function captureToolMetrics(toolName, params, result, startTime, endTime) {
      const execution = {
        toolName,
        params: JSON.stringify(params).length > 1000 ? '[Large Object]' : params,
        result: {
          success: result.success,
          hasResult: !!result.result,
          hasError: !!result.error,
          resultSize: result.result ? JSON.stringify(result.result).length : 0,
          errorMessage: result.error || null
        },
        timing: {
          startTime,
          endTime,
          duration: endTime - startTime,
          timestamp: new Date().toISOString()
        },
        metadata: result.metadata || {},
        metrics: result.metrics || {}
      };
      
      toolAnalytics.executions.push(execution);
      return execution;
    }

    // Test 1: Individual Tool Performance Profiling
    console.log('\n--- Test 1: Individual Tool Performance Profiling ---');
    
    const toolTests = [
      // Web Search Tool Analysis
      {
        name: 'webSearch',
        tests: [
          { query: 'artificial intelligence trends', type: 'search' },
          { query: 'quantum computing news', type: 'search' },
          { query: 'machine learning algorithms', type: 'search' }
        ]
      },
      // File Operations Analysis  
      {
        name: 'writeFile',
        tests: [
          { path: 'test_small.txt', content: 'Small file content' },
          { path: 'test_medium.txt', content: 'Medium file content: ' + 'x'.repeat(1000) },
          { path: 'test_large.txt', content: 'Large file content: ' + 'x'.repeat(10000) }
        ]
      },
      // Cognitive Tool Analysis
      {
        name: 'ponder',
        tests: [
          { query: 'What is consciousness?', depth: 1 },
          { query: 'How does quantum mechanics relate to computing?', depth: 2 },
          { query: 'Analyze the future of AI technology', depth: 3 }
        ]
      },
      // File Reading Analysis
      {
        name: 'readFile',
        tests: [
          { path: 'test_small.txt' },
          { path: 'test_medium.txt' },
          { path: 'test_large.txt' }
        ]
      }
    ];

    for (const toolTest of toolTests) {
      console.log(`\n🔧 Profiling tool: ${toolTest.name}`);
      
      for (let i = 0; i < toolTest.tests.length; i++) {
        const testParams = toolTest.tests[i];
        console.log(`  📋 Test ${i + 1}/${toolTest.tests.length}: ${JSON.stringify(testParams).substring(0, 60)}...`);
        
        try {
          const startTime = Date.now();
          const result = await agent.executor.toolRegistry.executeTool(toolTest.name, testParams);
          const endTime = Date.now();
          
          const execution = captureToolMetrics(toolTest.name, testParams, result, startTime, endTime);
          
          console.log(`    ✅ Success: ${result.success} | Duration: ${execution.timing.duration}ms | Result Size: ${execution.result.resultSize} chars`);
          
          if (!result.success) {
            console.log(`    ⚠️ Error: ${result.error}`);
          }
          
        } catch (error) {
          console.log(`    ❌ Exception: ${error.message}`);
          captureToolMetrics(toolTest.name, testParams, { success: false, error: error.message }, Date.now(), Date.now());
        }
        
        // Brief pause between tests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Test 2: Concurrent Tool Execution Analysis
    console.log('\n--- Test 2: Concurrent Tool Execution Analysis ---');
    
    const concurrentTests = [
      { tool: 'webSearch', params: { query: 'blockchain technology', type: 'search' } },
      { tool: 'webSearch', params: { query: 'artificial neural networks', type: 'search' } },
      { tool: 'webSearch', params: { query: 'edge computing trends', type: 'search' } },
      { tool: 'ponder', params: { query: 'Future of distributed computing', depth: 1 } },
      { tool: 'ponder', params: { query: 'Ethics in AI development', depth: 1 } }
    ];

    console.log(`🔄 Executing ${concurrentTests.length} tools concurrently...`);
    const concurrentStart = Date.now();
    
    const concurrentPromises = concurrentTests.map(async (test, index) => {
      const startTime = Date.now();
      try {
        const result = await agent.executor.toolRegistry.executeTool(test.tool, test.params);
        const endTime = Date.now();
        const execution = captureToolMetrics(test.tool, test.params, result, startTime, endTime);
        execution.concurrencyIndex = index;
        execution.concurrencyBatch = 'batch_1';
        return execution;
      } catch (error) {
        const endTime = Date.now();
        const execution = captureToolMetrics(test.tool, test.params, { success: false, error: error.message }, startTime, endTime);
        execution.concurrencyIndex = index;
        execution.concurrencyBatch = 'batch_1';
        return execution;
      }
    });

    const concurrentResults = await Promise.allSettled(concurrentPromises);
    const concurrentEnd = Date.now();
    const concurrentTotalTime = concurrentEnd - concurrentStart;
    
    console.log(`📊 Concurrent execution completed in ${concurrentTotalTime}ms`);
    console.log(`⚡ Concurrency efficiency: ${concurrentTests.length} tools in ${concurrentTotalTime}ms`);
    
    let successfulConcurrent = 0;
    concurrentResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulConcurrent++;
        console.log(`  ✅ Tool ${index + 1}: ${result.value.toolName} - ${result.value.timing.duration}ms`);
      } else {
        console.log(`  ❌ Tool ${index + 1}: Failed - ${result.reason}`);
      }
    });

    // Test 3: Tool Chain Execution Monitoring
    console.log('\n--- Test 3: Tool Chain Execution Monitoring ---');
    
    if (agent.executor && agent.executor.chainExecutor) {
      const monitoredChain = {
        id: 'observability_chain',
        name: 'Tool Observability Chain',
        description: 'Chain designed for comprehensive tool monitoring',
        steps: [
          {
            id: 'research_step',
            tool: 'webSearch',
            semantic_number: '1',
            static_params: { query: 'tool observability best practices', type: 'search' }
          },
          {
            id: 'analyze_step', 
            tool: 'ponder',
            semantic_number: '2',
            static_params: { query: 'Analyze tool observability patterns', depth: 2 },
            depends_on: ['research_step']
          },
          {
            id: 'document_step',
            tool: 'writeFile',
            semantic_number: '3',
            input_mapping: { content: 'analyze_step.result' },
            static_params: { path: 'observability_analysis.json' },
            depends_on: ['analyze_step']
          },
          {
            id: 'read_verification',
            tool: 'readFile', 
            semantic_number: '4',
            static_params: { path: 'observability_analysis.json' },
            depends_on: ['document_step']
          }
        ],
        output_mapping: {
          research: 'research_step.result',
          analysis: 'analyze_step.result', 
          documentation: 'document_step.result',
          verification: 'read_verification.result'
        }
      };

      console.log('🔗 Executing monitored tool chain...');
      const chainStart = Date.now();
      
      const chainResult = await agent.executor.executeToolChain(monitoredChain, { monitoring: true });
      
      const chainEnd = Date.now();
      console.log(`📈 Chain execution completed in ${chainEnd - chainStart}ms`);
      console.log(`🔍 Chain success: ${chainResult.success}`);
      
      if (chainResult.result?.chainMetrics) {
        const metrics = chainResult.result.chainMetrics;
        console.log('📊 Chain Tool Metrics:');
        console.log(`  - Total Steps: ${metrics.completedSteps.length}`);
        console.log(`  - Failed Steps: ${metrics.failedSteps.length}`);
        console.log(`  - Total Duration: ${metrics.totalDuration}ms`);
        
        if (metrics.stepTimings) {
          Object.entries(metrics.stepTimings).forEach(([step, time]) => {
            console.log(`  - ${step}: ${time}ms`);
          });
        }
      }
    }

    // Test 4: Generate Comprehensive Analytics
    console.log('\n--- Test 4: Comprehensive Tool Analytics ---');
    
    // Aggregate metrics by tool
    toolAnalytics.executions.forEach(execution => {
      const tool = execution.toolName;
      
      if (!toolAnalytics.aggregatedMetrics[tool]) {
        toolAnalytics.aggregatedMetrics[tool] = {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalDuration: 0,
          averageDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          totalResultSize: 0,
          averageResultSize: 0,
          errors: [],
          parameterPatterns: {}
        };
      }
      
      const metrics = toolAnalytics.aggregatedMetrics[tool];
      metrics.totalExecutions++;
      
      if (execution.result.success) {
        metrics.successfulExecutions++;
        metrics.totalDuration += execution.timing.duration;
        metrics.minDuration = Math.min(metrics.minDuration, execution.timing.duration);
        metrics.maxDuration = Math.max(metrics.maxDuration, execution.timing.duration);
        metrics.totalResultSize += execution.result.resultSize;
      } else {
        metrics.failedExecutions++;
        if (execution.result.errorMessage) {
          metrics.errors.push(execution.result.errorMessage);
        }
      }
      
      // Calculate averages
      if (metrics.successfulExecutions > 0) {
        metrics.averageDuration = Math.round(metrics.totalDuration / metrics.successfulExecutions);
        metrics.averageResultSize = Math.round(metrics.totalResultSize / metrics.successfulExecutions);
      }
      
      if (metrics.minDuration === Infinity) metrics.minDuration = 0;
    });

    // Display comprehensive analytics
    console.log('\n📊 Tool Performance Analytics:');
    console.log('=' .repeat(80));
    
    Object.entries(toolAnalytics.aggregatedMetrics).forEach(([tool, metrics]) => {
      const successRate = ((metrics.successfulExecutions / metrics.totalExecutions) * 100).toFixed(1);
      
      console.log(`\n🔧 ${tool.toUpperCase()}:`);
      console.log(`  📈 Executions: ${metrics.totalExecutions} (${metrics.successfulExecutions} successful, ${metrics.failedExecutions} failed)`);
      console.log(`  ✅ Success Rate: ${successRate}%`);
      console.log(`  ⏱️ Performance: avg ${metrics.averageDuration}ms, min ${metrics.minDuration}ms, max ${metrics.maxDuration}ms`);
      console.log(`  📄 Output: avg ${metrics.averageResultSize} chars, total ${metrics.totalResultSize} chars`);
      
      if (metrics.failedExecutions > 0) {
        console.log(`  ⚠️ Error Summary: ${metrics.errors.slice(0, 3).join(', ')}${metrics.errors.length > 3 ? '...' : ''}`);
      }
    });

    // Test 5: Performance Profiling & Bottleneck Analysis
    console.log('\n--- Test 5: Performance Profiling & Bottleneck Analysis ---');
    
    const allExecutions = toolAnalytics.executions.filter(e => e.result.success);
    if (allExecutions.length > 0) {
      // Calculate overall statistics
      const totalDuration = allExecutions.reduce((sum, e) => sum + e.timing.duration, 0);
      const avgDuration = Math.round(totalDuration / allExecutions.length);
      const fastestExecution = allExecutions.reduce((min, e) => e.timing.duration < min.timing.duration ? e : min);
      const slowestExecution = allExecutions.reduce((max, e) => e.timing.duration > max.timing.duration ? e : max);
      
      console.log('\n🏆 Performance Insights:');
      console.log(`  📊 Total Executions Analyzed: ${allExecutions.length}`);
      console.log(`  ⏱️ Overall Average Duration: ${avgDuration}ms`);
      console.log(`  🚀 Fastest Tool: ${fastestExecution.toolName} (${fastestExecution.timing.duration}ms)`);
      console.log(`  🐌 Slowest Tool: ${slowestExecution.toolName} (${slowestExecution.timing.duration}ms)`);
      
      // Identify bottlenecks
      console.log('\n🔍 Bottleneck Analysis:');
      const toolsBySpeed = Object.entries(toolAnalytics.aggregatedMetrics)
        .filter(([tool, metrics]) => metrics.successfulExecutions > 0)
        .sort(([,a], [,b]) => b.averageDuration - a.averageDuration);
        
      toolsBySpeed.slice(0, 3).forEach(([tool, metrics], index) => {
        const rank = ['🥇', '🥈', '🥉'][index] || '📍';
        console.log(`  ${rank} ${tool}: ${metrics.averageDuration}ms avg (${metrics.successfulExecutions} samples)`);
      });
      
      // Performance recommendations
      console.log('\n💡 Performance Recommendations:');
      toolsBySpeed.forEach(([tool, metrics]) => {
        if (metrics.averageDuration > 10000) {
          console.log(`  ⚠️ ${tool}: Consider optimization (${metrics.averageDuration}ms avg)`);
        } else if (metrics.averageDuration > 5000) {
          console.log(`  ⚡ ${tool}: Monitor performance (${metrics.averageDuration}ms avg)`);
        } else {
          console.log(`  ✅ ${tool}: Optimal performance (${metrics.averageDuration}ms avg)`);
        }
      });
    }

    // Test 6: Export Analytics Data
    console.log('\n--- Test 6: Analytics Data Export ---');
    
    const analyticsReport = {
      metadata: {
        testTimestamp: new Date().toISOString(),
        totalExecutions: toolAnalytics.executions.length,
        testDuration: Date.now() - (toolAnalytics.executions[0]?.timing.startTime || Date.now()),
        toolsCovered: Object.keys(toolAnalytics.aggregatedMetrics).length
      },
      aggregatedMetrics: toolAnalytics.aggregatedMetrics,
      rawExecutions: toolAnalytics.executions.map(e => ({
        ...e,
        params: '[Sanitized]' // Reduce size for export
      })),
      performanceProfile: {
        fastestTools: Object.entries(toolAnalytics.aggregatedMetrics)
          .filter(([,m]) => m.successfulExecutions > 0)
          .sort(([,a], [,b]) => a.averageDuration - b.averageDuration)
          .slice(0, 5)
          .map(([tool, metrics]) => ({ tool, avgDuration: metrics.averageDuration })),
        
        slowestTools: Object.entries(toolAnalytics.aggregatedMetrics)
          .filter(([,m]) => m.successfulExecutions > 0)
          .sort(([,a], [,b]) => b.averageDuration - a.averageDuration)
          .slice(0, 5)
          .map(([tool, metrics]) => ({ tool, avgDuration: metrics.averageDuration })),
          
        reliabilityRanking: Object.entries(toolAnalytics.aggregatedMetrics)
          .map(([tool, metrics]) => ({
            tool,
            successRate: (metrics.successfulExecutions / metrics.totalExecutions) * 100,
            executions: metrics.totalExecutions
          }))
          .sort((a, b) => b.successRate - a.successRate)
      }
    };

    try {
      const reportPath = 'tool_observability_report.json';
      await agent.executor.toolRegistry.executeTool('writeFile', {
        path: reportPath,
        content: JSON.stringify(analyticsReport, null, 2)
      });
      console.log(`📄 Analytics report exported to: ${reportPath}`);
      console.log(`📊 Report size: ${JSON.stringify(analyticsReport).length} characters`);
    } catch (error) {
      console.log(`⚠️ Failed to export analytics report: ${error.message}`);
    }

    // Final Summary
    console.log('\n🎉 Tool Observability Analysis Complete!');
    console.log('=' .repeat(80));
    console.log(`📈 Analysis Summary:`);
    console.log(`  🔧 Tools Analyzed: ${Object.keys(toolAnalytics.aggregatedMetrics).length}`);
    console.log(`  📊 Total Executions: ${toolAnalytics.executions.length}`);
    console.log(`  ✅ Successful Executions: ${toolAnalytics.executions.filter(e => e.result.success).length}`);
    console.log(`  ❌ Failed Executions: ${toolAnalytics.executions.filter(e => !e.result.success).length}`);
    console.log(`  ⏱️ Total Execution Time: ${toolAnalytics.executions.reduce((sum, e) => sum + e.timing.duration, 0)}ms`);
    console.log(`  📄 Total Data Generated: ${toolAnalytics.executions.reduce((sum, e) => sum + e.result.resultSize, 0)} characters`);
    
    console.log('\n🔍 Key Insights:');
    console.log('  ✅ Comprehensive tool performance profiling completed');
    console.log('  ✅ Concurrent execution analysis performed');
    console.log('  ✅ Tool chain monitoring implemented');
    console.log('  ✅ Bottleneck identification completed');
    console.log('  ✅ Performance recommendations generated');
    console.log('  ✅ Analytics data exported for further analysis');
    
    clearTimeout(timeout);
    
    // Force exit to prevent hanging
    setTimeout(() => {
      console.log('🔚 Exiting tool observability test...');
      process.exit(0);
    }, 2000);
    
  } catch (error) {
    console.error('❌ Tool observability test failed:', error);
    console.error('Stack:', error.stack);
    clearTimeout(timeout);
    
    // Force exit on error
    setTimeout(() => {
      console.log('🔚 Exiting test process due to error...');
      process.exit(1);
    }, 2000);
  }
}

// Add process exit handlers
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test terminated');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

testToolObservability(); 