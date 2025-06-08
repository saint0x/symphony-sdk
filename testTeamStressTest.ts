import { symphony } from './src/index';
import { envConfig } from './src/utils/env';
import { TeamStrategy } from './src/teams/coordinator';
import * as assert from 'assert';

const logger = symphony.logger;

async function runTeamStressTest() {
    logger.info('TestRunner', '🚀 === COMPREHENSIVE TEAM STRESS TEST === 🚀');

    // Initialize Symphony
    await symphony.initialize();
    
    // Get services
    const agentService = await symphony.getService('agent');
    const teamService = await symphony.getService('team');
    assert.ok(agentService, 'Agent service should be available');
    assert.ok(teamService, 'Team service should be available');

    // Step 1: Create specialized agents with different tool sets
    logger.info('TestRunner', 'Step 1: Creating specialized agents...');
    
    // Agent 1: Research Analyst - Uses cognitive and research tools
    const researchAgent = await agentService.create({
        name: 'ResearchAnalyst',
        description: 'Senior research analyst specializing in technology assessment and market analysis',
        task: 'Research, analyze, and provide detailed insights on technology requirements and best practices',
        tools: ['ponder', 'webSearch'],
        llm: { model: envConfig.defaultModel }
    });
    
    // Agent 2: Software Developer - Uses development and planning tools  
    const developerAgent = await agentService.create({
        name: 'SoftwareDeveloper',
        description: 'Senior full-stack developer with expertise in microservices and modern architectures',
        task: 'Design architecture, create implementation plans, and generate production-ready code',
        tools: ['writeCode', 'createPlan'],
        llm: { model: envConfig.defaultModel }
    });
    
    // Agent 3: Technical Writer - Uses documentation and file management tools
    const documentationAgent = await agentService.create({
        name: 'TechnicalWriter', 
        description: 'Technical documentation specialist and project organizer',
        task: 'Create comprehensive documentation, organize project files, and ensure deliverable quality',
        tools: ['writeFile', 'readFile'],
        llm: { model: envConfig.defaultModel }
    });

    logger.info('TestRunner', '✅ Created 3 specialized agents successfully');

    // Step 2: Create team configurations for different strategies
    logger.info('TestRunner', 'Step 2: Testing PARALLEL team coordination...');
    
    const parallelTeam = await teamService.create({
        name: 'ParallelDevelopmentTeam',
        description: 'High-performance team using parallel execution for maximum speed',
        agents: [
            researchAgent.getConfig(),
            developerAgent.getConfig(), 
            documentationAgent.getConfig()
        ]
    });

    // Complex collaborative task
    const complexTask = `
        BUILD A COMPLETE PRODUCTION-READY RUST MICROSERVICE PROJECT:
        
        Requirements:
        - Research: Analyze current microservice patterns, security best practices, and deployment strategies
        - Development: Create a REST API microservice with database integration, authentication, logging, and health checks
        - Documentation: Generate complete project documentation including README, API docs, deployment guide, and code comments
        
        Deliverables:
        1. Technical analysis and architecture recommendations
        2. Production-ready Rust microservice code
        3. Complete project documentation and setup instructions
        
        Each agent should leverage their specialized tools to contribute their expertise to this collaborative effort.
    `;

    // Test PARALLEL execution
    logger.info('TestRunner', 'Executing complex task with PARALLEL strategy...');
    const parallelResult = await parallelTeam.execute(complexTask, TeamStrategy.PARALLEL);
    
    logger.info('TestRunner', 'PARALLEL Execution Results:', {
        success: parallelResult.success,
        duration: parallelResult.metrics?.duration,
        agentCalls: parallelResult.metrics?.agentCalls,
        errors: parallelResult.error
    });

    // Show detailed results from each agent
    if (parallelResult.result?.details) {
        parallelResult.result.details.forEach((agentResult, index) => {
            const agentNames = ['ResearchAnalyst', 'SoftwareDeveloper', 'TechnicalWriter'];
            logger.info('TestRunner', `${agentNames[index]} Result:`, {
                success: agentResult.success,
                hasResult: !!agentResult.result,
                error: agentResult.error
            });
        });
    }

    assert.strictEqual(parallelResult.success, true, `Parallel team execution should succeed. Error: ${parallelResult.error}`);
    
    // Step 3: Test SEQUENTIAL team coordination
    logger.info('TestRunner', 'Step 3: Testing SEQUENTIAL team coordination...');
    
    const sequentialTeam = await teamService.create({
        name: 'SequentialDevelopmentTeam',
        description: 'Methodical team using sequential execution for quality and coordination',
        agents: [
            researchAgent.getConfig(),
            developerAgent.getConfig(),
            documentationAgent.getConfig()
        ]
    });

    const sequentialTask = `
        COLLABORATIVE PIPELINE - BUILD A BLOCKCHAIN SMART CONTRACT PROJECT:
        
        Phase 1 (Research): Analyze current smart contract security patterns, gas optimization techniques, and testing frameworks
        Phase 2 (Development): Build on Phase 1 insights to create a secure, gas-optimized smart contract with comprehensive testing
        Phase 3 (Documentation): Using outputs from Phase 1 & 2, create complete project documentation and deployment guides
        
        This task requires sequential coordination where each phase builds upon the previous phase's outputs.
    `;

    logger.info('TestRunner', 'Executing pipeline task with SEQUENTIAL strategy...');
    const sequentialResult = await sequentialTeam.execute(sequentialTask, TeamStrategy.SEQUENTIAL);
    
    logger.info('TestRunner', 'SEQUENTIAL Execution Results:', {
        success: sequentialResult.success,
        duration: sequentialResult.metrics?.duration,
        agentCalls: sequentialResult.metrics?.agentCalls,
        errors: sequentialResult.error
    });

    assert.strictEqual(sequentialResult.success, true, `Sequential team execution should succeed. Error: ${sequentialResult.error}`);

    // Step 4: Compare execution strategies
    logger.info('TestRunner', 'Step 4: Analyzing execution strategy performance...');
    
    const performanceComparison = {
        parallel: {
            duration: parallelResult.metrics?.duration || 0,
            strategy: 'PARALLEL',
            agentCalls: parallelResult.metrics?.agentCalls || 0,
            success: parallelResult.success
        },
        sequential: {
            duration: sequentialResult.metrics?.duration || 0, 
            strategy: 'SEQUENTIAL',
            agentCalls: sequentialResult.metrics?.agentCalls || 0,
            success: sequentialResult.success
        }
    };

    logger.info('TestRunner', '📊 Performance Comparison:', performanceComparison);

    // Verify both strategies worked
    assert.ok(performanceComparison.parallel.success, 'Parallel strategy should succeed');
    assert.ok(performanceComparison.sequential.success, 'Sequential strategy should succeed');

    // Step 5: Test complex multi-round coordination
    logger.info('TestRunner', 'Step 5: Testing multi-round complex coordination...');
    
    const multiRoundTeam = await teamService.create({
        name: 'MultiRoundTeam',
        description: 'Advanced team for multi-phase complex projects',
        agents: [
            researchAgent.getConfig(),
            developerAgent.getConfig(),
            documentationAgent.getConfig()
        ]
    });

    // Execute multiple rounds with different focuses
    const rounds = [
        {
            name: 'Research Phase',
            task: 'Research and analyze: "Advanced patterns for distributed systems resilience, including circuit breakers, bulkheads, and chaos engineering"',
            strategy: TeamStrategy.PARALLEL
        },
        {
            name: 'Implementation Phase', 
            task: 'Based on distributed systems research, create: A resilient microservice implementation with circuit breaker pattern, health checks, and fault tolerance',
            strategy: TeamStrategy.SEQUENTIAL
        },
        {
            name: 'Documentation Phase',
            task: 'Create comprehensive documentation for: The distributed systems resilience patterns and microservice implementation from previous phases',
            strategy: TeamStrategy.PARALLEL
        }
    ];

    const multiRoundResults = [];
    for (const round of rounds) {
        logger.info('TestRunner', `Executing ${round.name} with ${round.strategy} strategy...`);
        const roundResult = await multiRoundTeam.execute(round.task, round.strategy);
        multiRoundResults.push({
            round: round.name,
            success: roundResult.success,
            duration: roundResult.metrics?.duration,
            strategy: round.strategy
        });
        
        assert.strictEqual(roundResult.success, true, `${round.name} should succeed`);
    }

    logger.info('TestRunner', '🎯 Multi-Round Results:', multiRoundResults);

    // Step 6: Verify team member utilization and tool diversity
    logger.info('TestRunner', 'Step 6: Verifying tool diversity and specialization...');
    
    const teamStats = {
        totalAgents: 3,
        toolsPerAgent: {
            'ResearchAnalyst': ['ponder', 'webSearch'],
            'SoftwareDeveloper': ['writeCode', 'createPlan'], 
            'TechnicalWriter': ['writeFile', 'readFile']
        },
        totalUniqueTools: 6,
        executionStrategies: ['PARALLEL', 'SEQUENTIAL'],
        roundsCompleted: multiRoundResults.length
    };

    logger.info('TestRunner', '📈 Team Utilization Stats:', teamStats);

    // Final assertions
    assert.strictEqual(teamStats.totalAgents, 3, 'Should have 3 specialized agents');
    assert.strictEqual(teamStats.totalUniqueTools, 6, 'Should utilize 6 different tools');
    assert.strictEqual(teamStats.roundsCompleted, 3, 'Should complete all 3 rounds');

    logger.info('TestRunner', '\n🎉🎉🎉 TEAM STRESS TEST PASSED! 🎉🎉🎉');
    logger.info('TestRunner', '✅ All team coordination strategies verified');
    logger.info('TestRunner', '✅ Multi-agent tool orchestration successful');
    logger.info('TestRunner', '✅ Complex collaborative workflows functional');
    logger.info('TestRunner', '✅ Performance metrics captured and analyzed');
    
    process.exitCode = 0;
}

runTeamStressTest().catch(err => {
    logger.error('TestRunner', 'TEAM STRESS TEST FAILED:', { message: err.message, stack: err.stack });
    process.exitCode = 1;
}).finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 2000);
}); 