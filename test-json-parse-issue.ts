import { Symphony } from './src/symphony';
import * as dotenv from 'dotenv';

dotenv.config();

async function testJSONParseIssue() {
    console.log('=== JSON Parse Error Test ===\n');

    // Initialize Symphony
    const symphony = new Symphony({
        llm: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY || 'test-key'
        },
        db: {
            enabled: true,
            adapter: 'sqlite',
            path: ':memory:'
        },
        logging: {
            level: 'debug' // Enable debug logging to see tool execution details
        }
    });

    await symphony.initialize();
    console.log('✓ Symphony initialized\n');

    // Test 1: Create agent and test direct tool execution
    console.log('1. Testing Direct Tool Execution:');
    try {
        const result = await symphony.tool.execute('writeFile', {
            path: 'test.txt',
            content: 'Hello World'
        });
        console.log('✓ Direct tool execution works:', result.success);
    } catch (error) {
        console.error('✗ Direct tool execution failed:', error);
    }

    // Test 2: Create agent with specific system prompt override to test JSON formatting
    console.log('\n2. Testing Agent with JSON Format Override:');
    const strictAgent = await symphony.agent.create({
        name: 'StrictJSONAgent',
        description: 'Agent that uses strict JSON format',
        task: 'Execute tools with proper JSON formatting',
        tools: ['writeFile', 'readFile'],
        llm: 'gpt-4o-mini',
        systemPrompt: `You are a tool execution agent. When using tools, you MUST follow this exact format:

TOOL_CALL: toolName
PARAMETERS: {"key": "value", "key2": "value2"}

CRITICAL RULES:
1. The PARAMETERS line MUST contain valid JSON
2. All property names MUST be in double quotes
3. All string values MUST be in double quotes
4. Numbers and booleans don't need quotes

CORRECT Example:
TOOL_CALL: writeFile
PARAMETERS: {"path": "config.json", "content": "test content"}

INCORRECT Examples (will cause JSON parse errors):
PARAMETERS: {path: "config.json", content: "test"}  // Missing quotes on keys
PARAMETERS: {'path': 'config.json'}  // Single quotes not allowed
PARAMETERS: {"path": config.json}  // Missing quotes on string value

Task: Execute the requested tool operations with proper JSON formatting.`
    });

    // Test agent execution
    try {
        const result = await strictAgent.run('Create a file called test.json with content {"test": true}');
        console.log('✓ Strict JSON agent execution:', result.success ? 'SUCCESS' : 'FAILED');
        if (result.result.toolsExecuted) {
            console.log('  Tools executed:', result.result.toolsExecuted);
        }
    } catch (error) {
        console.error('✗ Strict JSON agent failed:', error);
    }

    // Test 3: Test with natural language parameters (should fail)
    console.log('\n3. Testing Natural Language Parameters (Expected to Fail):');
    const naturalAgent = await symphony.agent.create({
        name: 'NaturalLanguageAgent',
        description: 'Agent that might use natural language',
        task: 'Execute tools',
        tools: ['writeFile'],
        llm: 'gpt-4o-mini',
        directives: 'When asked to create files, just do it naturally.'
    });

    try {
        const result = await naturalAgent.run('Create a config file at config/settings.json');
        console.log('Natural language agent result:', result.success ? 'SUCCESS' : 'FAILED');
        console.log('Response preview:', result.result.response.substring(0, 200) + '...');
    } catch (error) {
        console.error('✗ Natural language agent error:', error);
    }

    // Test 4: Test tool call pattern matching
    console.log('\n4. Testing Tool Call Pattern Matching:');
    const testPatterns = [
        'TOOL_CALL: writeFile\nPARAMETERS: {"path": "test.txt", "content": "hello"}',
        'TOOL_CALL: writeFile\nPARAMETERS: {path: "test.txt", content: "hello"}',  // Invalid JSON
        'TOOL_CALL: writeFile\nPARAMETERS: {"path": "test.txt", "content": "hello with \\"quotes\\""}',
        'TOOL_CALL: writeFile\nPARAMETERS: {\n  "path": "test.txt",\n  "content": "multiline"\n}'
    ];

    const toolCallPattern = /TOOL_CALL:\s*(\w+)\s*\nPARAMETERS:\s*({[^}]+})/g;
    
    testPatterns.forEach((pattern, index) => {
        console.log(`\nPattern ${index + 1}:`);
        console.log('Input:', pattern.replace(/\n/g, '\\n'));
        
        const matches = Array.from(pattern.matchAll(toolCallPattern));
        if (matches.length > 0) {
            const [, toolName, parametersStr] = matches[0];
            console.log('Tool:', toolName);
            console.log('Parameters string:', parametersStr);
            
            try {
                const params = JSON.parse(parametersStr);
                console.log('✓ Valid JSON:', params);
            } catch (error) {
                console.log('✗ Invalid JSON:', error.message);
            }
        } else {
            console.log('✗ No match found');
        }
    });

    // Test 5: Test multiline JSON parameters
    console.log('\n\n5. Testing Multiline JSON (Current Regex Issue):');
    const multilinePattern = `TOOL_CALL: writeFile
PARAMETERS: {
  "path": "config.json",
  "content": "test content"
}`;

    const multilineMatches = Array.from(multilinePattern.matchAll(toolCallPattern));
    console.log('Multiline matches found:', multilineMatches.length);
    console.log('Current regex pattern:', toolCallPattern.toString());
    console.log('Issue: The regex {[^}]+} doesn\'t handle newlines in JSON');

    // Better regex that handles multiline JSON
    const betterPattern = /TOOL_CALL:\s*(\w+)\s*\nPARAMETERS:\s*({[\s\S]*?}(?:\s*\n|$))/g;
    const betterMatches = Array.from(multilinePattern.matchAll(betterPattern));
    console.log('\nBetter regex matches:', betterMatches.length);
    if (betterMatches.length > 0) {
        try {
            const params = JSON.parse(betterMatches[0][2]);
            console.log('✓ Successfully parsed multiline JSON:', params);
        } catch (error) {
            console.log('✗ Failed to parse:', error.message);
        }
    }

    console.log('\n=== Test Complete ===');
}

// Run the test
testJSONParseIssue().catch(console.error); 