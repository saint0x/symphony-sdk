import { Symphony } from './src/symphony';
import { AgentConfig } from './src/types/sdk';
import { writeFileSync } from 'fs';

// Create a custom system prompt file for testing
const customPromptContent = `You are a JSON Assistant. You MUST respond in valid JSON format only.
Your responses should be structured as:
{
  "response": "your actual response here",
  "confidence": "high|medium|low",
  "action": "describe what you're doing"
}

You have access to tools but should explain your actions in the JSON structure.
Never break from JSON format under any circumstances.`;

writeFileSync('custom-prompt.txt', customPromptContent);

async function testSystemPromptOverride() {
    console.log('🧪 Testing System Prompt Override Feature...\n');

    const symphony = new Symphony({
        llm: {
            model: 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
        },
        db: {
            enabled: true,
            adapter: 'sqlite',
            path: './test.db'
        },
        serviceRegistry: {
            enabled: true,
            maxRetries: 3,
            retryDelay: 1000
        },
        metrics: {
            enabled: true,
            detailed: true
        }
    });
    await symphony.initialize();

    // Test 1: Direct string system prompt override
    console.log('📝 Test 1: Direct String System Prompt Override');
    const jsonAgent: AgentConfig = {
        name: 'JsonBot',
        description: 'A JSON formatting assistant',
        task: 'Format responses as JSON',
        tools: [],
        llm: 'gpt-4o-mini',
        systemPrompt: customPromptContent,
        directives: 'Be friendly and helpful' // This should be ignored
    };

    const agent1 = await symphony.agent.create(jsonAgent);
    const result1 = await agent1.run('Tell me about the weather today');
    
    console.log('Agent Response:', result1.result?.response);
    
    // Verify JSON format
    try {
        const parsed = JSON.parse(result1.result?.response);
        console.log('✅ JSON parsing successful:', parsed);
    } catch (e) {
        console.log('❌ JSON parsing failed - response not in JSON format');
    }

    // Test 2: File-based system prompt override
    console.log('\n📁 Test 2: File-based System Prompt Override');
    const fileAgent: AgentConfig = {
        name: 'FileBot',
        description: 'A file-based assistant',
        task: 'Process requests using file-based prompts',
        tools: [],
        llm: 'gpt-4o-mini',
        systemPrompt: './custom-prompt.txt',
        directives: 'This directive should be ignored'
    };

    const agent2 = await symphony.agent.create(fileAgent);
    const result2 = await agent2.run('What is 2 + 2?');
    
    console.log('Agent Response:', result2.result?.response);
    
    // Verify JSON format
    try {
        const parsed = JSON.parse(result2.result?.response);
        console.log('✅ JSON parsing successful:', parsed);
    } catch (e) {
        console.log('❌ JSON parsing failed - response not in JSON format');
    }

    // Test 3: Tool guidance via system prompt
    console.log('\n🔧 Test 3: Tool Execution Guidance via System Prompt');
    const toolGuidancePrompt = `You are a Code Analysis Assistant. When asked to analyze code:
1. Always use the readFile tool first
2. Then use appropriate analysis tools
3. Respond in this format:
{
  "analysis": "your analysis here",
  "files_read": ["list of files"],
  "tools_used": ["list of tools"],
  "recommendations": ["list of recommendations"]
}`;

    const toolAgent: AgentConfig = {
        name: 'CodeAnalyzer',
        description: 'A code analysis specialist',
        task: 'Analyze code files and provide structured feedback',
        tools: ['readFile'],
        llm: 'gpt-4o-mini',
        systemPrompt: toolGuidancePrompt
    };

    const agent3 = await symphony.agent.create(toolAgent);
    const result3 = await agent3.run('Analyze the package.json file structure');
    
    console.log('Agent Response:', result3.result?.response);
    
    // Test 4: Verify directives are ignored when systemPrompt is set
    console.log('\n🚫 Test 4: Verify Directives Ignored with System Prompt');
    const directiveTestAgent: AgentConfig = {
        name: 'DirectiveTest',
        description: 'A formal assistant for testing directive behavior',
        task: 'Respond professionally',
        tools: [],
        llm: 'gpt-4o-mini',
        systemPrompt: 'You are a formal assistant. Always respond professionally and concisely.',
        directives: 'Talk like a pirate with lots of "Arrr" and "mate". Use excessive exclamation points!!! Be very casual and use slang'
    };

    const agent4 = await symphony.agent.create(directiveTestAgent);
    const result4 = await agent4.run('Hello, how are you today?');
    
    console.log('Agent Response:', result4.result?.response);
    
    // Should be formal, not pirate-like
    if (result4.result?.response?.toLowerCase().includes('arrr') || result4.result?.response?.toLowerCase().includes('mate')) {
        console.log('❌ Directives were NOT ignored - pirate language detected');
    } else {
        console.log('✅ Directives properly ignored - formal response received');
    }

    // Test 5: Verify system prompt completely overrides default behavior
    console.log('\n🔄 Test 5: Complete Override Verification');
    const overridePrompt = `You are a Counter Bot. You can ONLY count numbers.
For any input, respond with the next number in sequence starting from 1.
Your first response should be "1", second should be "2", etc.
You cannot do anything else besides count.`;

    const counterAgent: AgentConfig = {
        name: 'CounterBot',
        description: 'A simple counting assistant',
        task: 'Count numbers in sequence',
        tools: [],
        llm: 'gpt-4o-mini',
        systemPrompt: overridePrompt
    };

    const agent5 = await symphony.agent.create(counterAgent);
    const result5a = await agent5.run('What is the capital of France?');
    const result5b = await agent5.run('Write me a poem');
    
    console.log('Counter Response 1:', result5a.result?.response);
    console.log('Counter Response 2:', result5b.result?.response);
    
    // Should ignore the questions and just count
    if (result5a.result?.response?.trim() === '1' && result5b.result?.response?.trim() === '2') {
        console.log('✅ System prompt completely overrode default behavior');
    } else {
        console.log('❌ System prompt did not completely override default behavior');
    }

    console.log('\n🏁 System Prompt Override Tests Complete!\n');
    
    // Clean up
    try {
        require('fs').unlinkSync('custom-prompt.txt');
        console.log('🧹 Cleaned up test files');
    } catch (e) {
        console.log('⚠️ Could not clean up test files');
    }
}

// Run the test
testSystemPromptOverride().catch(console.error); 