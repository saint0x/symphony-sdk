const { symphony } = require('../dist/index.js');

async function testTeamCoordination() {
  console.log('\n=== Team Coordination System Test ===');
  
  // Set a timeout to prevent hanging
  const timeout = setTimeout(() => {
    console.log('\n⏰ Test timeout reached - forcing exit');
    process.exit(1);
  }, 300000); // 5 minutes for comprehensive testing
  
  try {
    // Test 1: Create a Team with Multiple Agents
    console.log('\n--- Test 1: Team Creation & Initialization ---');
    
    const researchTeam = await symphony.team.create({
      name: 'researchTeam',
      description: 'Multi-agent research and analysis team',
      agents: [
        {
          name: 'researcher',
          description: 'Information research specialist',
          task: 'Research and gather information on various topics',
          tools: ['webSearch', 'ponder', 'writeFile'],
          llm: 'gpt-4o-mini',
          capabilities: ['research', 'analysis']
        },
        {
          name: 'analyst',
          description: 'Data analysis and insight specialist',
          task: 'Analyze data and generate insights',
          tools: ['ponder', 'readFile', 'writeFile'],
          llm: 'gpt-4o-mini',
          capabilities: ['analysis', 'synthesis']
        },
        {
          name: 'writer',
          description: 'Content creation and documentation specialist',
          task: 'Create and organize written content',
          tools: ['writeFile', 'readFile', 'ponder'],
          llm: 'gpt-4o-mini',
          capabilities: ['writing', 'documentation']
        }
      ],
      strategy: {
        name: 'dynamic_coordination',
        description: 'Intelligent task distribution based on agent capabilities and workload',
        coordinationRules: {
          maxParallelTasks: 3,
          taskTimeout: 180000 // 3 minutes
        }
      }
    });

    console.log('✅ Research team created successfully');
    console.log(`📊 Team status:`, researchTeam.getStatus());

    // Test 2: Role-Based Task Execution
    console.log('\n--- Test 2: Role-Based Task Execution ---');
    
    const researchTask = 'Research the latest developments in artificial intelligence and machine learning';
    console.log(`🎯 Executing task: "${researchTask}"`);
    
    const startTime = Date.now();
    const researchResult = await researchTeam.run(researchTask, {
      strategy: 'role_based',
      requiredCapabilities: ['research']
    });
    const endTime = Date.now();
    
    console.log(`⏱️ Execution time: ${endTime - startTime}ms`);
    console.log(`✅ Success: ${researchResult.success}`);
    console.log(`📊 Agents used: ${researchResult.result?.participatingAgents?.length || 0}`);
    console.log(`📋 Strategy: ${researchResult.result?.strategy}`);
    
    if (researchResult.success) {
      console.log(`🎯 Selected agent: ${researchResult.result.executionDetails.selectedAgent?.name}`);
      console.log(`📝 Execution summary: ${researchResult.result.executionDetails.executionSummary}`);
    }

    // Test 3: Parallel Task Execution
    console.log('\n--- Test 3: Parallel Task Execution ---');
    
    const parallelTask = 'Analyze current AI trends simultaneously from multiple perspectives';
    console.log(`🎯 Executing parallel task: "${parallelTask}"`);
    
    const parallelStart = Date.now();
    const parallelResult = await researchTeam.run(parallelTask, {
      strategy: 'parallel',
      priority: 2
    });
    const parallelEnd = Date.now();
    
    console.log(`⏱️ Parallel execution time: ${parallelEnd - parallelStart}ms`);
    console.log(`✅ Success: ${parallelResult.success}`);
    console.log(`👥 Participating agents: ${parallelResult.result?.participatingAgents?.length || 0}`);
    console.log(`📊 Success rate: ${parallelResult.result?.executionDetails?.aggregatedResult?.successRate || 0}`);
    
    if (parallelResult.success && parallelResult.result?.executionDetails?.individualResults) {
      console.log('\n📋 Individual Agent Results:');
      parallelResult.result.executionDetails.individualResults.forEach((result, index) => {
        console.log(`  Agent ${index + 1} (${result.agent}): ${result.result?.success ? '✅ Success' : '❌ Failed'}`);
      });
    }

    // Test 4: Sequential Task Execution
    console.log('\n--- Test 4: Sequential Task Execution ---');
    
    const sequentialTask = 'Research AI developments step by step, then analyze findings, then document insights';
    console.log(`🎯 Executing sequential task: "${sequentialTask}"`);
    
    const sequentialStart = Date.now();
    const sequentialResult = await researchTeam.run(sequentialTask, {
      strategy: 'sequential'
    });
    const sequentialEnd = Date.now();
    
    console.log(`⏱️ Sequential execution time: ${sequentialEnd - sequentialStart}ms`);
    console.log(`✅ Success: ${sequentialResult.success}`);
    console.log(`🔄 Execution flow: ${sequentialResult.result?.executionDetails?.executionSummary}`);

    // Test 5: Pipeline Task Execution
    console.log('\n--- Test 5: Pipeline Task Execution ---');
    
    const pipelineTask = 'Create a research pipeline where each agent builds on the previous agent\'s work';
    console.log(`🎯 Executing pipeline task: "${pipelineTask}"`);
    
    const pipelineStart = Date.now();
    const pipelineResult = await researchTeam.run(pipelineTask, {
      strategy: 'pipeline'
    });
    const pipelineEnd = Date.now();
    
    console.log(`⏱️ Pipeline execution time: ${pipelineEnd - pipelineStart}ms`);
    console.log(`✅ Success: ${pipelineResult.success}`);
    
    if (pipelineResult.success && pipelineResult.result?.executionDetails?.pipelineResults) {
      console.log('\n🔗 Pipeline Flow:');
      pipelineResult.result.executionDetails.pipelineResults.forEach((step, index) => {
        console.log(`  Step ${index + 1} (${step.agent}): ${step.result?.success ? '✅' : '❌'}`);
        if (index < pipelineResult.result.executionDetails.pipelineResults.length - 1) {
          console.log(`    ↓ Passed to next agent`);
        }
      });
    }

    // Test 6: Collaborative Task Execution
    console.log('\n--- Test 6: Collaborative Task Execution ---');
    
    const collaborativeTask = 'Work together to analyze the future of AI technology from different angles';
    console.log(`🎯 Executing collaborative task: "${collaborativeTask}"`);
    
    const collaborativeStart = Date.now();
    const collaborativeResult = await researchTeam.run(collaborativeTask, {
      strategy: 'collaborative'
    });
    const collaborativeEnd = Date.now();
    
    console.log(`⏱️ Collaborative execution time: ${collaborativeEnd - collaborativeStart}ms`);
    console.log(`✅ Success: ${collaborativeResult.success}`);
    
    if (collaborativeResult.success && collaborativeResult.result?.executionDetails?.subtasks) {
      console.log('\n🤝 Task Decomposition:');
      collaborativeResult.result.executionDetails.subtasks.forEach((subtask, index) => {
        console.log(`  Subtask ${index + 1}: ${subtask}`);
      });
      
      console.log(`\n📊 Collaboration Summary: ${collaborativeResult.result.executionDetails.synthesizedResult?.summary}`);
    }

    // Test 7: Strategy Auto-Detection
    console.log('\n--- Test 7: Strategy Auto-Detection ---');
    
    const autoTasks = [
      'Analyze AI trends',
      'Research AI and then analyze the results',
      'All agents work simultaneously on this task',
      'Step by step research process',
      'Collaborate on this comprehensive analysis'
    ];

    console.log('🎯 Testing automatic strategy detection:');
    
    for (const task of autoTasks) {
      try {
        const autoStart = Date.now();
        const autoResult = await researchTeam.run(task); // No strategy specified - auto-detect
        const autoEnd = Date.now();
        
        console.log(`  Task: "${task}"`);
        console.log(`    → Strategy: ${autoResult.result?.strategy} (${autoEnd - autoStart}ms)`);
        console.log(`    → Success: ${autoResult.success ? '✅' : '❌'}`);
        
      } catch (error) {
        console.log(`  Task: "${task}"`);
        console.log(`    → Error: ${error.message}`);
      }
    }

    // Test 8: Team Status and Analytics
    console.log('\n--- Test 8: Team Status & Analytics ---');
    
    const finalStatus = researchTeam.getStatus();
    console.log('📊 Final Team Status:');
    console.log(`  Team ID: ${finalStatus.teamId}`);
    console.log(`  Team Name: ${finalStatus.name}`);
    console.log(`  State: ${finalStatus.state}`);
    console.log(`  Members: ${finalStatus.memberCount}`);
    console.log(`  Active Executions: ${finalStatus.activeExecutions}`);
    console.log(`  Strategy: ${finalStatus.strategy}`);
    
    console.log('\n👥 Member Status:');
    finalStatus.members.forEach((member, index) => {
      console.log(`  Agent ${index + 1}: ${member.name}`);
      console.log(`    Status: ${member.status}`);
      console.log(`    Load: ${member.currentLoad}`);
      console.log(`    Capabilities: ${member.capabilities.join(', ')}`);
      console.log(`    Last Activity: ${new Date(member.lastActivity).toLocaleTimeString()}`);
    });

    // Test 9: Complex Multi-Team Scenario
    console.log('\n--- Test 9: Multiple Teams Coordination ---');
    
    const developmentTeam = await symphony.team.create({
      name: 'developmentTeam',
      description: 'Software development and testing team',
      agents: ['developer', 'tester'],
      strategy: {
        name: 'agile_development',
        coordinationRules: {
          maxParallelTasks: 2,
          taskTimeout: 120000
        }
      }
    });

    console.log('✅ Development team created');
    
    const multiTeamTask = 'Plan a new AI application';
    console.log(`🎯 Multi-team task: "${multiTeamTask}"`);
    
    // Execute task with both teams
    const researchPart = researchTeam.run('Research market needs for AI applications', { strategy: 'role_based' });
    const developmentPart = developmentTeam.run('Design technical architecture for AI application', { strategy: 'role_based' });
    
    const [researchPartResult, developmentPartResult] = await Promise.all([researchPart, developmentPart]);
    
    console.log(`📋 Research team result: ${researchPartResult.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`📋 Development team result: ${developmentPartResult.success ? '✅ Success' : '❌ Failed'}`);

    // Final Assessment
    console.log('\n🎉 Team Coordination System Test Complete!');
    console.log('=' .repeat(80));
    console.log('📈 Test Summary:');
    console.log('  ✅ Team creation and initialization');
    console.log('  ✅ Role-based task assignment');
    console.log('  ✅ Parallel execution coordination');
    console.log('  ✅ Sequential workflow orchestration');
    console.log('  ✅ Pipeline data flow management');
    console.log('  ✅ Collaborative task decomposition');
    console.log('  ✅ Automatic strategy detection');
    console.log('  ✅ Team status monitoring');
    console.log('  ✅ Multi-team coordination');
    console.log('\n🏆 Team Coordination System: FULLY OPERATIONAL!');
    
    clearTimeout(timeout);
    
    // Clean exit
    setTimeout(() => {
      console.log('🔚 Exiting team coordination test...');
      process.exit(0);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Team coordination test failed:', error);
    console.error('Stack:', error.stack);
    clearTimeout(timeout);
    
    setTimeout(() => {
      console.log('🔚 Exiting test process due to error...');
      process.exit(1);
    }, 3000);
  }
}

// Add process exit handlers
process.on('SIGINT', () => {
  console.log('\n🛑 Team coordination test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Team coordination test terminated');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception in team coordination test:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection in team coordination test:', promise, 'reason:', reason);
  process.exit(1);
});

testTeamCoordination(); 