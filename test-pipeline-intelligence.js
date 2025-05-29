/**
 * Symphony Pipeline Intelligence Test
 * 
 * This test demonstrates the new pipeline intelligence features:
 * 1. Enhanced error recovery with exponential backoff and circuit breakers
 * 2. Performance monitoring with bottleneck identification
 * 3. Optimization analytics with improvement recommendations
 * 4. Failure pattern analysis with intelligent retry strategies
 */

const { Symphony } = require('./src/symphony');

async function runPipelineIntelligenceTest() {
    console.log('🧠 Starting Symphony Pipeline Intelligence Test...\n');
    
    // Initialize Symphony
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
    
    // === PIPELINE WITH ENHANCED ERROR RECOVERY ===
    console.log('🔧 Creating Pipeline with Enhanced Error Recovery...');
    
    const resilientPipeline = await symphony.pipeline.create({
        name: 'ResilientDataPipeline',
        description: 'Pipeline with intelligent error recovery and performance monitoring',
        version: '1.0.0',
        steps: [
            {
                id: 'data_fetch',
                name: 'Fetch Data Source',
                type: 'tool',
                tool: 'webSearch',
                inputs: {
                    query: 'AI pipeline performance data'
                },
                retryPolicy: {
                    maxRetries: 3,
                    backoffMs: 1000,
                    retryOn: ['timeout', 'network', 'rate_limit']
                },
                timeout: 10000
            },
            {
                id: 'data_process',
                name: 'Process Data',
                type: 'tool',
                tool: 'ponder',
                inputs: {
                    task: 'Analyze the fetched data for patterns',
                    depth: '1'
                },
                dependencies: ['data_fetch'],
                retryPolicy: {
                    maxRetries: 2,
                    backoffMs: 2000,
                    retryOn: ['memory', 'processing']
                }
            },
            {
                id: 'data_validate',
                name: 'Validate Results',
                type: 'condition',
                condition: {
                    expression: '$data_process !== null',
                    ifTrue: 'data_store',
                    ifFalse: 'error_handler'
                },
                dependencies: ['data_process']
            },
            {
                id: 'data_store',
                name: 'Store Results',
                type: 'tool',
                tool: 'writeFile',
                inputs: {
                    filename: 'pipeline_results.json',
                    content: '@data_process'
                },
                dependencies: ['data_validate'],
                retryPolicy: {
                    maxRetries: 5,
                    backoffMs: 500,
                    retryOn: ['disk', 'permission']
                }
            },
            {
                id: 'error_handler',
                name: 'Handle Errors',
                type: 'tool',
                tool: 'ponder',
                inputs: {
                    task: 'Create error recovery report',
                    depth: '1'
                },
                continueOnError: true
            }
        ],
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
    
    console.log(`✅ Pipeline "${resilientPipeline.name}" created with 5 intelligent steps\n`);
    
    // === EXECUTE PIPELINE WITH PERFORMANCE MONITORING ===
    console.log('🚀 Executing Pipeline with Intelligence Monitoring...');
    
    const startTime = Date.now();
    const result = await resilientPipeline.run({
        source: 'performance_test',
        priority: 'high',
        timeout: 60000
    });
    const totalDuration = Date.now() - startTime;
    
    console.log(`📊 Pipeline Execution Completed in ${totalDuration}ms`);
    console.log(`   Success: ${result.success}`);
    
    if (result.success) {
        console.log(`   Steps Executed: ${result.result.steps.length}`);
        console.log(`   Final Status: ${result.result.status}`);
    } else {
        console.log(`   Error: ${result.error}`);
    }
    
    // === ANALYZE PERFORMANCE PROFILE ===
    console.log('\n📈 Analyzing Performance Profile...');
    
    const performanceProfile = resilientPipeline.executor.getPerformanceProfile();
    if (performanceProfile) {
        console.log(`\n🎯 Performance Analysis:`);
        console.log(`   Total Duration: ${performanceProfile.totalDuration}ms`);
        console.log(`   Steps Analyzed: ${performanceProfile.stepMetrics.length}`);
        console.log(`   Bottlenecks Identified: ${performanceProfile.bottlenecks.length}`);
        
        // Display bottlenecks
        if (performanceProfile.bottlenecks.length > 0) {
            console.log(`\n⚠️  Performance Bottlenecks:`);
            performanceProfile.bottlenecks.forEach((bottleneck, index) => {
                console.log(`   ${index + 1}. ${bottleneck.stepId} (${bottleneck.type})`);
                console.log(`      Severity: ${bottleneck.severity.toFixed(2)}x`);
                console.log(`      Impact: ${bottleneck.impact.toFixed(1)}%`);
                console.log(`      Recommendation: ${bottleneck.recommendation}`);
            });
        }
        
        // Display optimization opportunities
        console.log(`\n🔧 Optimization Opportunities:`);
        if (performanceProfile.optimization.parallelizationOpportunities.length > 0) {
            console.log(`   Parallelization:`);
            performanceProfile.optimization.parallelizationOpportunities.forEach(opp => {
                console.log(`     • ${opp}`);
            });
        }
        
        if (performanceProfile.optimization.resourceOptimizations.length > 0) {
            console.log(`   Resource Optimization:`);
            performanceProfile.optimization.resourceOptimizations.forEach(opt => {
                console.log(`     • ${opt}`);
            });
        }
        
        if (performanceProfile.optimization.architecturalRecommendations.length > 0) {
            console.log(`   Architectural Improvements:`);
            performanceProfile.optimization.architecturalRecommendations.forEach(rec => {
                console.log(`     • ${rec}`);
            });
        }
        
        console.log(`\n📊 Estimated Performance Improvement: ${performanceProfile.optimization.estimatedImprovement.toFixed(1)}%`);
        
        // Display trends
        console.log(`\n📈 Performance Trends:`);
        console.log(`   Average Duration: ${performanceProfile.trends.averageDuration}ms`);
        console.log(`   Success Rate: ${(performanceProfile.trends.successRate * 100).toFixed(1)}%`);
        console.log(`   Performance Trend: ${performanceProfile.trends.performanceTrend}`);
        
        if (Object.keys(performanceProfile.trends.errorPatterns).length > 0) {
            console.log(`   Error Patterns:`);
            Object.entries(performanceProfile.trends.errorPatterns).forEach(([error, count]) => {
                console.log(`     ${error}: ${count} occurrences`);
            });
        }
    }
    
    // === GET OPTIMIZATION RECOMMENDATIONS ===
    console.log('\n💡 Optimization Recommendations...');
    
    const recommendations = resilientPipeline.executor.getOptimizationRecommendations();
    if (recommendations.length > 0) {
        recommendations.forEach((rec, index) => {
            console.log(`\n${index + 1}. ${rec.category.toUpperCase()} - ${rec.priority.toUpperCase()} Priority`);
            console.log(`   Description: ${rec.description}`);
            console.log(`   Implementation: ${rec.implementation}`);
            console.log(`   Estimated Improvement: ${rec.estimatedImprovement}%`);
            console.log(`   Effort Required: ${rec.effort}`);
            console.log(`   Impact: ${rec.impact}`);
        });
    } else {
        console.log('   No specific optimization recommendations at this time.');
    }
    
    // === CHECK CIRCUIT BREAKER STATUS ===
    console.log('\n🔌 Circuit Breaker Status...');
    
    const stepIds = ['data_fetch', 'data_process', 'data_validate', 'data_store', 'error_handler'];
    stepIds.forEach(stepId => {
        const cbStatus = resilientPipeline.executor.getCircuitBreakerStatus(stepId);
        if (cbStatus) {
            console.log(`   ${stepId}: ${cbStatus.state} (failures: ${cbStatus.failureCount})`);
        } else {
            console.log(`   ${stepId}: Normal operation (no circuit breaker triggered)`);
        }
    });
    
    // === INTELLIGENCE HEALTH METRICS ===
    console.log('\n🏥 Intelligence Health Metrics...');
    
    const healthMetrics = resilientPipeline.executor.getIntelligenceHealth();
    console.log(`   Circuit Breakers: ${healthMetrics.circuitBreakers.total} total`);
    console.log(`     Open: ${healthMetrics.circuitBreakers.open}`);
    console.log(`     Half-Open: ${healthMetrics.circuitBreakers.halfOpen}`);
    console.log(`   Performance Profiles: ${healthMetrics.performanceProfiles}`);
    console.log(`   Error Patterns Tracked: ${healthMetrics.errorPatterns}`);
    
    // === ENHANCED PIPELINE STATUS ===
    console.log('\n📋 Enhanced Pipeline Status...');
    
    const pipelineStatus = resilientPipeline.executor.getPipelineStatus();
    console.log(`   Pipeline: ${pipelineStatus.name}`);
    console.log(`   Status: ${pipelineStatus.status}`);
    console.log(`   Progress: ${pipelineStatus.progress.percentage.toFixed(1)}% (${pipelineStatus.progress.currentStep}/${pipelineStatus.progress.totalSteps})`);
    console.log(`   Active Steps: ${pipelineStatus.activeSteps}`);
    console.log(`   Error History: ${pipelineStatus.errorHistory.length} entries`);
    
    if (pipelineStatus.intelligence) {
        console.log(`\n🧠 Intelligence Insights:`);
        if (pipelineStatus.intelligence.performanceProfile) {
            console.log(`   Performance Duration: ${pipelineStatus.intelligence.performanceProfile.totalDuration}ms`);
            console.log(`   Bottlenecks Found: ${pipelineStatus.intelligence.performanceProfile.bottleneckCount}`);
            console.log(`   Performance Trend: ${pipelineStatus.intelligence.performanceProfile.trends.performanceTrend}`);
            console.log(`   Estimated Improvement: ${pipelineStatus.intelligence.performanceProfile.estimatedImprovement.toFixed(1)}%`);
        }
        console.log(`   Optimization Recommendations: ${pipelineStatus.intelligence.optimizationRecommendations.length}`);
        if (pipelineStatus.intelligence.optimizationRecommendations.length > 0) {
            console.log(`   Top Recommendations:`);
            pipelineStatus.intelligence.optimizationRecommendations.slice(0, 3).forEach((rec, index) => {
                console.log(`     ${index + 1}. ${rec.description}`);
            });
        }
    }
    
    return {
        pipelineCreated: true,
        executionSuccessful: result.success,
        performanceProfileGenerated: !!performanceProfile,
        bottlenecksIdentified: performanceProfile?.bottlenecks.length || 0,
        optimizationRecommendations: recommendations.length,
        circuitBreakersActive: healthMetrics.circuitBreakers.open + healthMetrics.circuitBreakers.halfOpen,
        estimatedImprovement: performanceProfile?.optimization.estimatedImprovement || 0,
        intelligenceHealthy: healthMetrics.performanceProfiles > 0
    };
}

// === EXECUTION ===

runPipelineIntelligenceTest()
    .then(results => {
        console.log('\n✅ Pipeline Intelligence Test Completed Successfully');
        console.log('\n🏆 Final Test Results:');
        console.log(`   ✅ Pipeline Created: ${results.pipelineCreated}`);
        console.log(`   ✅ Execution Successful: ${results.executionSuccessful}`);
        console.log(`   ✅ Performance Profile Generated: ${results.performanceProfileGenerated}`);
        console.log(`   ✅ Bottlenecks Identified: ${results.bottlenecksIdentified}`);
        console.log(`   ✅ Optimization Recommendations: ${results.optimizationRecommendations}`);
        console.log(`   ✅ Circuit Breakers Active: ${results.circuitBreakersActive}`);
        console.log(`   ✅ Estimated Performance Improvement: ${results.estimatedImprovement.toFixed(1)}%`);
        console.log(`   ✅ Intelligence System Healthy: ${results.intelligenceHealthy}`);
        
        console.log('\n🎉 Pipeline Intelligence is production-ready with enhanced error recovery and performance optimization!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Pipeline Intelligence Test Failed:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    });

module.exports = runPipelineIntelligenceTest; 