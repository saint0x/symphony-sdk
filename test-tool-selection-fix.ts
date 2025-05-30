/**
 * TOOL SELECTION BUG VERIFICATION TEST
 * 
 * This test reproduces the exact scenario from the bug report to ensure
 * the tool selection fix is still working after context intelligence changes.
 */

import { symphony } from './src';

async function testToolSelectionFix() {
    console.log('🐛 TOOL SELECTION BUG VERIFICATION TEST');
    console.log('=' .repeat(60));
    console.log('🎯 Goal: Verify tool selection works for file creation tasks\n');

    try {
        // Initialize Symphony
        symphony.updateConfig({
            db: { enabled: true, path: './symphony.db', adapter: 'sqlite' }
        });
        await symphony.initialize();

        // Step 1: Register the exact custom tool from the bug report
        console.log('📋 Step 1: Registering custom agentCoordinator tool...');
        const customTool: any = {
            name: 'agentCoordinator',
            description: 'Creates config.json files and handles file creation tasks',
            type: 'file_management',
            config: {
                handler: async (params: any) => {
                    console.log('🎉 TOOL EXECUTED! agentCoordinator called with:', params);
                    return {
                        success: true,
                        result: {
                            message: 'Config file creation task handled successfully',
                            file: 'config.json',
                            content: params.content || { name: 'default', version: '1.0.0' }
                        }
                    };
                }
            }
        };

        symphony.tool.register('agentCoordinator', customTool);
        console.log('✅ agentCoordinator tool registered successfully\n');

        // Step 2: Create agent with clear system prompt
        console.log('📋 Step 2: Creating agent with explicit tool usage directive...');
        const agent = await symphony.agent.create({
            name: 'fileManager',
            description: 'Manages file creation tasks',
            task: 'Handle file creation and management tasks, especially config files',
            tools: ['agentCoordinator'], // Explicitly include the tool
            llm: 'gpt-4o-mini',
            directives: `When users request file creation, especially config files, you MUST use the agentCoordinator tool. 
Available tools:
- agentCoordinator: Creates config.json files and handles file creation tasks

For ANY file creation request, use the agentCoordinator tool. Always check if the task requires file creation and use the appropriate tool.`
        });
        console.log('✅ Agent created with tool directive\n');

        // Step 3: Test the exact task from the bug report
        console.log('📋 Step 3: Testing exact task from bug report...');
        console.log('Task: "Create a config.json file with basic settings"\n');
        
        const result = await agent.run("Create a config.json file with basic settings");

        console.log('📊 EXECUTION RESULT:');
        console.log('Success:', result.success);
        console.log('Response:', result.result?.response || result.response);
        if (result.toolsUsed) {
            console.log('Tools Used:', result.toolsUsed);
        }
        if (result.metrics) {
            console.log('Execution Time:', result.metrics.duration + 'ms');
        }

        // Step 4: Verify tool was actually called
        const toolWasExecuted = result.toolsUsed?.includes('agentCoordinator') || 
                               result.success && (result.result?.response || result.response)?.includes('agentCoordinator');

        console.log('\n🔍 VERIFICATION:');
        if (toolWasExecuted) {
            console.log('✅ SUCCESS: Tool selection is working correctly!');
            console.log('   • LLM recognized the need for tool usage');
            console.log('   • Symphony\'s tool selection logic allowed the execution');
            console.log('   • agentCoordinator tool was properly triggered');
        } else {
            console.log('❌ FAILURE: Tool selection bug has returned!');
            console.log('   • Tool was not executed despite perfect match');
            console.log('   • This indicates the original bug is back');
        }

        // Step 5: Test mathematical task to ensure calculate tool still works
        console.log('\n📋 Step 4: Testing mathematical task (should also work)...');
        const mathResult = await agent.run("Calculate 15 * 23 + 47");

        const mathToolUsed = mathResult.toolsUsed?.includes('calculate') ||
                            mathResult.success && (mathResult.result?.response || mathResult.response)?.includes('calculate');

        console.log('Math tool executed:', mathToolUsed ? '✅ YES' : '❌ NO');

        // Final assessment
        console.log('\n🏆 FINAL ASSESSMENT:');
        console.log('=' .repeat(60));
        
        if (toolWasExecuted) {
            console.log('🎉 TOOL SELECTION FIX IS WORKING!');
            console.log('   The original bug has been successfully resolved.');
            console.log('   Context intelligence changes did not break tool selection.');
        } else {
            console.log('⚠️  TOOL SELECTION ISSUE DETECTED!');
            console.log('   The original bug may have been reintroduced.');
            console.log('   Need to investigate tool selection logic.');
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        if (error instanceof Error) {
            console.error('📋 Stack trace:', error.stack);
        }
    }
}

testToolSelectionFix().catch(console.error); 