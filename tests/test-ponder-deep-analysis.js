const { symphony } = require('../dist/index.js');
const fs = require('fs').promises;
const path = require('path');

async function testPonderDeepAnalysis() {
  console.log('\n=== Ponder Tool Deep Analysis & LLM Forcing Test ===');
  
  // Create ponder directory for content analysis
  const ponderDir = path.join(process.cwd(), 'ponder');
  try {
    await fs.mkdir(ponderDir, { recursive: true });
    console.log(`📁 Created ponder directory: ${ponderDir}`);
  } catch (error) {
    console.log(`📁 Ponder directory already exists or error: ${error.message}`);
  }
  
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

    // Helper function to save ponder content to files
    async function savePonderContent(query, depth, result, context, testIndex) {
      if (result.success && result.result) {
        const filename = `${String(testIndex).padStart(2, '0')}_${context}_depth${depth}.json`;
        const filepath = path.join(ponderDir, filename);
        
        const contentAnalysis = {
          metadata: {
            query,
            depth,
            context,
            timestamp: new Date().toISOString(),
            testIndex
          },
          fullPonderResult: result.result,
          thoughtsBreakdown: result.result.thoughts?.map(thought => ({
            depth: thought.depth,
            pattern: thought.pattern,
            observation: thought.observation,
            analysis: thought.analysis,
            synthesis: thought.synthesis,
            implication: thought.implication,
            metacognition: thought.metacognition,
            insights: thought.insights,
            confidence: thought.confidence
          })) || [],
          conclusionDetails: {
            summary: result.result.conclusion?.summary || '',
            keyInsights: result.result.conclusion?.keyInsights || [],
            implications: result.result.conclusion?.implications || '',
            uncertainties: result.result.conclusion?.uncertainties || '',
            nextSteps: result.result.conclusion?.nextSteps || [],
            confidence: result.result.conclusion?.confidence || 0
          },
          metaAnalysisDetails: {
            patternsCovered: result.result.metaAnalysis?.patternsCovered || [],
            depthReached: result.result.metaAnalysis?.depthReached || 0,
            insightCount: result.result.metaAnalysis?.insightCount || 0,
            confidenceDistribution: result.result.metaAnalysis?.confidenceDistribution || [],
            thinkingEvolution: result.result.metaAnalysis?.thinkingEvolution || []
          }
        };
        
        await fs.writeFile(filepath, JSON.stringify(contentAnalysis, null, 2));
        console.log(`💾 Saved ponder content: ${filename}`);
        return filepath;
      }
      return null;
    }

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
      { query: 'What is consciousness?', depth: 1, context: 'consciousness_simple', filename: 'consciousness1' },
      { query: 'What is consciousness?', depth: 2, context: 'consciousness_medium', filename: 'consciousness2' },
      { query: 'What is consciousness?', depth: 3, context: 'consciousness_deep', filename: 'consciousness3' },
      { query: 'How does quantum mechanics relate to computing?', depth: 1, context: 'quantum_simple', filename: 'quantum1' },
      { query: 'How does quantum mechanics relate to computing?', depth: 2, context: 'quantum_medium', filename: 'quantum2' },
      { query: 'How does quantum mechanics relate to computing?', depth: 3, context: 'quantum_deep', filename: 'quantum3' }
    ];

    for (let i = 0; i < depthTests.length; i++) {
      const test = depthTests[i];
      console.log(`\n🧠 Testing: "${test.query}" at depth ${test.depth} (${test.context})`);
      
      try {
        const startTime = Date.now();
        const result = await agent.executor.toolRegistry.executeTool('ponder', {
          query: test.query,
          depth: test.depth
        });
        const endTime = Date.now();
        
        // Save the full ponder content to file
        await savePonderContent(test.query, test.depth, result, test.context, i + 1);
        
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
      { query: 'Analyze market trends in AI', depth: 2, context: 'business', filename: 'business' },
      { query: 'Explain the ethical implications of artificial intelligence', depth: 2, context: 'ethics', filename: 'ethics' },
      { query: 'Design a solution for climate change', depth: 2, context: 'climate', filename: 'climate' }
    ];

    for (let i = 0; i < contextTests.length; i++) {
      const test = contextTests[i];
      console.log(`\n🎭 Context Test: "${test.query}" (${test.context})`);
      
      try {
        const startTime = Date.now();
        const result = await agent.executor.toolRegistry.executeTool('ponder', {
          query: test.query,
          depth: test.depth
        });
        const endTime = Date.now();
        
        // Save the full ponder content to file
        await savePonderContent(test.query, test.depth, result, test.context, depthTests.length + i + 1);
        
        const execution = capturePonderMetrics(test.query, test.depth, result, startTime, endTime, test.context);
        
        console.log(`    ⏱️ Duration: ${execution.timing.duration}ms | Size: ${execution.result.resultSize} chars`);
        console.log(`    🧩 Patterns: ${execution.analysis.thinkingPatternsUsed.length} | Insights: ${execution.analysis.insightCount}`);
        
      } catch (error) {
        console.log(`    ❌ Context test failed: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Create summary index file
    console.log('\n--- Creating Ponder Content Index ---');
    
    const indexContent = {
      testSummary: {
        timestamp: new Date().toISOString(),
        totalTests: depthTests.length + contextTests.length,
        testCategories: {
          depthProgression: depthTests.map((t, i) => ({
            index: i + 1,
            filename: `${String(i + 1).padStart(2, '0')}_${t.context}_depth${t.depth}.json`,
            query: t.query,
            depth: t.depth,
            context: t.context
          })),
          contextSensitivity: contextTests.map((t, i) => ({
            index: depthTests.length + i + 1,
            filename: `${String(depthTests.length + i + 1).padStart(2, '0')}_${t.context}_depth${t.depth}.json`,
            query: t.query,
            depth: t.depth,
            context: t.context
          }))
        }
      },
      quickAccess: {
        consciousness: [
          '01_consciousness_simple_depth1.json',
          '02_consciousness_medium_depth2.json', 
          '03_consciousness_deep_depth3.json'
        ],
        quantum: [
          '04_quantum_simple_depth1.json',
          '05_quantum_medium_depth2.json',
          '06_quantum_deep_depth3.json'
        ],
        contexts: [
          '07_business_depth2.json',
          '08_ethics_depth2.json',
          '09_climate_depth2.json'
        ]
      },
      instructions: {
        howToRead: "Each file contains the complete ponder output including thoughts, insights, conclusions, and meta-analysis",
        structure: "Files are named: {index}_{context}_{depth}.json for easy browsing",
        keyContent: [
          "thoughtsBreakdown: Detailed thinking at each depth level",
          "conclusionDetails: Final synthesis and key insights",
          "metaAnalysisDetails: Performance metrics and thinking evolution"
        ]
      }
    };
    
    const indexPath = path.join(ponderDir, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(indexContent, null, 2));
    console.log(`📋 Created content index: index.json`);

    // Export analytics as before
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
      const reportPath = 'ponder_deep_analysis_report_new.json';
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
    console.log(`📁 All ponder content saved to: ${ponderDir}`);
    console.log(`📋 View index.json for organized access to all thinking content`);
    console.log(`📈 Analysis Summary:`);
    console.log(`  🧠 Total Ponder Executions: ${ponderAnalytics.executions.length}`);
    console.log(`  ✅ Successful Executions: ${ponderAnalytics.executions.filter(e => e.result.success).length}`);
    console.log(`  🧩 Structured Thinking Rate: ${((ponderAnalytics.executions.filter(e => e.analysis.structuredThinking).length / ponderAnalytics.executions.length) * 100).toFixed(1)}%`);
    console.log(`  ⏱️ Average Processing Time: ${Math.round(ponderAnalytics.executions.reduce((sum, e) => sum + e.timing.duration, 0) / ponderAnalytics.executions.length)}ms`);
    
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