import { Symphony } from './src/symphony';
import { ToolConfig, ToolResult, AgentConfig, PipelineConfig, PipelineStep, PipelineContext } from './src/types/sdk';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

dotenv.config();

async function testTeamParallelPipeline() {
    console.log('=== Team Parallel Pipeline Test ===\\n');

    // Temporarily set global log level to debug for this test
    // Logger.setGlobalLevel('debug');

    // Initialize Symphony
    console.log('[Symphony] Initializing...');
    const symphony = new Symphony({
        llm: { provider: 'openai', model: 'gpt-4o-mini', apiKey: process.env.OPENAI_API_KEY || 'test-key', useFunctionCalling: true, temperature: 0.1 },
        db: { enabled: false }, // Pipeline state might be in-memory for this test if DB not used by pipeline runner
        logging: { level: 'debug' },
        serviceRegistry: { enabled: false, maxRetries: 0, retryDelay: 0 },
        metrics: { enabled: false, detailed: false }
    });

    try {
        await symphony.initialize();
        console.log('✓ [Symphony] Initialized successfully.\\n');
    } catch (error) {
        console.error('✗ [Symphony] Initialization failed:', error);
        process.exit(1);
    }

    // Moved toolRegistry declaration here, using the initialized symphony instance
    const toolRegistry = symphony.tool.registry;

    // --- Tool Definitions ---
    const developFeatureTool: ToolConfig = {
        name: 'developFeatureTool',
        description: 'Develops a specific software feature component.',
        type: 'coding',
        inputs: [{ name: 'featureDescription', type: 'string', required: true, description: 'The feature component to develop.' }],
        outputs: ['codeOutput'],
        config: {},
        handler: async (params: { featureDescription: string }): Promise<ToolResult> => {
            const code = `// Code for component: ${params.featureDescription}\\nconsole.log('Implementation of ${params.featureDescription}');`;
            console.log(`[Tool Handler - developFeatureTool] Component: ${params.featureDescription}, Generated code snippet.`);
            return { success: true, result: { codeOutput: code } };
        }
    };

    const integrateFeaturesTool: ToolConfig = {
        name: 'integrateFeaturesTool',
        description: 'Integrates multiple feature components for a main feature.',
        type: 'integration',
        inputs: [
            { name: 'frontendCode', type: 'string', required: true, description: 'Code from the frontend component.' },
            { name: 'backendCode', type: 'string', required: true, description: 'Code from the backend component.' },
            { name: 'mainFeatureName', type: 'string', required: true, description: 'The name of the main feature being integrated.' }
        ],
        outputs: ['integrationReport'],
        config: {},
        handler: async (params: { frontendCode: string, backendCode: string, mainFeatureName: string }): Promise<ToolResult> => {
            const report = `Integration complete for feature \\\"${params.mainFeatureName}\\\". Frontend component (starts: \\\"${params.frontendCode.substring(0, 20)}...\\\") and Backend component (starts: \\\"${params.backendCode.substring(0, 20)}...\\\") integrated.`;
            console.log(`[Tool Handler - integrateFeaturesTool] Integration report generated for feature: ${params.mainFeatureName}.`);
            return { success: true, result: { integrationReport: report } };
        }
    };

    toolRegistry.registerTool(developFeatureTool.name, developFeatureTool);
    toolRegistry.registerTool(integrateFeaturesTool.name, integrateFeaturesTool);
    console.log('✓ [Tools] Pipeline workflow tools registered.\\n');

    // --- Agent Definitions for Pipeline ---
    const createDeveloperAgent = async (agentName: string, devFocus: string) => {
        const agentLLMConfig = { model: 'gpt-4o-mini', useFunctionCalling: true, temperature: 0.1 };
        const systemPrompt = `You are ${agentName}, a ${devFocus} Developer.\\nRespond with a JSON object: { \"tool_name\": \"developFeatureTool\", \"parameters\": { \"featureDescription\": \"<description_of_${devFocus}_part_of_main_feature>\" } }.\\nUser will provide the main feature name. Your task is to describe the ${devFocus} part of it for the 'developFeatureTool'.`;
        
        const config: AgentConfig = {
            name: agentName,
            description: `Develops ${devFocus} components.`,
            task: `Develop the ${devFocus} part of a given feature.`,
            tools: [developFeatureTool.name],
            llm: agentLLMConfig,
            systemPrompt
        };
        const agent = await symphony.agent.create(config);
        console.log(`✓ [Agent] ${agent.name} created successfully.`);
        return agent;
    };

    const frontendDevAgent = await createDeveloperAgent('FrontendDevAgent', 'frontend');
    const backendDevAgent = await createDeveloperAgent('BackendDevAgent', 'backend');

    const projectManagerAgentConfig: AgentConfig = {
        name: 'ProjectManagerAgent',
        description: 'Orchestrates feature integration.',
        task: 'Integrate frontend and backend components for the given feature.',
        tools: [integrateFeaturesTool.name],
        llm: { model: 'gpt-4o-mini', useFunctionCalling: true, temperature: 0.1 },
        systemPrompt: `You are a Project Manager. You will receive a user message containing the main feature name, frontend code, and backend code.\\nYour task is to integrate these components using the 'integrateFeaturesTool'.\\nExtract the mainFeatureName, frontendCode, and backendCode from the user message.\\nRespond with ONLY a JSON object:\\n{\\n  \"tool_name\": \"integrateFeaturesTool\",\\n  \"parameters\": {\\n    \"frontendCode\": \"<extracted_frontend_code>\",\\n    \"backendCode\": \"<extracted_backend_code>\",\\n    \"mainFeatureName\": \"<extracted_main_feature_name>\"\\n  }\\n}`
    };
    const projectManagerAgent = await symphony.agent.create(projectManagerAgentConfig);
    console.log(`✓ [Agent] ${projectManagerAgent.name} created successfully.\\n`);


    // --- Pipeline Definition ---
    const pipelineConfig: PipelineConfig = {
        name: 'ParallelFeatureDevelopmentPipeline',
        description: 'Develops frontend and backend components in parallel and then integrates them.',
        steps: [
            {
                name: 'Kickoff', // A dummy step to provide initial input if needed, or could be implicit
                type: 'tool', // Placeholder, actual input will come from pipeline.run(input)
                tool: developFeatureTool.name, // Arbitrary, just to make it a valid step, output not used.
                config: { featureDescription: 'Pipeline Start' }, // Static params for dummy tool use
                outputs: { kickoffMessage: 'result.codeOutput' } // map the output
            },
            {
                name: 'DevelopFrontend',
                type: 'agent',
                agent: frontendDevAgent.name,
                chained: '2.1',
                inputMap: async (context: PipelineContext) => ({ task: `Main Feature: ${context.variables.get('mainFeatureName')}. Develop the frontend part.` }),
                outputs: { frontendCode: 'result.toolsExecuted[0].result.codeOutput' }
            },
            {
                name: 'DevelopBackend',
                type: 'agent',
                agent: backendDevAgent.name,
                chained: '2.2',
                inputMap: async (context: PipelineContext) => ({ task: `Main Feature: ${context.variables.get('mainFeatureName')}. Develop the backend part.` }),
                outputs: { backendCode: 'result.toolsExecuted[0].result.codeOutput' }
            },
            {
                name: 'IntegrateFeatures',
                type: 'agent',
                agent: projectManagerAgent.name,
                chained: '3',
                inputMap: async (context: PipelineContext) => {
                    const mainFeature = context.variables.get('mainFeatureName');
                    const feCode = context.stepResults.get('DevelopFrontend')?.outputs?.frontendCode;
                    const beCode = context.stepResults.get('DevelopBackend')?.outputs?.backendCode;
                    return {
                        task: `Main Feature: \"${mainFeature}\"\\n\\nIntegrate the following components:\\n\\nFrontend Code:\\n\`\`\`\\n${feCode}\\n\`\`\`\\n\\nBackend Code:\\n\`\`\`\\n${beCode}\\n\`\`\`\\n\\nPlease respond with the JSON to call 'integrateFeaturesTool', including the mainFeatureName.`
                    };
                },
                outputs: { finalReport: 'result.toolsExecuted[0].result.integrationReport' }
            }
        ]
    };

    try {
        const pipeline = await symphony.pipeline.create(pipelineConfig);
        console.log(`✓ [Pipeline] "${pipeline.name}" created successfully.\\n`);

        const mainFeature = "User Authentication System";
        console.log(`[Pipeline Run] Starting pipeline for feature: "${mainFeature}"`);
        
        // Input for the pipeline (accessible via context.initialInput in inputMap)
        const pipelineInput = { mainFeatureName: mainFeature };
        
        const pipelineResult = await pipeline.run(pipelineInput);

        console.log('\\n✓ [Pipeline Run] Execution completed.');
        console.log('  Success:', pipelineResult.success);
        console.log('  Final Result (Integration Report):', pipelineResult.result?.output?.variables?.finalReport);
        
        if (!pipelineResult.success) {
            console.error('  Pipeline Errors:', pipelineResult.error, pipelineResult.metrics?.stepResults);
            throw new Error(`Pipeline execution failed. Full result: ${JSON.stringify(pipelineResult)}`);
        }

        const finalReport = pipelineResult.result?.output?.variables?.finalReport;
        if (!finalReport || typeof finalReport !== 'string' || !finalReport.includes(mainFeature)) {
            throw new Error(`Pipeline did not produce the expected integration report containing the feature name. Report: ${finalReport}`);
        }
        console.log('✓ [Verification] Pipeline produced an integration report including the main feature name.');

    } catch (error) {
        console.error('✗ [Pipeline Test] Pipeline creation or execution failed:', error);
        process.exit(1);
    }

    console.log('\\n=== Team Parallel Pipeline Test Complete ===');
}

testTeamParallelPipeline().catch(error => {
    console.error('Unhandled error during team parallel pipeline test execution:', error);
    process.exit(1);
}); 