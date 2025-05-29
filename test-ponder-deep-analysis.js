const { symphony } = require('./dist/index.js');

async function testPonderDeepAnalysis() {
  console.log('\n=== Ponder Tool Deep Analysis & LLM Forcing Test ===');
  
  // Ponder-specific analytics collector
  const ponderAnalytics = {
    executions: [],
    thinkingPatterns: {},
    llmRedirectionMetrics: {},
    outputQualityAnalysis: {},
    depthPerformance: {},
    contextualBehavior: {}
  };

  // Set a timeout for comprehensive analysis
  const timeout = setTimeout(() => {
    console.log('\n⏰ Ponder analysis timeout reached - forcing exit');
    process.exit(1);
  }, 900000); // 15 minutes for deep analysis
  
  try {
    // Initialize agent focused on ponder capabilities
    console.log('\n--- Initializing Ponder Analysis Agent ---');
    const agent = await symphony.agent.create({
      name: 'ponderAnalyst',
      description: 'specialized agent for deep analysis of ponder tool LLM forcing behavior',
      task: 'Analyze and monitor ponder tool thinking patterns and LLM redirection effectiveness',
      tools: ['ponder', 'writeFile', 'readFile'],
      llm: 'gpt-4o-mini'
    });
    
    console.log('🧠 Ponder Analysis Agent initialized');
    console.log('🎯 Focus: LLM forcing mechanisms and thinking pattern quality');

    // Helper function to capture detailed ponder metrics
    function capturePonderMetrics(query, depth, result, startTime, endTime, context) {
      const execution = {
        query,
        depth,
        context,
        result: {
          success: result.success,
          hasResult: !!result.result,
          resultSize: result.result ? JSON.stringify(result.result).length : 0,
          error: result.error || null
        },
        timing: {
          startTime,
          endTime,
          duration: endTime - startTime,
          timestamp: new Date().toISOString()
        },
        analysis: {
          thinkingPatternsUsed: [],
          depthReached: 0,
          insightCount: 0,
          confidenceScores: [],
          llmCallCount: 0,
          structuredThinking: false
        }
      };

      // Analyze the result structure if successful - FIXED LOGIC
      if (result.success && result.result) {
        try {
          // The ponder tool returns: { success: true, result: { thoughts, conclusion, metaAnalysis } }
          const ponderResult = result.result;
          
          console.log(`[ANALYTICS] Parsing ponder result structure...`);
          console.log(`[ANALYTICS] Has thoughts: ${!!ponderResult.thoughts}`);
          console.log(`[ANALYTICS] Has metaAnalysis: ${!!ponderResult.metaAnalysis}`);
          
          // Extract thinking patterns from thoughts array
          if (ponderResult.thoughts && Array.isArray(ponderResult.thoughts)) {
            console.log(`[ANALYTICS] Found ${ponderResult.thoughts.length} thoughts`);
            
            execution.analysis.thinkingPatternsUsed = ponderResult.thoughts.map(t => t.pattern || 'unknown');
            execution.analysis.depthReached = Math.max(...ponderResult.thoughts.map(t => t.depth || 0));
            execution.analysis.insightCount = ponderResult.thoughts.reduce((sum, t) => sum + (t.insights?.length || 0), 0);
            execution.analysis.confidenceScores = ponderResult.thoughts.map(t => t.confidence || 0);
            execution.analysis.structuredThinking = true;
            
            console.log(`[ANALYTICS] Extracted: patterns=${execution.analysis.thinkingPatternsUsed.length}, depth=${execution.analysis.depthReached}, insights=${execution.analysis.insightCount}`);
          } else {
            console.log(`[ANALYTICS] No thoughts array found or invalid structure`);
          }

          // Extract meta-analysis data
          if (ponderResult.metaAnalysis) {
            console.log(`[ANALYTICS] Found metaAnalysis with ${ponderResult.metaAnalysis.patternsCovered?.length || 0} patterns covered`);
            
            execution.analysis.patternsCovered = ponderResult.metaAnalysis.patternsCovered || [];
            execution.analysis.thinkingEvolution = ponderResult.metaAnalysis.thinkingEvolution || [];
            
            // More accurate LLM call count from metaAnalysis
            if (ponderResult.metaAnalysis.depthReached !== undefined) {
              execution.analysis.llmCallCount = (ponderResult.metaAnalysis.depthReached + 1) * 2 + 1; // More accurate estimate
            }
          }

          // Extract conclusion insights if available
          if (ponderResult.conclusion && ponderResult.conclusion.keyInsights) {
            console.log(`[ANALYTICS] Found conclusion with ${ponderResult.conclusion.keyInsights.length} key insights`);
            execution.analysis.insightCount += ponderResult.conclusion.keyInsights.length;
          }
          
        } catch (parseError) {
          console.log(`[ANALYTICS] ⚠️ Could not parse ponder result for analysis: ${parseError.message}`);
          console.log(`[ANALYTICS] Result structure:`, JSON.stringify(result, null, 2).substring(0, 500));
        }
      } else {
        console.log(`[ANALYTICS] Result not successful or no result data`);
      }
      
      ponderAnalytics.executions.push(execution);
      return execution;
    }

    // Test 1: Thinking Pattern Analysis Across Depths
    console.log('\n--- Test 1: Thinking Pattern Analysis Across Depths ---');
    
    const depthTests = [
      { query: 'What is consciousness?', depth: 1, context: 'philosophical_simple' },
      { query: 'What is consciousness?', depth: 2, context: 'philosophical_medium' },
      { query: 'What is consciousness?', depth: 3, context: 'philosophical_deep' },
      { query: 'How does quantum mechanics relate to computing?', depth: 1, context: 'technical_simple' },
      { query: 'How does quantum mechanics relate to computing?', depth: 2, context: 'technical_medium' },
      { query: 'How does quantum mechanics relate to computing?', depth: 3, context: 'technical_deep' }
    ];

    for (const test of depthTests) {
      console.log(`\n🧠 Testing: "${test.query}" at depth ${test.depth} (${test.context})`);
      
      try {
        const startTime = Date.now();
        const result = await agent.executor.toolRegistry.executeTool('ponder', {
          query: test.query,
          depth: test.depth
        });
        const endTime = Date.now();
        
        const execution = capturePonderMetrics(test.query, test.depth, result, startTime, endTime, test.context);
        
        console.log(`    ✅ Success: ${result.success} | Duration: ${execution.timing.duration}ms`);
        console.log(`    🎯 Thinking Patterns: ${execution.analysis.thinkingPatternsUsed.join(', ')}`);
        console.log(`    📊 Depth Reached: ${execution.analysis.depthReached} | Insights: ${execution.analysis.insightCount}`);
        console.log(`    🔄 LLM Calls: ${execution.analysis.llmCallCount} | Structured: ${execution.analysis.structuredThinking}`);
        
        if (execution.analysis.confidenceScores.length > 0) {
          const avgConfidence = execution.analysis.confidenceScores.reduce((a, b) => a + b, 0) / execution.analysis.confidenceScores.length;
          console.log(`    📈 Avg Confidence: ${avgConfidence.toFixed(2)}`);
        }
        
      } catch (error) {
        console.log(`    ❌ Exception: ${error.message}`);
        capturePonderMetrics(test.query, test.depth, { success: false, error: error.message }, Date.now(), Date.now(), test.context);
      }
      
      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Test 2: Context Sensitivity Analysis
    console.log('\n--- Test 2: Context Sensitivity Analysis ---');
    
    const contextTests = [
      { query: 'Analyze market trends in AI', depth: 2, context: 'business_analysis' },
      { query: 'Explain the ethical implications of artificial intelligence', depth: 2, context: 'ethical_reasoning' },
      { query: 'Design a solution for climate change', depth: 2, context: 'problem_solving' },
      { query: 'Compare different programming paradigms', depth: 2, context: 'technical_comparison' },
      { query: 'What makes a great leader?', depth: 2, context: 'leadership_philosophy' },
      { query: 'How can we improve education systems?', depth: 2, context: 'system_design' }
    ];

    for (const test of contextTests) {
      console.log(`\n🎭 Context Test: "${test.query}" (${test.context})`);
      
      try {
        const startTime = Date.now();
        const result = await agent.executor.toolRegistry.executeTool('ponder', {
          query: test.query,
          depth: test.depth
        });
        const endTime = Date.now();
        
        const execution = capturePonderMetrics(test.query, test.depth, result, startTime, endTime, test.context);
        
        console.log(`    ⏱️ Duration: ${execution.timing.duration}ms | Size: ${execution.result.resultSize} chars`);
        console.log(`    🧩 Patterns: ${execution.analysis.thinkingPatternsUsed.length} | Insights: ${execution.analysis.insightCount}`);
        
      } catch (error) {
        console.log(`    ❌ Context test failed: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Test 3: LLM Forcing Mechanism Analysis
    console.log('\n--- Test 3: LLM Forcing Mechanism Analysis ---');
    
    const forcingTests = [
      { 
        query: 'Simple question: What is 2+2?', 
        depth: 1, 
        context: 'simple_math',
        expectation: 'Should force complex thinking even for simple questions'
      },
      { 
        query: 'Complex question: How might consciousness emerge from neural networks?', 
        depth: 1, 
        context: 'complex_philosophical',
        expectation: 'Should handle complex questions with appropriate depth'
      },
      { 
        query: 'Ambiguous question: What is the best way?', 
        depth: 2, 
        context: 'ambiguous_query',
        expectation: 'Should clarify ambiguity through structured thinking'
      }
    ];

    for (const test of forcingTests) {
      console.log(`\n🔧 LLM Forcing Test: "${test.query}"`);
      console.log(`    🎯 Expectation: ${test.expectation}`);
      
      try {
        const startTime = Date.now();
        const result = await agent.executor.toolRegistry.executeTool('ponder', {
          query: test.query,
          depth: test.depth
        });
        const endTime = Date.now();
        
        const execution = capturePonderMetrics(test.query, test.depth, result, startTime, endTime, test.context);
        
        console.log(`    📊 Analysis:`);
        console.log(`      - Duration: ${execution.timing.duration}ms (complexity indicator)`);
        console.log(`      - Structured Output: ${execution.analysis.structuredThinking ? 'YES' : 'NO'}`);
        console.log(`      - Thinking Patterns: ${execution.analysis.thinkingPatternsUsed.length}`);
        console.log(`      - LLM Redirections: ${execution.analysis.llmCallCount}`);
        console.log(`      - Forced Depth: ${execution.analysis.depthReached} (requested: ${test.depth})`);
        
        // Check if ponder actually forced complex thinking
        if (execution.timing.duration < 5000 && test.context === 'simple_math') {
          console.log(`    ⚠️ WARNING: May not have forced sufficient complexity for simple question`);
        }
        
        if (!execution.analysis.structuredThinking) {
          console.log(`    ⚠️ WARNING: No structured thinking detected - may indicate poor LLM forcing`);
        }
        
      } catch (error) {
        console.log(`    ❌ LLM forcing test failed: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Test 4: Concurrent Ponder Analysis
    console.log('\n--- Test 4: Concurrent Ponder Execution Analysis ---');
    
    const concurrentQueries = [
      { query: 'What is artificial intelligence?', depth: 1, context: 'concurrent_ai' },
      { query: 'What is machine learning?', depth: 1, context: 'concurrent_ml' },
      { query: 'What is deep learning?', depth: 1, context: 'concurrent_dl' }
    ];

    console.log(`🔄 Executing ${concurrentQueries.length} ponder operations concurrently...`);
    const concurrentStart = Date.now();
    
    const concurrentPromises = concurrentQueries.map(async (test, index) => {
      const startTime = Date.now();
      try {
        const result = await agent.executor.toolRegistry.executeTool('ponder', test);
        const endTime = Date.now();
        const execution = capturePonderMetrics(test.query, test.depth, result, startTime, endTime, test.context);
        execution.concurrencyIndex = index;
        return execution;
      } catch (error) {
        const endTime = Date.now();
        const execution = capturePonderMetrics(test.query, test.depth, { success: false, error: error.message }, startTime, endTime, test.context);
        execution.concurrencyIndex = index;
        return execution;
      }
    });

    const concurrentResults = await Promise.allSettled(concurrentPromises);
    const concurrentEnd = Date.now();
    const concurrentTotalTime = concurrentEnd - concurrentStart;
    
    console.log(`📊 Concurrent ponder analysis completed in ${concurrentTotalTime}ms`);
    
    let successfulConcurrent = 0;
    concurrentResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulConcurrent++;
        const execution = result.value;
        console.log(`  ✅ Ponder ${index + 1}: ${execution.timing.duration}ms | Patterns: ${execution.analysis.thinkingPatternsUsed.length}`);
      } else {
        console.log(`  ❌ Ponder ${index + 1}: Failed - ${result.reason}`);
      }
    });

    // Test 5: Output Quality and Structure Analysis
    console.log('\n--- Test 5: Output Quality and Structure Analysis ---');
    
    if (ponderAnalytics.executions.length > 0) {
      // Analyze all successful executions
      const successful = ponderAnalytics.executions.filter(e => e.result.success);
      
      if (successful.length > 0) {
        console.log('\n📊 Ponder Tool Quality Analysis:');
        console.log('=' .repeat(80));
        
        // Overall metrics
        const avgDuration = Math.round(successful.reduce((sum, e) => sum + e.timing.duration, 0) / successful.length);
        const avgResultSize = Math.round(successful.reduce((sum, e) => sum + e.result.resultSize, 0) / successful.length);
        const structuredCount = successful.filter(e => e.analysis.structuredThinking).length;
        const structuredRate = ((structuredCount / successful.length) * 100).toFixed(1);
        
        console.log(`\n🎯 Overall Ponder Performance:`);
        console.log(`  📊 Total Executions: ${ponderAnalytics.executions.length} (${successful.length} successful)`);
        console.log(`  ⏱️ Average Duration: ${avgDuration}ms`);
        console.log(`  📄 Average Output Size: ${avgResultSize} characters`);
        console.log(`  🧩 Structured Thinking Rate: ${structuredRate}%`);
        
        // Depth analysis
        console.log(`\n📈 Depth Performance Analysis:`);
        [1, 2, 3].forEach(depth => {
          const depthExecutions = successful.filter(e => e.depth === depth);
          if (depthExecutions.length > 0) {
            const avgDepthDuration = Math.round(depthExecutions.reduce((sum, e) => sum + e.timing.duration, 0) / depthExecutions.length);
            const avgDepthInsights = Math.round(depthExecutions.reduce((sum, e) => sum + e.analysis.insightCount, 0) / depthExecutions.length);
            console.log(`  🔍 Depth ${depth}: ${avgDepthDuration}ms avg, ${avgDepthInsights} insights avg (${depthExecutions.length} samples)`);
          }
        });
        
        // Context analysis
        console.log(`\n🎭 Context Performance Analysis:`);
        const contextGroups = {};
        successful.forEach(e => {
          if (!contextGroups[e.context]) {
            contextGroups[e.context] = [];
          }
          contextGroups[e.context].push(e);
        });
        
        Object.entries(contextGroups).forEach(([context, executions]) => {
          const avgContextDuration = Math.round(executions.reduce((sum, e) => sum + e.timing.duration, 0) / executions.length);
          const avgPatterns = Math.round(executions.reduce((sum, e) => sum + e.analysis.thinkingPatternsUsed.length, 0) / executions.length);
          console.log(`  🎭 ${context}: ${avgContextDuration}ms avg, ${avgPatterns} patterns avg (${executions.length} samples)`);
        });
        
        // Pattern usage analysis
        console.log(`\n🧠 Thinking Pattern Usage:`);
        const patternCounts = {};
        successful.forEach(e => {
          e.analysis.thinkingPatternsUsed.forEach(pattern => {
            patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
          });
        });
        
        const sortedPatterns = Object.entries(patternCounts).sort(([,a], [,b]) => b - a);
        sortedPatterns.forEach(([pattern, count]) => {
          const percentage = ((count / successful.length) * 100).toFixed(1);
          console.log(`  🎯 ${pattern}: ${count} uses (${percentage}%)`);
        });
        
        // Quality indicators
        console.log(`\n💡 Quality Indicators:`);
        const avgConfidence = successful
          .filter(e => e.analysis.confidenceScores.length > 0)
          .reduce((sum, e) => {
            const execAvg = e.analysis.confidenceScores.reduce((a, b) => a + b, 0) / e.analysis.confidenceScores.length;
            return sum + execAvg;
          }, 0) / successful.filter(e => e.analysis.confidenceScores.length > 0).length;
          
        if (!isNaN(avgConfidence)) {
          console.log(`  📈 Average Confidence Score: ${avgConfidence.toFixed(3)}`);
        }
        
        const totalInsights = successful.reduce((sum, e) => sum + e.analysis.insightCount, 0);
        console.log(`  💡 Total Insights Generated: ${totalInsights}`);
        console.log(`  🎯 Insights per Execution: ${(totalInsights / successful.length).toFixed(1)}`);
      }
    }

    // Test 6: Export Ponder Analytics
    console.log('\n--- Test 6: Ponder Analytics Export ---');
    
    const ponderReport = {
      metadata: {
        testTimestamp: new Date().toISOString(),
        totalExecutions: ponderAnalytics.executions.length,
        successfulExecutions: ponderAnalytics.executions.filter(e => e.result.success).length,
        testDuration: Date.now() - (ponderAnalytics.executions[0]?.timing.startTime || Date.now())
      },
      executionDetails: ponderAnalytics.executions,
      qualityAnalysis: {
        structuredThinkingRate: ((ponderAnalytics.executions.filter(e => e.analysis.structuredThinking).length / ponderAnalytics.executions.length) * 100),
        averageDuration: ponderAnalytics.executions.reduce((sum, e) => sum + e.timing.duration, 0) / ponderAnalytics.executions.length,
        averageInsights: ponderAnalytics.executions.reduce((sum, e) => sum + e.analysis.insightCount, 0) / ponderAnalytics.executions.length,
        patternDistribution: {}
      },
      recommendations: []
    };

    // Add pattern distribution
    ponderAnalytics.executions.forEach(e => {
      e.analysis.thinkingPatternsUsed.forEach(pattern => {
        ponderReport.qualityAnalysis.patternDistribution[pattern] = (ponderReport.qualityAnalysis.patternDistribution[pattern] || 0) + 1;
      });
    });

    // Generate recommendations
    if (ponderReport.qualityAnalysis.structuredThinkingRate < 80) {
      ponderReport.recommendations.push('CRITICAL: Structured thinking rate below 80% - LLM forcing may need improvement');
    }
    
    if (ponderReport.qualityAnalysis.averageDuration < 10000) {
      ponderReport.recommendations.push('WARNING: Average duration suggests shallow processing - consider increasing complexity requirements');
    }
    
    if (ponderReport.qualityAnalysis.averageInsights < 1) {
      ponderReport.recommendations.push('CONCERN: Low insight generation - review thinking pattern effectiveness');
    }

    try {
      const reportPath = 'ponder_deep_analysis_report.json';
      await agent.executor.toolRegistry.executeTool('writeFile', {
        path: reportPath,
        content: JSON.stringify(ponderReport, null, 2)
      });
      console.log(`📄 Ponder analysis report exported to: ${reportPath}`);
      console.log(`📊 Report size: ${JSON.stringify(ponderReport).length} characters`);
    } catch (error) {
      console.log(`⚠️ Failed to export ponder report: ${error.message}`);
    }

    // Final Assessment
    console.log('\n🎉 Ponder Tool Deep Analysis Complete!');
    console.log('=' .repeat(80));
    console.log(`📈 Analysis Summary:`);
    console.log(`  🧠 Total Ponder Executions: ${ponderAnalytics.executions.length}`);
    console.log(`  ✅ Successful Executions: ${ponderAnalytics.executions.filter(e => e.result.success).length}`);
    console.log(`  🧩 Structured Thinking Rate: ${((ponderAnalytics.executions.filter(e => e.analysis.structuredThinking).length / ponderAnalytics.executions.length) * 100).toFixed(1)}%`);
    console.log(`  ⏱️ Average Processing Time: ${Math.round(ponderAnalytics.executions.reduce((sum, e) => sum + e.timing.duration, 0) / ponderAnalytics.executions.length)}ms`);
    
    // Critical assessment
    console.log('\n🔍 Critical Assessment:');
    const structuredRate = (ponderAnalytics.executions.filter(e => e.analysis.structuredThinking).length / ponderAnalytics.executions.length) * 100;
    const avgDuration = ponderAnalytics.executions.reduce((sum, e) => sum + e.timing.duration, 0) / ponderAnalytics.executions.length;
    
    if (structuredRate >= 90) {
      console.log('  ✅ EXCELLENT: High structured thinking rate - LLM forcing working well');
    } else if (structuredRate >= 70) {
      console.log('  ⚡ GOOD: Acceptable structured thinking rate - minor improvements needed');
    } else {
      console.log('  ⚠️ CRITICAL: Low structured thinking rate - LLM forcing needs significant improvement');
    }
    
    if (avgDuration >= 15000) {
      console.log('  ✅ EXCELLENT: Deep processing time indicates thorough analysis');
    } else if (avgDuration >= 8000) {
      console.log('  ⚡ GOOD: Adequate processing time for complexity');
    } else {
      console.log('  ⚠️ CONCERN: Short processing time may indicate shallow analysis');
    }
    
    clearTimeout(timeout);
    
    // Force exit to prevent hanging
    setTimeout(() => {
      console.log('🔚 Exiting ponder deep analysis...');
      process.exit(0);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Ponder deep analysis failed:', error);
    console.error('Stack:', error.stack);
    clearTimeout(timeout);
    
    // Force exit on error
    setTimeout(() => {
      console.log('🔚 Exiting test process due to error...');
      process.exit(1);
    }, 3000);
  }
}

// Add process exit handlers
process.on('SIGINT', () => {
  console.log('\n🛑 Ponder analysis interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Ponder analysis terminated');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception in ponder analysis:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection in ponder analysis:', promise, 'reason:', reason);
  process.exit(1);
});

testPonderDeepAnalysis(); 