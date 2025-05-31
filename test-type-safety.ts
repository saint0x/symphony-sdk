import { 
    symphony, 
    TeamConfig, 
    TeamResult, 
    AgentConfig, 
    AgentResult, 
    PipelineConfig, 
    PipelineResult,
    ToolConfig,
    ToolResult,
    AgentExecutor,
    TeamCoordinator,
    ITeamService,
    ISymphony
} from './src/index';

// Demonstrate type safety with single import pattern
async function demonstrateTypeSafety() {
    console.log('=== Symphony SDK Type Safety Demonstration ===\n');

    // 1. Basic configuration with full type safety
    const agentConfig: AgentConfig = {
        name: 'TestAgent',
        description: 'A test agent for type safety demo',
        task: 'Demonstrate type safety',
        tools: ['calculate'],
        llm: {
            model: 'gpt-4',
            temperature: 0.7
        }
    };

    const teamConfig: TeamConfig = {
        name: 'TestTeam',
        description: 'A test team for type safety demo',
        agents: [agentConfig]
    };

    const pipelineConfig: PipelineConfig = {
        name: 'TestPipeline',
        description: 'A test pipeline for type safety demo',
        steps: [
            {
                name: 'step1',
                type: 'agent',
                agent: 'TestAgent'
            }
        ]
    };

    console.log('✅ Type-safe configurations created without errors');

    // 2. Demonstrate fully typed service access
    const toolService = symphony.tool; // Type: IToolService
    const agentService = symphony.agent; // Type: IAgentService  
    const teamService: ITeamService = symphony.team; // Explicit typing works
    const pipelineService = symphony.pipeline; // Type: IPipelineService

    console.log('✅ Service managers are properly typed');

    // 3. Demonstrate typed creation methods
    try {
        // Agent creation with proper return types
        const agent: AgentExecutor = await symphony.agent.create(agentConfig);
        console.log(`✅ Agent created: ${agent.name} (Type: AgentExecutor)`);

        // Team creation with proper return types  
        const team: TeamCoordinator = await symphony.team.create(teamConfig);
        console.log(`✅ Team created: ${teamConfig.name} (Type: TeamCoordinator)`);

        // Pipeline creation with proper return types
        const pipeline = await symphony.pipeline.create(pipelineConfig);
        console.log(`✅ Pipeline created: ${pipeline.name} (Type: Pipeline)`);

        // 4. Demonstrate typed execution results
        const agentResult: ToolResult = await agent.run('Calculate 2 + 2'); // AgentExecutor.run() returns ToolResult
        console.log(`✅ Agent execution result properly typed: ${agentResult.success}`);

        // Note: TeamCoordinator doesn't have a run method in the current implementation
        console.log('✅ Team methods would be properly typed once implemented');

        const pipelineResult: PipelineResult = await pipeline.run({ input: 'test' });
        console.log(`✅ Pipeline execution result properly typed: ${pipelineResult.success}`);

    } catch (error) {
        console.log(`⚠️  Execution skipped due to missing dependencies: ${error}`);
    }

    // 5. Demonstrate ISymphony interface typing
    const symphonyInstance: ISymphony = symphony;
    console.log(`✅ Symphony instance properly typed as ISymphony: ${symphonyInstance.name}`);

    console.log('\n=== Type Safety Benefits ===');
    console.log('🎯 Full IntelliSense support for all methods and properties');
    console.log('🛡️  Compile-time error checking for configuration objects');
    console.log('📝 Proper return type inference for all service methods');
    console.log('🔍 IDE autocomplete for all available options and methods');
    console.log('⚡ Single import pattern maintained: import { symphony, types... } from "symphonic"');
}

// Type-safe variable declarations
let myAgent: AgentExecutor;
let myTeam: TeamCoordinator;
let myAgentResult: ToolResult; // AgentExecutor.run() returns ToolResult
let myTeamResult: TeamResult;

console.log('✅ All type declarations compile without errors');

// Run the demonstration
demonstrateTypeSafety().catch(console.error); 