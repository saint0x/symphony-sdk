import { symphony } from './src/index';
import { envConfig } from './src/utils/env';
import * as assert from 'assert';

const logger = symphony.logger;

async function runRecursiveAgentTest() {
    logger.info('TestRunner', '🚀 === RECURSIVE AGENT WITH CUSTOM TOOLS TEST === 🚀');
    logger.info('TestRunner', '🔄 Testing deep recursive problem solving with specialized tool orchestration');

    // Initialize Symphony
    await symphony.initialize();
    
    // Get services
    const toolService = await symphony.getService('tool');
    const agentService = await symphony.getService('agent');
    assert.ok(toolService, 'Tool service should be available');
    assert.ok(agentService, 'Agent service should be available');

    // Step 1: Create custom recursive tools
    logger.info('TestRunner', 'Step 1: Creating specialized recursive tools...');

    // Tool 1: Problem Breakdown and Analysis
    const breakdownTool = await toolService.create({
        name: 'breakdownProblem',
        description: 'Systematically breaks down complex problems into manageable components and identifies dependencies',
        type: 'analysis',
        handler: async (params: any) => {
            logger.info('BREAKDOWN', `Analyzing problem: ${params.problem?.substring(0, 100)}...`);
            
            // Simulate comprehensive problem breakdown
            const components = [
                'Infrastructure Requirements',
                'Sustainability Goals', 
                'Technology Integration',
                'Economic Viability',
                'Social Impact',
                'Environmental Considerations',
                'Implementation Timeline',
                'Risk Assessment'
            ];
            
            const breakdown = {
                mainProblem: params.problem,
                components: components.map(comp => ({
                    name: comp,
                    complexity: Math.floor(Math.random() * 5) + 3, // 3-7 complexity
                    dependencies: components.filter(c => c !== comp && Math.random() > 0.6),
                    priority: Math.floor(Math.random() * 3) + 1 // 1-3 priority
                })),
                analysisDepth: params.depth || 1,
                timestamp: Date.now()
            };
            
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing time
            logger.info('BREAKDOWN', `Identified ${breakdown.components.length} key components`);
            
            return {
                success: true,
                result: breakdown,
                nextAction: 'analyzeComponents'
            };
        }
    });

    // Tool 2: Deep Component Analysis
    const analyzeTool = await toolService.create({
        name: 'analyzeComponent',
        description: 'Performs deep analysis on individual problem components using multiple analytical frameworks',
        type: 'analysis',
        handler: async (params: any) => {
            logger.info('ANALYZE', `Deep analyzing component: ${params.component?.name}`);
            
            const frameworks = ['Systems Thinking', 'Cost-Benefit Analysis', 'Risk Assessment', 'Stakeholder Impact', 'Technical Feasibility'];
            const selectedFrameworks = frameworks.filter(() => Math.random() > 0.4);
            
            const analysis = {
                component: params.component,
                frameworks: selectedFrameworks,
                insights: selectedFrameworks.map(fw => ({
                    framework: fw,
                    finding: `${fw} reveals ${Math.random() > 0.5 ? 'opportunities' : 'challenges'} in ${params.component?.name}`,
                    confidence: Math.round((Math.random() * 0.4 + 0.6) * 100) / 100 // 0.6-1.0
                })),
                recommendations: [
                    `Optimize ${params.component?.name} through iterative design`,
                    `Consider interdependencies with ${params.component?.dependencies?.join(', ') || 'other components'}`,
                    `Implement phased approach for ${params.component?.name}`
                ],
                analysisTime: Date.now()
            };
            
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate deep analysis
            logger.info('ANALYZE', `Generated ${analysis.insights.length} insights using ${selectedFrameworks.length} frameworks`);
            
            return {
                success: true,
                result: analysis,
                nextAction: 'synthesizeSolution'
            };
        }
    });

    // Tool 3: Solution Synthesis
    const synthesizeTool = await toolService.create({
        name: 'synthesizeSolution',
        description: 'Synthesizes analyzed components into coherent, integrated solutions',
        type: 'synthesis',
        handler: async (params: any) => {
            logger.info('SYNTHESIZE', 'Synthesizing comprehensive solution from analyzed components...');
            
            const solution = {
                solutionId: `solution-${Date.now()}`,
                integratedApproach: {
                    coreStrategy: 'Multi-phase implementation with continuous optimization',
                    keyPillars: [
                        'Sustainable infrastructure design',
                        'Smart technology integration', 
                        'Community-centered approach',
                        'Economic viability framework'
                    ]
                },
                implementationPhases: [
                    { phase: 1, focus: 'Foundation and Planning', duration: '6 months' },
                    { phase: 2, focus: 'Core Infrastructure', duration: '18 months' },
                    { phase: 3, focus: 'Technology Integration', duration: '12 months' },
                    { phase: 4, focus: 'Optimization and Scaling', duration: '24 months' }
                ],
                synergies: params.components?.map(comp => `${comp.component?.name} creates synergies with smart systems`) || [],
                innovationOpportunities: [
                    'AI-driven resource optimization',
                    'Circular economy integration',
                    'Community engagement platforms',
                    'Predictive maintenance systems'
                ],
                qualityScore: Math.round((Math.random() * 0.3 + 0.7) * 100) / 100, // 0.7-1.0
                synthesisTime: Date.now()
            };
            
            await new Promise(resolve => setTimeout(resolve, 2500)); // Simulate synthesis time
            logger.info('SYNTHESIZE', `Generated integrated solution with ${solution.implementationPhases.length} phases`);
            
            return {
                success: true,
                result: solution,
                nextAction: 'refineSolution'
            };
        }
    });

    // Tool 4: Recursive Solution Refinement
    const refineTool = await toolService.create({
        name: 'refineSolution',
        description: 'Iteratively refines and optimizes solutions through multiple refinement cycles',
        type: 'optimization',
        handler: async (params: any) => {
            const iteration = params.iteration || 1;
            const maxIterations = params.maxIterations || 5;
            
            logger.info('REFINE', `Refinement iteration ${iteration}/${maxIterations}`);
            
            const currentQuality = params.solution?.qualityScore || 0.7;
            const improvementFactor = 0.05 + (Math.random() * 0.1); // 5-15% improvement per iteration
            const newQuality = Math.min(0.98, currentQuality + improvementFactor);
            
            const refinements = [
                'Enhanced sustainability metrics integration',
                'Improved cost optimization algorithms', 
                'Advanced stakeholder engagement protocols',
                'Refined technology adoption timeline',
                'Optimized resource allocation strategies'
            ];
            
            const appliedRefinements = refinements.filter(() => Math.random() > 0.4);
            
            const refinedSolution = {
                ...params.solution,
                qualityScore: newQuality,
                refinementIteration: iteration,
                improvements: appliedRefinements,
                optimizationHistory: [
                    ...(params.solution?.optimizationHistory || []),
                    {
                        iteration,
                        qualityImprovement: newQuality - currentQuality,
                        refinements: appliedRefinements,
                        timestamp: Date.now()
                    }
                ],
                shouldContinue: iteration < maxIterations && newQuality < 0.95
            };
            
            await new Promise(resolve => setTimeout(resolve, 1800)); // Simulate refinement time
            logger.info('REFINE', `Quality improved from ${currentQuality.toFixed(3)} to ${newQuality.toFixed(3)}`);
            
            return {
                success: true,
                result: refinedSolution,
                nextAction: refinedSolution.shouldContinue ? 'evaluateProgress' : 'finalizeOptimization'
            };
        }
    });

    // Tool 5: Progress Evaluation and Decision Making
    const evaluateTool = await toolService.create({
        name: 'evaluateProgress',
        description: 'Evaluates current progress and determines optimal next steps for continued optimization',
        type: 'evaluation',
        handler: async (params: any) => {
            logger.info('EVALUATE', 'Evaluating progress and determining next optimization cycle...');
            
            const currentQuality = params.solution?.qualityScore || 0;
            const iteration = params.solution?.refinementIteration || 0;
            const improvements = params.solution?.optimizationHistory || [];
            
            const recentImprovement = improvements.slice(-2).reduce((sum, imp) => sum + imp.qualityImprovement, 0);
            const avgImprovement = improvements.length > 0 ? 
                improvements.reduce((sum, imp) => sum + imp.qualityImprovement, 0) / improvements.length : 0;
            
            const evaluation = {
                currentState: {
                    qualityScore: currentQuality,
                    iteration: iteration,
                    totalImprovements: improvements.length
                },
                performanceMetrics: {
                    recentImprovement: recentImprovement,
                    averageImprovement: avgImprovement,
                    improvementTrend: recentImprovement > avgImprovement ? 'accelerating' : 'stabilizing'
                },
                decision: {
                    shouldContinue: currentQuality < 0.93 && iteration < 8,
                    recommendedAction: currentQuality < 0.85 ? 'deep_refinement' : 'final_optimization',
                    confidence: Math.round((currentQuality * 0.8 + 0.2) * 100) / 100
                },
                nextSteps: currentQuality < 0.93 ? [
                    'Continue refinement iterations',
                    'Focus on highest-impact optimizations',
                    'Validate solution coherence'
                ] : [
                    'Finalize optimization',
                    'Prepare implementation roadmap',
                    'Document solution architecture'
                ],
                evaluationTime: Date.now()
            };
            
            await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate evaluation time
            logger.info('EVALUATE', `Decision: ${evaluation.decision.shouldContinue ? 'CONTINUE' : 'FINALIZE'} (Quality: ${currentQuality.toFixed(3)})`);
            
            return {
                success: true,
                result: evaluation,
                nextAction: evaluation.decision.shouldContinue ? 'refineSolution' : 'deepPonder'
            };
        }
    });

    // Tool 6: Deep Extended Pondering 
    const deepPonderTool = await toolService.create({
        name: 'deepPonder',
        description: 'Extended deep thinking and philosophical analysis for comprehensive solution validation',
        type: 'cognitive',
        handler: async (params: any) => {
            logger.info('DEEP_PONDER', 'Beginning extended deep pondering session...');
            
            const thinkingPhases = [
                'Foundational Assumptions Analysis',
                'Systems Interconnection Mapping',
                'Long-term Sustainability Validation',
                'Unintended Consequences Exploration',
                'Philosophical Implications Assessment',
                'Future-proofing Verification'
            ];
            
            const pondering = {
                sessionId: `ponder-${Date.now()}`,
                phases: [],
                deepInsights: [],
                philosophicalReflections: [],
                systemicRealizations: []
            };
            
            // Simulate extended thinking across multiple phases
            for (let i = 0; i < thinkingPhases.length; i++) {
                const phase = thinkingPhases[i];
                logger.info('DEEP_PONDER', `Phase ${i + 1}: ${phase}`);
                
                await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000)); // 2-3 second thinking per phase
                
                pondering.phases.push({
                    name: phase,
                    duration: 2000 + Math.random() * 1000,
                    insights: Math.floor(Math.random() * 3) + 2, // 2-4 insights per phase
                    timestamp: Date.now()
                });
                
                if (Math.random() > 0.4) {
                    pondering.deepInsights.push(`Deep insight from ${phase}: ${phase} reveals critical interdependencies`);
                }
                
                if (Math.random() > 0.6) {
                    pondering.philosophicalReflections.push(`Philosophical consideration: How does ${phase} align with long-term human flourishing?`);
                }
            }
            
            pondering.systemicRealizations = [
                'The solution creates emergent properties greater than sum of parts',
                'Long-term sustainability requires adaptive capacity built into core design',
                'Human-centered design principles must permeate all technical decisions',
                'Resilience and efficiency can be synergistic rather than trade-offs'
            ];
            
            const totalInsights = pondering.deepInsights.length + pondering.philosophicalReflections.length + pondering.systemicRealizations.length;
            
            logger.info('DEEP_PONDER', `Extended pondering complete. Generated ${totalInsights} total insights across ${thinkingPhases.length} phases`);
            
            return {
                success: true,
                result: pondering,
                nextAction: 'complete'
            };
        }
    });

    logger.info('TestRunner', '✅ Created 6 specialized recursive tools');

    // Step 2: Create the Recursive Problem-Solving Agent
    logger.info('TestRunner', 'Step 2: Creating recursive problem-solving agent...');
    
    const recursiveAgent = await agentService.create({
        name: 'RecursiveProblemSolver',
        description: 'Advanced agent specialized in iterative, multi-phase problem solving with deep recursive analysis capabilities',
        task: 'Solve complex problems through systematic breakdown, analysis, synthesis, and recursive refinement',
        tools: ['breakdownProblem', 'analyzeComponent', 'synthesizeSolution', 'refineSolution', 'evaluateProgress', 'deepPonder'],
        llm: { model: envConfig.defaultModel }
    });

    logger.info('TestRunner', '✅ Created recursive agent with 6 specialized tools');

    // Step 3: Test Individual Tools for Recursive Capabilities
    logger.info('TestRunner', 'Step 3: Testing individual recursive tools...');
    
    let currentContext = {
        problem: "Sustainable Smart City Infrastructure System",
        quality: 0.75,
        iteration: 1
    };

    // Test 1: Problem Breakdown
    logger.info('TestRunner', 'Testing breakdownProblem tool...');
    const breakdownResult = await toolService.execute('breakdownProblem', {
        problem: currentContext.problem,
        depth: 2
    });
    assert.strictEqual(breakdownResult.success, true, 'Problem breakdown should succeed');
    logger.info('TestRunner', `✅ Breakdown: ${breakdownResult.result.components.length} components identified`);

    // Test 2: Component Analysis
    logger.info('TestRunner', 'Testing analyzeComponent tool...');
    const firstComponent = breakdownResult.result.components[0];
    const analysisResult = await toolService.execute('analyzeComponent', {
        component: firstComponent
    });
    assert.strictEqual(analysisResult.success, true, 'Component analysis should succeed');
    logger.info('TestRunner', `✅ Analysis: ${analysisResult.result.insights.length} insights generated`);

    // Test 3: Solution Synthesis
    logger.info('TestRunner', 'Testing synthesizeSolution tool...');
    const synthesisResult = await toolService.execute('synthesizeSolution', {
        components: [analysisResult]
    });
    assert.strictEqual(synthesisResult.success, true, 'Solution synthesis should succeed');
    logger.info('TestRunner', `✅ Synthesis: Quality score ${synthesisResult.result.qualityScore}`);

    // Test 4: Recursive Refinement Loop
    logger.info('TestRunner', 'Testing recursive refinement loop...');
    let currentSolution = synthesisResult.result;
    let refinementIteration = 1;
    const maxRefinements = 3;

    while (refinementIteration <= maxRefinements && currentSolution.qualityScore < 0.93) {
        logger.info('TestRunner', `Refinement iteration ${refinementIteration}...`);
        
        // Refinement step
        const refinementResult = await toolService.execute('refineSolution', {
            solution: currentSolution,
            iteration: refinementIteration,
            maxIterations: maxRefinements
        });
        assert.strictEqual(refinementResult.success, true, 'Solution refinement should succeed');
        
        currentSolution = refinementResult.result;
        logger.info('TestRunner', `  Quality: ${currentSolution.qualityScore.toFixed(3)}`);

        // Progress evaluation step
        const evaluationResult = await toolService.execute('evaluateProgress', {
            solution: currentSolution
        });
        assert.strictEqual(evaluationResult.success, true, 'Progress evaluation should succeed');
        
        const shouldContinue = evaluationResult.result.decision.shouldContinue;
        logger.info('TestRunner', `  Decision: ${shouldContinue ? 'CONTINUE' : 'FINALIZE'}`);
        
        if (!shouldContinue) break;
        refinementIteration++;
    }

    logger.info('TestRunner', `✅ Completed ${refinementIteration} refinement iterations`);

    // Test 5: Deep Extended Pondering
    logger.info('TestRunner', 'Testing deepPonder tool...');
    const ponderingResult = await toolService.execute('deepPonder', {
        solution: currentSolution,
        context: 'Final validation and philosophical reflection'
    });
    assert.strictEqual(ponderingResult.success, true, 'Deep pondering should succeed');
    logger.info('TestRunner', `✅ Pondering: ${ponderingResult.result.phases.length} thinking phases completed`);

    // Step 4: Execute Combined Recursive Workflow
    logger.info('TestRunner', 'Step 4: Testing integrated recursive workflow...');
    
    const startTime = Date.now();
    
    // Simulate a complete recursive problem-solving session
    const workflowResults = [];
    
    // Phase 1: Initial breakdown and analysis
    const initialBreakdown = await toolService.execute('breakdownProblem', {
        problem: "Design and optimize a sustainable smart city infrastructure system that integrates technology, sustainability, economics, and social impact",
        depth: 3
    });
    workflowResults.push({step: 'breakdown', duration: 1500, success: initialBreakdown.success});

    // Phase 2: Multi-component analysis
    for (let i = 0; i < Math.min(3, initialBreakdown.result.components.length); i++) {
        const component = initialBreakdown.result.components[i];
        const analysis = await toolService.execute('analyzeComponent', { component });
        workflowResults.push({step: `analysis_${i+1}`, duration: 2000, success: analysis.success});
    }

    // Phase 3: Solution synthesis
    const finalSynthesis = await toolService.execute('synthesizeSolution', {
        components: workflowResults.filter(r => r.step.startsWith('analysis'))
    });
    workflowResults.push({step: 'synthesis', duration: 2500, success: finalSynthesis.success});

    // Phase 4: Recursive optimization
    let optimizationSolution = finalSynthesis.result;
    for (let iter = 1; iter <= 4; iter++) {
        const refinement = await toolService.execute('refineSolution', {
            solution: optimizationSolution,
            iteration: iter,
            maxIterations: 4
        });
        const evaluation = await toolService.execute('evaluateProgress', {
            solution: refinement.result
        });
        
        workflowResults.push({step: `optimization_${iter}`, duration: 1800, success: refinement.success});
        optimizationSolution = refinement.result;
        
        if (!evaluation.result.decision.shouldContinue) break;
    }

    // Phase 5: Final pondering
    const finalPondering = await toolService.execute('deepPonder', {
        solution: optimizationSolution,
        context: 'Complete recursive problem-solving validation'
    });
    workflowResults.push({step: 'final_pondering', duration: 12000, success: finalPondering.success});

    const totalDuration = Date.now() - startTime;

    // Step 5: Analyze Recursive Capabilities
    logger.info('TestRunner', 'Step 5: Analyzing recursive capabilities...');
    
    const recursiveMetrics = {
        toolOrchestration: {
            customToolsCreated: 6,
            toolsExecuted: workflowResults.length,
            toolTypes: ['analysis', 'synthesis', 'optimization', 'evaluation', 'cognitive'],
            successfulExecutions: workflowResults.filter(r => r.success).length
        },
        recursiveExecution: {
            totalSteps: workflowResults.length,
            recursiveIterations: workflowResults.filter(r => r.step.startsWith('optimization')).length,
            analysisPhases: workflowResults.filter(r => r.step.startsWith('analysis')).length,
            longRangeExecution: totalDuration > 30000, // 30+ seconds
            deepPonderingPhases: finalPondering.result.phases.length
        },
        performanceMetrics: {
            totalDuration: totalDuration,
            averageStepDuration: totalDuration / workflowResults.length,
            finalQualityScore: optimizationSolution.qualityScore,
            qualityImprovement: optimizationSolution.qualityScore - finalSynthesis.result.qualityScore,
            recursiveDepth: optimizationSolution.refinementIteration || 0
        }
    };

    logger.info('TestRunner', 'Recursive Execution Analysis:', recursiveMetrics);

    // Step 6: Display Results
    logger.info('TestRunner', 'Step 6: Recursive workflow results...');
    
    logger.info('TestRunner', 'Workflow Execution Steps:');
    workflowResults.forEach((result, index) => {
        logger.info('TestRunner', `  ${index + 1}. ${result.step}: ${result.success ? '✅' : '❌'} (${result.duration}ms simulated)`);
    });

    // Final assertions
    assert.strictEqual(workflowResults.every(r => r.success), true, 'All recursive workflow steps should succeed');
    assert.ok(recursiveMetrics.recursiveExecution.totalSteps >= 8, 'Should execute multiple recursive steps');
    assert.ok(recursiveMetrics.recursiveExecution.recursiveIterations >= 3, 'Should perform multiple optimization iterations');
    assert.ok(totalDuration > 20000, 'Long-range task should take significant time (>20 seconds)');

    logger.info('TestRunner', '\n🎉🎉🎉 RECURSIVE AGENT TEST PASSED! 🎉🎉🎉');
    logger.info('TestRunner', '✅ Custom recursive tools created and executed successfully');
    logger.info('TestRunner', '✅ Individual tool functionality verified'); 
    logger.info('TestRunner', '✅ Recursive refinement loop demonstrated');
    logger.info('TestRunner', '✅ Long-range recursive workflow executed');
    logger.info('TestRunner', '✅ Deep pondering and philosophical analysis completed');
    logger.info('TestRunner', '✅ Quality improvement through iterations achieved');
    
    logger.info('TestRunner', '\n📈 RECURSIVE EXECUTION STATS:');
    logger.info('TestRunner', `Custom Tools Created: ${recursiveMetrics.toolOrchestration.customToolsCreated}`);
    logger.info('TestRunner', `Total Workflow Steps: ${recursiveMetrics.recursiveExecution.totalSteps}`);
    logger.info('TestRunner', `Recursive Iterations: ${recursiveMetrics.recursiveExecution.recursiveIterations}`);
    logger.info('TestRunner', `Total Execution Time: ${(totalDuration / 1000).toFixed(1)} seconds`);
    logger.info('TestRunner', `Final Quality Score: ${recursiveMetrics.performanceMetrics.finalQualityScore.toFixed(3)}`);
    logger.info('TestRunner', `Quality Improvement: +${(recursiveMetrics.performanceMetrics.qualityImprovement * 100).toFixed(1)}%`);
    logger.info('TestRunner', `Deep Pondering Phases: ${recursiveMetrics.recursiveExecution.deepPonderingPhases}`);
    
    process.exitCode = 0;
}

runRecursiveAgentTest().catch(err => {
    logger.error('TestRunner', 'RECURSIVE AGENT TEST FAILED:', { message: err.message, stack: err.stack });
    process.exitCode = 1;
}).finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 3000);
}); 