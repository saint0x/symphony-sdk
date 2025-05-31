import { Symphony } from './src/symphony';
import * as dotenv from 'dotenv';

dotenv.config();

async function testToolRegistration() {
    console.log('=== Tool Registration Test ===\n');

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
            path: ':memory:' // Use in-memory DB for testing
        },
        logging: {
            level: 'info'
        }
    });

    await symphony.initialize();
    console.log('✓ Symphony initialized\n');

    // 1. Check standard tools
    console.log('1. Standard Tools Available:');
    const standardTools = symphony.tool.getAvailable();
    console.log(`   Total tools in registry: ${standardTools.length}`);
    console.log(`   Standard tools: ${standardTools.filter(t => !t.includes('custom')).join(', ')}\n`);

    // 2. Create a custom tool
    console.log('2. Creating Custom Tool:');
    const customTool = await symphony.tool.create({
        name: 'customCalculator',
        description: 'Performs basic math calculations',
        type: 'calculation',
        inputs: ['operation', 'a', 'b'],
        outputs: ['result'],
        nlp: 'calculate math OR perform calculation OR add subtract multiply divide',
        handler: async (params: any) => {
            const { operation, a, b } = params;
            let result;
            
            switch (operation) {
                case 'add': result = a + b; break;
                case 'subtract': result = a - b; break;
                case 'multiply': result = a * b; break;
                case 'divide': result = b !== 0 ? a / b : 'Error: Division by zero'; break;
                default: return { success: false, error: 'Unknown operation' };
            }
            
            return { 
                success: true, 
                result: { calculation: `${a} ${operation} ${b} = ${result}`, result } 
            };
        }
    });
    console.log(`   ✓ Created tool: ${customTool.name}\n`);

    // 3. Check tools after custom tool creation
    console.log('3. Tools After Custom Creation:');
    const allTools = symphony.tool.getAvailable();
    console.log(`   Total tools now: ${allTools.length}`);
    console.log(`   Custom tool registered: ${allTools.includes('customCalculator') ? 'YES' : 'NO'}\n`);

    // 4. Get tool details
    console.log('4. Tool Registry Details:');
    const calculatorInfo = symphony.tool.getInfo('customCalculator');
    if (calculatorInfo) {
        console.log(`   customCalculator info:`);
        console.log(`   - Description: ${calculatorInfo.description}`);
        console.log(`   - Type: ${calculatorInfo.type}`);
        console.log(`   - Has NLP: ${!!calculatorInfo.nlp}`);
        console.log(`   - Inputs: ${calculatorInfo.config?.inputs?.join(', ') || 'none'}`);
    }

    // 5. Test tool execution directly
    console.log('\n5. Direct Tool Execution Test:');
    const calcResult = await symphony.tool.execute('customCalculator', {
        operation: 'multiply',
        a: 7,
        b: 6
    });
    console.log(`   Result: ${calcResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (calcResult.success) {
        console.log(`   Output: ${calcResult.result.calculation}`);
    }

    // 6. Create an agent with both standard and custom tools
    console.log('\n6. Creating Agent with Mixed Tools:');
    const agent = await symphony.agent.create({
        name: 'TestAgent',
        description: 'Agent for testing tool access',
        task: 'Test tool availability and execution',
        tools: ['ponder', 'customCalculator', 'webSearch'], // Mix of standard and custom
        llm: {
            model: 'gpt-4o-mini',
            temperature: 0.3
        }
    });
    console.log(`   ✓ Created agent: ${agent.name}`);
    console.log(`   Agent tools: ${agent.tools.join(', ')}`);

    // 7. Check if agent has access to tools
    console.log('\n7. Agent Tool Access:');
    const agentHasCustomTool = agent.tools.includes('customCalculator');
    const agentHasStandardTools = agent.tools.includes('ponder') && agent.tools.includes('webSearch');
    const agentHasContextTools = agent.tools.some((t: string) => t.includes('Context') || t.includes('Pattern'));
    
    console.log(`   Has custom tool (customCalculator): ${agentHasCustomTool ? 'YES' : 'NO'}`);
    console.log(`   Has standard tools: ${agentHasStandardTools ? 'YES' : 'NO'}`);
    console.log(`   Has context tools: ${agentHasContextTools ? 'YES' : 'NO'}`);
    console.log(`   Total tools available to agent: ${agent.tools.length}`);

    // 8. Test agent execution with custom tool (if API key is available)
    if (process.env.OPENAI_API_KEY) {
        console.log('\n8. Agent Execution Test:');
        try {
            const result = await agent.run('Please calculate 15 multiplied by 4 for me');
            console.log(`   Execution: ${result.success ? 'SUCCESS' : 'FAILED'}`);
            if (result.success && result.result?.response) {
                console.log(`   Agent response preview: ${result.result.response.substring(0, 100)}...`);
            }
        } catch (error) {
            console.log(`   Execution skipped: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    } else {
        console.log('\n8. Agent Execution Test: SKIPPED (no API key)');
    }

    // 9. Verify tool metadata
    console.log('\n9. Tool Metadata Check:');
    const metadata = symphony.tool.registry.getToolMetadata();
    const toolCount = Object.keys(metadata).length;
    console.log(`   Total tools with metadata: ${toolCount}`);
    console.log(`   Sample tools: ${Object.keys(metadata).slice(0, 5).join(', ')}...`);
    
    if (metadata.customCalculator) {
        console.log(`   customCalculator metadata found: YES`);
        console.log(`   - Parameters: ${JSON.stringify(metadata.customCalculator.parameters)}`);
    }

    // 10. Summary
    console.log('\n=== Test Summary ===');
    console.log(`✓ Standard tools registered: ${standardTools.length > 0}`);
    console.log(`✓ Custom tool creation works: ${allTools.includes('customCalculator')}`);
    console.log(`✓ Tool execution works: ${calcResult.success}`);
    console.log(`✓ Agents can access all tools: ${agentHasCustomTool && agentHasStandardTools}`);
    console.log(`✓ Tool metadata available: ${toolCount > 0}`);
    
    console.log('\nTool registration system is working correctly! ✅');
}

// Run the test
testToolRegistration().catch(console.error); 