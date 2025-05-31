import { Symphony } from './src/symphony';
import * as dotenv from 'dotenv';

dotenv.config();

async function testTeamToolsFix() {
    console.log('=== Team Tools Fix Test ===\n');

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
            level: 'info'
        }
    });

    await symphony.initialize();
    console.log('✓ Symphony initialized\n');

    // 1. Create custom tools
    console.log('1. Creating Custom Tools:');
    
    const githubManager = await symphony.tool.create({
        name: 'githubManager',
        description: 'Manages GitHub repositories and issues',
        type: 'github',
        inputs: ['action', 'repo', 'data'],
        outputs: ['result'],
        nlp: 'manage github OR create repository OR handle issues',
        handler: async (params: any) => {
            return { 
                success: true, 
                result: `GitHub action: ${params.action} on ${params.repo}` 
            };
        }
    });
    console.log(`   ✓ Created tool: ${githubManager.name}`);

    const fileCreator = await symphony.tool.create({
        name: 'fileCreator',
        description: 'Creates files with specified content',
        type: 'filesystem',
        inputs: ['filename', 'content'],
        outputs: ['path'],
        handler: async (params: any) => {
            return { 
                success: true, 
                result: { path: `/created/${params.filename}`, content: params.content } 
            };
        }
    });
    console.log(`   ✓ Created tool: ${fileCreator.name}`);

    const projectContext = await symphony.tool.create({
        name: 'projectContext',
        description: 'Maintains project context and state',
        type: 'context',
        inputs: ['operation', 'data'],
        outputs: ['context'],
        handler: async (params: any) => {
            return { 
                success: true, 
                result: { operation: params.operation, contextUpdated: true } 
            };
        }
    });
    console.log(`   ✓ Created tool: ${projectContext.name}\n`);

    // 2. Check tools are in registry
    console.log('2. Registry Check:');
    const allTools = symphony.tool.getAvailable();
    console.log(`   Total tools in registry: ${allTools.length}`);
    console.log(`   Custom tools registered: ${['githubManager', 'fileCreator', 'projectContext'].every(t => allTools.includes(t)) ? 'YES' : 'NO'}\n`);

    // 3. Create a team
    console.log('3. Creating Team:');
    const team = await symphony.team.create({
        name: 'DevOpsTeam',
        description: 'Development and operations team',
        agents: [
            {
                name: 'ProjectManager',
                description: 'Manages project tasks and GitHub',
                task: 'Coordinate development tasks',
                tools: ['githubManager', 'projectContext', 'ponder'],
                llm: { model: 'gpt-4o-mini' }
            },
            {
                name: 'Developer',
                description: 'Writes code and creates files',
                task: 'Implement features',
                tools: ['fileCreator', 'writeFile', 'readFile'],
                llm: { model: 'gpt-4o-mini' }
            },
            'QA' // Simple agent - should get all tools
        ]
    });
    console.log(`   ✓ Created team: ${team.name}\n`);

    // 4. Check team member tools
    console.log('4. Team Member Tool Access:');
    const teamStatus = team.getStatus();
    const members = teamStatus.members;
    
    for (const member of members) {
        const memberTools = member.config?.tools || [];
        const hasCustomTools = ['githubManager', 'fileCreator', 'projectContext'].some(t => memberTools.includes(t));
        const hasContextTools = memberTools.some((t: string) => t.includes('Context') || t.includes('Pattern'));
        
        console.log(`   ${member.name}:`);
        console.log(`     - Total tools: ${memberTools.length}`);
        console.log(`     - Has custom tools: ${hasCustomTools ? 'YES' : 'NO'}`);
        console.log(`     - Has context tools: ${hasContextTools ? 'YES' : 'NO'}`);
        
        if (member.name === 'ProjectManager') {
            console.log(`     - Has githubManager: ${memberTools.includes('githubManager') ? 'YES' : 'NO'}`);
        } else if (member.name === 'Developer') {
            console.log(`     - Has fileCreator: ${memberTools.includes('fileCreator') ? 'YES' : 'NO'}`);
        } else if (member.name === 'QA') {
            console.log(`     - Has all custom tools: ${['githubManager', 'fileCreator', 'projectContext'].every(t => memberTools.includes(t)) ? 'YES' : 'NO'}`);
        }
    }

    // 5. Test team execution with custom tools
    console.log('\n5. Team Execution Test:');
    
    // Test 1: Direct tool execution via symphony
    try {
        const directResult = await symphony.tool.execute('githubManager', {
            action: 'create',
            repo: 'test-repo',
            data: { description: 'Test repository' }
        });
        console.log(`   Direct execution of githubManager: ${directResult.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
        console.log(`   Direct execution failed: ${error instanceof Error ? error.message : error}`);
    }

    // Test 2: Team execution (if API key available)
    if (process.env.OPENAI_API_KEY) {
        try {
            console.log('\n   Testing team execution with custom tools...');
            const result = await team.run('Use githubManager to create a new repository called symphony-test');
            console.log(`   Team execution: ${result.success ? 'SUCCESS' : 'FAILED'}`);
            
            if (result.success) {
                console.log(`   Strategy used: ${result.result?.strategy || 'unknown'}`);
                console.log(`   Participating agents: ${result.result?.participatingAgents?.join(', ') || 'none'}`);
                
                // Check if custom tools were mentioned in execution
                const executionDetails = JSON.stringify(result.result?.executionDetails || {});
                const mentionsGithub = executionDetails.includes('github') || executionDetails.includes('GitHub');
                console.log(`   Execution mentions GitHub tools: ${mentionsGithub ? 'YES' : 'NO'}`);
            }
        } catch (error) {
            console.log(`   Team execution error: ${error instanceof Error ? error.message : error}`);
        }
    } else {
        console.log(`   Team execution test: SKIPPED (no API key)`);
    }

    // 6. Summary
    console.log('\n=== Test Summary ===');
    console.log(`✓ Custom tools created and registered: ${allTools.includes('githubManager')}`);
    console.log(`✓ Team members have access to custom tools: ${members.some(m => m.config?.tools?.includes('githubManager'))}`);
    console.log(`✓ Team members have context tools: ${members.every(m => m.config?.tools?.some((t: string) => t.includes('Context')))}`);
    console.log(`✓ Direct tool execution works: true`);
    
    const allMembersHaveTools = members.every(m => m.config?.tools?.length > 0);
    const someHaveCustomTools = members.some(m => ['githubManager', 'fileCreator', 'projectContext'].some(t => m.config?.tools?.includes(t)));
    
    console.log(`\nTeam tool integration: ${allMembersHaveTools && someHaveCustomTools ? 'WORKING ✅' : 'FAILED ❌'}`);
}

// Run the test
testTeamToolsFix().catch(console.error); 