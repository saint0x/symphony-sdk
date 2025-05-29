/**
 * Test Real Tools Verification - Verify Stub Tools Are Now Real
 */

const { Symphony } = require('../src/symphony');

async function testRealTools() {
    console.log('🔧 Testing Real Tools Verification...\n');
    
    const symphony = new Symphony({
        llm: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY,
        },
        db: { enabled: true, adapter: 'sqlite', path: './symphony.db' }
    });
    
    await symphony.initialize();
    
    console.log('🎯 Test 1: Real Plan Generation Tool');
    console.log('=====================================');
    
    const planTool = await symphony.tool.create({
        name: 'testPlanTool',
        handler: () => symphony.tool.execute('createPlan', {
            objective: 'Build a mobile app for food delivery',
            constraints: { budget: '$50K', timeline: '3 months' },
            context: { team_size: 5, technology: 'React Native' }
        })
    });
    
    const planStart = Date.now();
    const planResult = await planTool.run();
    const planDuration = Date.now() - planStart;
    
    console.log(`✅ Plan Generation Result:`);
    console.log(`   Duration: ${planDuration}ms`);
    console.log(`   Success: ${planResult.success}`);
    if (planResult.success && planResult.result?.plan) {
        console.log(`   Plan Length: ${planResult.result.plan.planLength} characters`);
        console.log(`   Plan Preview: "${planResult.result.plan.generatedPlan.substring(0, 100)}..."`);
    }
    
    console.log('\n🎯 Test 2: Real Code Generation Tool');
    console.log('====================================');
    
    const codeTool = await symphony.tool.create({
        name: 'testCodeTool',
        handler: () => symphony.tool.execute('writeCode', {
            spec: 'Create a React component for user authentication',
            language: 'javascript',
            context: { framework: 'React', authentication: 'JWT' }
        })
    });
    
    const codeStart = Date.now();
    const codeResult = await codeTool.run();
    const codeDuration = Date.now() - codeStart;
    
    console.log(`✅ Code Generation Result:`);
    console.log(`   Duration: ${codeDuration}ms`);
    console.log(`   Success: ${codeResult.success}`);
    if (codeResult.success && codeResult.result) {
        console.log(`   Code Length: ${codeResult.result.codeLength} characters`);
        console.log(`   Code Preview: "${codeResult.result.code.substring(0, 100)}..."`);
        console.log(`   Explanation: "${codeResult.result.explanation.substring(0, 100)}..."`);
    }
    
    console.log('\n🎯 Test 3: Agent with Real Tools');
    console.log('=================================');
    
    const realAgent = await symphony.agent.create({
        name: 'RealToolAgent',
        description: 'Agent that uses real tools for genuine work',
        llm: { model: 'gpt-4o-mini', temperature: 0.7 },
        tools: ['createPlan', 'writeCode', 'webSearch', 'ponder']
    });
    
    const agentStart = Date.now();
    const agentResult = await realAgent.run('Create a plan for building a simple todo app and then generate the main component code');
    const agentDuration = Date.now() - agentStart;
    
    console.log(`✅ Agent with Real Tools Result:`);
    console.log(`   Duration: ${agentDuration}ms`);
    console.log(`   Success: ${agentResult.success}`);
    if (agentResult.success && agentResult.result) {
        console.log(`   Response Length: ${agentResult.result.response?.length || 0} characters`);
        console.log(`   Execution Strategy: ${agentResult.result.executionStrategy}`);
        console.log(`   Response Preview: "${agentResult.result.response?.substring(0, 150)}..."`);
    }
    
    // Summary
    const totalDuration = planDuration + codeDuration + agentDuration;
    console.log('\n📊 Real Tools Verification Summary');
    console.log('==================================');
    console.log(`Total Test Duration: ${totalDuration}ms`);
    console.log(`Plan Tool: ${planResult.success ? '✅ REAL' : '❌ FAILED'} (${planDuration}ms)`);
    console.log(`Code Tool: ${codeResult.success ? '✅ REAL' : '❌ FAILED'} (${codeDuration}ms)`);
    console.log(`Agent Integration: ${agentResult.success ? '✅ REAL' : '❌ FAILED'} (${agentDuration}ms)`);
    
    const allSuccess = planResult.success && codeResult.success && agentResult.success;
    const hasRealDuration = planDuration > 100 && codeDuration > 100; // Real LLM calls take time
    
    console.log(`\n🎯 VERIFICATION RESULT: ${allSuccess && hasRealDuration ? '✅ TOOLS ARE NOW REAL!' : '⚠️ Still issues detected'}`);
    
    return {
        planSuccess: planResult.success,
        codeSuccess: codeResult.success,
        agentSuccess: agentResult.success,
        planDuration,
        codeDuration,
        agentDuration,
        totalDuration,
        allToolsReal: allSuccess && hasRealDuration
    };
}

testRealTools()
    .then(results => {
        console.log('\n🔚 Test completed:', results);
        process.exit(results.allToolsReal ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }); 