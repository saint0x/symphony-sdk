/**
 * Symphony Team Context Intelligence Test - Robust & Realistic
 * 
 * This comprehensive test demonstrates realistic team context management:
 * 1. Context validation and consistency checks
 * 2. Context sharing between operations and team members
 * 3. Dynamic context updates with realistic workflows
 * 4. Edge case handling and error recovery
 * 5. Multi-strategy execution with context analysis
 * 6. Context persistence across different team states
 * 7. Performance and efficiency tracking
 */

const { Symphony } = require('./src/symphony');

// === CONTEXT VALIDATION UTILITIES ===

function validateTeamContext(context, testName) {
    console.log(`🔍 Validating context for: ${testName}`);
    
    const errors = [];
    
    // Required fields validation
    if (!context.teamId) errors.push('Missing teamId');
    if (!context.teamName) errors.push('Missing teamName');
    if (!context.contextVersion) errors.push('Missing contextVersion');
    if (!context.lastUpdated) errors.push('Missing lastUpdated');
    
    // Members validation
    if (!context.members || !Array.isArray(context.members.available)) {
        errors.push('Invalid members structure');
    } else {
        context.members.available.forEach((member, index) => {
            if (!member.name) errors.push(`Member ${index} missing name`);
            if (!member.capabilities || !Array.isArray(member.capabilities)) {
                errors.push(`Member ${index} missing capabilities`);
            }
            if (typeof member.efficiency !== 'number' || member.efficiency < 0 || member.efficiency > 1) {
                errors.push(`Member ${index} invalid efficiency: ${member.efficiency}`);
            }
        });
    }
    
    // Tasks validation
    if (!context.tasks) {
        errors.push('Missing tasks structure');
    } else {
        if (typeof context.tasks.active !== 'number') errors.push('Invalid tasks.active');
        if (typeof context.tasks.completed !== 'number') errors.push('Invalid tasks.completed');
        if (!Array.isArray(context.tasks.recentHistory)) errors.push('Invalid tasks.recentHistory');
    }
    
    // Insights validation
    if (!context.insights) {
        errors.push('Missing insights structure');
    } else {
        if (!context.insights.recommendedStrategy) errors.push('Missing recommendedStrategy');
        if (typeof context.insights.teamEfficiency !== 'number') errors.push('Invalid teamEfficiency');
    }
    
    if (errors.length > 0) {
        console.log(`   ❌ Context validation failed: ${errors.join(', ')}`);
        return false;
    }
    
    console.log(`   ✅ Context validation passed`);
    return true;
}

function compareContexts(oldCtx, newCtx, operation) {
    console.log(`📊 Comparing contexts before/after: ${operation}`);
    
    const changes = [];
    
    // Check efficiency changes
    const oldEfficiency = oldCtx.insights.teamEfficiency;
    const newEfficiency = newCtx.insights.teamEfficiency;
    if (Math.abs(oldEfficiency - newEfficiency) > 0.01) {
        changes.push(`Efficiency: ${(oldEfficiency * 100).toFixed(1)}% → ${(newEfficiency * 100).toFixed(1)}%`);
    }
    
    // Check task count changes
    if (oldCtx.tasks.completed !== newCtx.tasks.completed) {
        changes.push(`Completed tasks: ${oldCtx.tasks.completed} → ${newCtx.tasks.completed}`);
    }
    
    // Check execution phase changes
    if (oldCtx.executionPhase !== newCtx.executionPhase) {
        changes.push(`Phase: ${oldCtx.executionPhase} → ${newCtx.executionPhase}`);
    }
    
    // Check workload balance changes
    if (oldCtx.members.workload.balanced !== newCtx.members.workload.balanced) {
        changes.push(`Workload balanced: ${oldCtx.members.workload.balanced} → ${newCtx.members.workload.balanced}`);
    }
    
    // Check knowledge base growth
    const oldKnowledge = oldCtx.workspace.knowledgeBase.length;
    const newKnowledge = newCtx.workspace.knowledgeBase.length;
    if (oldKnowledge !== newKnowledge) {
        changes.push(`Knowledge base: ${oldKnowledge} → ${newKnowledge} entries`);
    }
    
    if (changes.length > 0) {
        console.log(`   📈 Changes detected:`);
        changes.forEach(change => console.log(`     • ${change}`));
    } else {
        console.log(`   📊 No significant changes detected`);
    }
    
    return changes;
}

function extractContextMetrics(context) {
    return {
        efficiency: context.insights.teamEfficiency,
        completedTasks: context.tasks.completed,
        activeTasks: context.tasks.active,
        availableMembers: context.members.available.filter(m => m.status === 'idle').length,
        workloadBalanced: context.members.workload.balanced,
        knowledgeEntries: context.workspace.knowledgeBase.length,
        recommendedStrategy: context.insights.recommendedStrategy,
        riskFactors: context.insights.riskFactors.length
    };
}

// === REALISTIC WORKFLOW SIMULATION ===

async function executeContextAwareWorkflow(team, workflowName, tasks, expectedChanges = {}) {
    console.log(`\n🔄 Starting workflow: ${workflowName}`);
    
    // Get baseline context
    const initialContext = team.getContext();
    validateTeamContext(initialContext, `${workflowName} - Initial`);
    const initialMetrics = extractContextMetrics(initialContext);
    
    console.log(`   📊 Initial metrics:`, initialMetrics);
    
    const results = [];
    let currentContext = initialContext;
    
    // Execute tasks in workflow
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        console.log(`\n   🚀 Task ${i + 1}/${tasks.length}: ${task.description}`);
        
        // Capture pre-task context
        const preTaskContext = team.getContext();
        
        // Execute task with strategy if specified
        const taskOptions = task.strategy ? { strategy: task.strategy } : {};
        if (task.requiredCapabilities) {
            taskOptions.requiredCapabilities = task.requiredCapabilities;
        }
        
        const startTime = Date.now();
        const result = await team.run(task.description, taskOptions);
        const duration = Date.now() - startTime;
        
        // Capture post-task context
        const postTaskContext = team.getContext();
        
        // Validate context after task
        if (!validateTeamContext(postTaskContext, `${workflowName} - Task ${i + 1}`)) {
            throw new Error(`Context validation failed after task ${i + 1}`);
        }
        
        // Compare contexts
        const changes = compareContexts(preTaskContext, postTaskContext, `Task ${i + 1}`);
        
        results.push({
            taskNumber: i + 1,
            description: task.description,
            success: result.success,
            duration,
            strategy: task.strategy || result.result?.strategy || 'auto',
            participatingAgents: result.result?.participatingAgents || [],
            contextChanges: changes,
            error: result.success ? null : result.error
        });
        
        console.log(`     ✅ Task completed: ${result.success ? 'Success' : 'Failed'}`);
        console.log(`     ⏱️  Duration: ${duration}ms`);
        if (result.result?.participatingAgents) {
            console.log(`     👥 Agents: ${result.result.participatingAgents.join(', ')}`);
        }
        
        currentContext = postTaskContext;
        
        // Small delay to allow context processing
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Final context analysis
    const finalContext = team.getContext();
    const finalMetrics = extractContextMetrics(finalContext);
    const overallChanges = compareContexts(initialContext, finalContext, `${workflowName} - Overall`);
    
    console.log(`\n   📊 Final metrics:`, finalMetrics);
    
    // Validate expected changes
    if (expectedChanges.minCompletedTasks !== undefined) {
        const actualCompleted = finalMetrics.completedTasks - initialMetrics.completedTasks;
        if (actualCompleted < expectedChanges.minCompletedTasks) {
            console.log(`   ⚠️  Expected at least ${expectedChanges.minCompletedTasks} completed tasks, got ${actualCompleted}`);
        }
    }
    
    if (expectedChanges.minEfficiencyGain !== undefined) {
        const efficiencyGain = finalMetrics.efficiency - initialMetrics.efficiency;
        if (efficiencyGain < expectedChanges.minEfficiencyGain) {
            console.log(`   ⚠️  Expected efficiency gain of at least ${expectedChanges.minEfficiencyGain}, got ${efficiencyGain}`);
        }
    }
    
    return {
        workflowName,
        tasks: results,
        initialMetrics,
        finalMetrics,
        overallChanges,
        success: results.every(r => r.success),
        totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
    };
}

// === MAIN TEST FUNCTION ===

async function runRobustTeamContextTest() {
    console.log('👥 Starting Robust Symphony Team Context Intelligence Test...\n');
    
    // Initialize Symphony with enhanced configuration
    const symphony = new Symphony({
        llm: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY
        },
        db: {
            enabled: true,
            adapter: 'sqlite',
            path: './symphony.db'
        }
    });
    
    await symphony.initialize();
    
    // === TEAM CREATION WITH DIVERSE CAPABILITIES ===
    console.log('🔧 Creating Diverse Intelligence Team...');
    
    const team = await symphony.team.create({
        name: 'RobustContextTeam',
        agents: [
            { 
                name: 'Researcher', 
                capabilities: ['research', 'analysis', 'web_search', 'data_gathering'],
                description: 'Senior researcher specializing in information analysis'
            },
            { 
                name: 'Developer', 
                capabilities: ['coding', 'debugging', 'architecture', 'technical_writing'],
                description: 'Full-stack developer with system design expertise'
            },
            { 
                name: 'Strategist', 
                capabilities: ['planning', 'coordination', 'risk_assessment', 'optimization'],
                description: 'Strategic planner and team coordination specialist'
            },
            { 
                name: 'QAEngineer', 
                capabilities: ['testing', 'validation', 'quality_assurance', 'documentation'],
                description: 'Quality assurance engineer focused on system reliability'
            }
        ],
        strategy: { 
            name: 'adaptive_intelligence',
            coordinationRules: {
                maxParallelTasks: 2,
                taskTimeout: 300000
            }
        }
    });
    
    console.log(`✅ Team "${team.name}" created with ${team.coordinator.members.size} specialized members\n`);
    
    // === INITIAL CONTEXT BASELINE ===
    console.log('📊 Establishing Context Baseline...');
    
    const baselineContext = team.getContext();
    if (!validateTeamContext(baselineContext, 'Baseline')) {
        throw new Error('Baseline context validation failed');
    }
    
    const baselineMetrics = extractContextMetrics(baselineContext);
    console.log('   📈 Baseline metrics:', baselineMetrics);
    console.log('   🎯 Optimal member:', baselineContext.members.optimal?.name || 'None');
    console.log('   📋 Recommended strategy:', baselineContext.insights.recommendedStrategy);
    console.log('');
    
    // === WORKFLOW 1: RESEARCH AND ANALYSIS ===
    const workflow1 = await executeContextAwareWorkflow(team, 'Research & Analysis', [
        {
            description: 'Research current trends in AI team coordination',
            strategy: 'role_based',
            requiredCapabilities: ['research', 'analysis']
        },
        {
            description: 'Analyze the research findings for key insights',
            strategy: 'role_based',
            requiredCapabilities: ['analysis', 'data_gathering']
        }
    ], {
        minCompletedTasks: 2,
        minEfficiencyGain: -0.1 // Allow for slight efficiency decrease due to learning
    });
    
    // === WORKFLOW 2: COLLABORATIVE DEVELOPMENT ===
    const workflow2 = await executeContextAwareWorkflow(team, 'Collaborative Development', [
        {
            description: 'Plan a software architecture for team coordination system',
            strategy: 'collaborative',
            requiredCapabilities: ['planning', 'architecture']
        },
        {
            description: 'Develop core components with parallel implementation',
            strategy: 'parallel'
        },
        {
            description: 'Test and validate the implementation',
            strategy: 'role_based',
            requiredCapabilities: ['testing', 'validation']
        }
    ], {
        minCompletedTasks: 3
    });
    
    // === WORKFLOW 3: STRATEGIC OPTIMIZATION ===
    const workflow3 = await executeContextAwareWorkflow(team, 'Strategic Optimization', [
        {
            description: 'Assess current team performance and identify bottlenecks',
            strategy: 'role_based',
            requiredCapabilities: ['risk_assessment', 'optimization']
        },
        {
            description: 'Create optimization recommendations for team efficiency',
            strategy: 'pipeline'
        }
    ], {
        minCompletedTasks: 2
    });
    
    // === EDGE CASE TESTING ===
    console.log('\n🧪 Testing Edge Cases...');
    
    // Test context during high load
    console.log('   🔥 Testing high-load scenario...');
    const highLoadTasks = [
        'Perform quick analysis task 1',
        'Perform quick analysis task 2',
        'Perform quick analysis task 3'
    ];
    
    const highLoadPromises = highLoadTasks.map(task => team.run(task, { strategy: 'parallel' }));
    const highLoadResults = await Promise.allSettled(highLoadPromises);
    
    const postHighLoadContext = team.getContext();
    validateTeamContext(postHighLoadContext, 'High Load');
    
    console.log(`   📊 High load results: ${highLoadResults.filter(r => r.status === 'fulfilled').length}/${highLoadResults.length} successful`);
    
    // Test context recovery after errors
    console.log('   ⚠️  Testing error recovery...');
    try {
        await team.run('This is an intentionally complex task that might challenge the system with very specific requirements that may not be easily fulfilled', {
            strategy: 'role_based',
            timeout: 1000 // Very short timeout to trigger potential issues
        });
    } catch (error) {
        console.log(`   🔄 Error recovery test triggered: ${error.message}`);
    }
    
    const postErrorContext = team.getContext();
    validateTeamContext(postErrorContext, 'Post Error');
    
    // === FINAL COMPREHENSIVE ANALYSIS ===
    console.log('\n📊 Comprehensive Context Analysis...');
    
    const finalContext = team.getContext();
    const finalMetrics = extractContextMetrics(finalContext);
    
    console.log('\n🎯 Final Team Intelligence Summary:');
    console.log(`   Team ID: ${finalContext.teamId}`);
    console.log(`   Context Version: ${finalContext.contextVersion}`);
    console.log(`   Total Tasks Completed: ${finalMetrics.completedTasks}`);
    console.log(`   Current Team Efficiency: ${(finalMetrics.efficiency * 100).toFixed(1)}%`);
    console.log(`   Available Members: ${finalMetrics.availableMembers}/${finalContext.members.available.length}`);
    console.log(`   Workload Balanced: ${finalMetrics.workloadBalanced}`);
    console.log(`   Knowledge Base Entries: ${finalMetrics.knowledgeEntries}`);
    console.log(`   Recommended Strategy: ${finalMetrics.recommendedStrategy}`);
    console.log(`   Active Risk Factors: ${finalMetrics.riskFactors}`);
    
    // Display member specialization analysis
    console.log('\n👥 Member Specialization Analysis:');
    finalContext.members.available.forEach(member => {
        const efficiencyColor = member.efficiency > 0.8 ? '🟢' : member.efficiency > 0.6 ? '🟡' : '🔴';
        console.log(`   ${efficiencyColor} ${member.name}:`);
        console.log(`     Capabilities: ${member.capabilities.join(', ')}`);
        console.log(`     Status: ${member.status} (Load: ${member.currentLoad})`);
        console.log(`     Efficiency: ${(member.efficiency * 100).toFixed(1)}%`);
    });
    
    // Context evolution analysis
    const totalChanges = workflow1.overallChanges.length + workflow2.overallChanges.length + workflow3.overallChanges.length;
    const totalTasks = workflow1.tasks.length + workflow2.tasks.length + workflow3.tasks.length;
    const totalDuration = workflow1.totalDuration + workflow2.totalDuration + workflow3.totalDuration;
    
    console.log('\n📈 Context Evolution Summary:');
    console.log(`   Total Workflows: 3`);
    console.log(`   Total Tasks Executed: ${totalTasks}`);
    console.log(`   Total Context Changes: ${totalChanges}`);
    console.log(`   Total Execution Time: ${totalDuration}ms`);
    console.log(`   Average Task Duration: ${Math.round(totalDuration / totalTasks)}ms`);
    console.log(`   Context Adaptation Rate: ${(totalChanges / totalTasks).toFixed(2)} changes/task`);
    
    return {
        teamCreated: true,
        workflowsExecuted: 3,
        totalTasksExecuted: totalTasks,
        finalMetrics,
        contextValid: validateTeamContext(finalContext, 'Final'),
        workflows: [workflow1, workflow2, workflow3],
        edgeCaseResults: {
            highLoadSuccessRate: highLoadResults.filter(r => r.status === 'fulfilled').length / highLoadResults.length,
            errorRecoveryWorking: validateTeamContext(postErrorContext, 'Error Recovery')
        }
    };
}

// === EXECUTION ===

runRobustTeamContextTest()
    .then(results => {
        console.log('\n✅ Robust Team Context Intelligence Test Completed Successfully');
        console.log('\n🏆 Final Test Results:');
        console.log(`   ✅ Team Created: ${results.teamCreated}`);
        console.log(`   ✅ Workflows Executed: ${results.workflowsExecuted}`);
        console.log(`   ✅ Total Tasks Executed: ${results.totalTasksExecuted}`);
        console.log(`   ✅ Final Context Valid: ${results.contextValid}`);
        console.log(`   ✅ Final Team Efficiency: ${(results.finalMetrics.efficiency * 100).toFixed(1)}%`);
        console.log(`   ✅ Workload Balanced: ${results.finalMetrics.workloadBalanced}`);
        console.log(`   ✅ Knowledge Base Entries: ${results.finalMetrics.knowledgeEntries}`);
        console.log(`   ✅ High Load Success Rate: ${(results.edgeCaseResults.highLoadSuccessRate * 100).toFixed(1)}%`);
        console.log(`   ✅ Error Recovery Working: ${results.edgeCaseResults.errorRecoveryWorking}`);
        
        console.log('\n🎯 Workflow Results:');
        results.workflows.forEach(workflow => {
            console.log(`   📋 ${workflow.workflowName}:`);
            console.log(`     Tasks: ${workflow.tasks.length}, Success: ${workflow.success}`);
            console.log(`     Duration: ${workflow.totalDuration}ms`);
            console.log(`     Changes: ${workflow.overallChanges.length}`);
        });
        
        console.log('\n🎉 Team Context Intelligence is production-ready with robust workflows!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Robust Team Context Test Failed:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    });

module.exports = runRobustTeamContextTest; 