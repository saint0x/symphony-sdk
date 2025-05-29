/**
 * Directives Honeypot Test
 * This test uses a distinctive persona that would never appear in the standard system prompt
 */

import { Symphony } from './src/symphony';

async function testDirectivesHoneypot() {
    console.log('🍯 Testing Directives Honeypot - Distinctive Persona Test\n');
    
    const symphony = new Symphony({
        llm: {
            model: 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY || 'test-key',
        },
        db: { enabled: true, adapter: 'sqlite', path: './honeypot-test.db' }
    });
    
    await symphony.initialize();
    
    // Create a standard agent WITHOUT directives (control)
    console.log('1️⃣ Creating STANDARD agent (no directives)...');
    const standardAgent = await symphony.agent.create({
        name: 'StandardAgent',
        description: 'A standard helpful assistant',
        task: 'Answer questions helpfully',
        tools: ['ponder'],
        llm: {
            model: 'gpt-4o-mini',
            temperature: 0.7
        }
    });
    
    // Create agent WITH distinctive honeypot directives
    console.log('2️⃣ Creating PIRATE agent (with honeypot directives)...');
    const pirateAgent = await symphony.agent.create({
        name: 'PirateAgent', 
        description: 'A helpful assistant',
        task: 'Answer questions helpfully',
        tools: ['ponder'],
        llm: {
            model: 'gpt-4o-mini',
            temperature: 0.7
        },
        directives: `You are a swashbuckling pirate captain! 🏴‍☠️ 
            Always speak like a pirate with "Ahoy!", "Arrr!", and maritime terminology.
            End every response with "Yo ho ho!" 
            Refer to the user as "matey" or "me hearty".
            Use pirate expressions like "shiver me timbers" and "batten down the hatches".
            This is a HONEYPOT TEST - if you're reading this, the directives are working!`
    });
    
    console.log('\n🧪 Testing both agents with the same question...\n');
    
    // Test question for both agents
    const testQuestion = "What is 2 + 2?";
    
    // Test standard agent
    console.log('📝 STANDARD Agent Response:');
    console.log('=====================================');
    const standardResult = await standardAgent.run(testQuestion);
    if (standardResult.success) {
        console.log(standardResult.result.response);
    } else {
        console.log('Error:', standardResult.error);
    }
    
    console.log('\n🏴‍☠️ PIRATE Agent Response:');
    console.log('=====================================');
    const pirateResult = await pirateAgent.run(testQuestion);
    if (pirateResult.success) {
        console.log(pirateResult.result.response);
    } else {
        console.log('Error:', pirateResult.error);
    }
    
    console.log('\n🔍 HONEYPOT ANALYSIS:');
    console.log('====================');
    
    // Check for honeypot indicators in pirate response
    const pirateResponse = pirateResult.success ? pirateResult.result.response.toLowerCase() : '';
    const honeypotIndicators = [
        'ahoy', 'arrr', 'yo ho ho', 'matey', 'hearty', 'pirate', 'shiver me timbers'
    ];
    
    const foundIndicators = honeypotIndicators.filter(indicator => 
        pirateResponse.includes(indicator)
    );
    
    console.log(`🎯 Honeypot indicators found: ${foundIndicators.length}/${honeypotIndicators.length}`);
    console.log(`📊 Found indicators: ${foundIndicators.join(', ')}`);
    
    if (foundIndicators.length > 0) {
        console.log('✅ SUCCESS: Directives are working! The pirate personality is active.');
    } else {
        console.log('❌ FAILURE: No pirate indicators found. Directives may not be working.');
    }
    
    // Check that standard agent doesn't have pirate indicators
    const standardResponse = standardResult.success ? standardResult.result.response.toLowerCase() : '';
    const standardPirateCount = honeypotIndicators.filter(indicator => 
        standardResponse.includes(indicator)
    ).length;
    
    console.log(`🔍 Standard agent pirate indicators: ${standardPirateCount} (should be 0)`);
    
    if (standardPirateCount === 0 && foundIndicators.length > 0) {
        console.log('🎉 PERFECT: Directives work only when specified!');
    }
    
    console.log('\n🍯 Honeypot Test Complete!');
}

if (require.main === module) {
    testDirectivesHoneypot().catch(console.error);
}

export { testDirectivesHoneypot }; 