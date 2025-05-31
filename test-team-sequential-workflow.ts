import { Symphony } from './src/symphony';
import { ToolConfig, ToolResult, AgentConfig } from './src/types/sdk';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

dotenv.config();

const TEST_OUTPUT_DIR = path.join(__dirname, 'test_outputs'); // General output dir

async function testTeamSequentialWorkflow() {
    console.log('=== Team Sequential Workflow Test ===\\n');

    // Ensure test output directory exists (though this test primarily deals with simulated string outputs)
    try {
        await fs.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    } catch (e) { /* ignore if exists */ }

    // Initialize Symphony
    console.log('[Symphony] Initializing...');
    const symphony = new Symphony({
        llm: { provider: 'openai', model: 'gpt-4o-mini', apiKey: process.env.OPENAI_API_KEY || 'test-key', useFunctionCalling: true, temperature: 0.1 },
        db: { enabled: false },
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

    // --- Tool Definitions ---

    const delegateTaskTool: ToolConfig = {
        name: 'delegateTaskTool',
        description: 'Delegates a task to the appropriate engineering role.',
        type: 'management',
        inputs: [{ name: 'taskDescription', type: 'string', required: true, description: 'The task to be delegated.' }],
        outputs: ['delegationDecision'],
        config: {},
        handler: async (params: { taskDescription: string }): Promise<ToolResult> => {
            const decision = `Task \\"${params.taskDescription}\\" delegated to JuniorEngineer for coding.`;
            console.log(`[Tool Handler - delegateTaskTool] Decision: ${decision}`);
            return { success: true, result: { delegationDecision: decision } };
        }
    };

    const writeCodeTool: ToolConfig = {
        name: 'writeCodeTool',
        description: 'Writes code for a given task description.',
        type: 'coding',
        inputs: [{ name: 'taskDescription', type: 'string', required: true, description: 'The description of the coding task.' }],
        outputs: ['code'],
        config: {},
        handler: async (params: { taskDescription: string }): Promise<ToolResult> => {
            const code = `// Code for: ${params.taskDescription}\\nconsole.log('Implementation of ${params.taskDescription}');`;
            console.log(`[Tool Handler - writeCodeTool] Generated code: ${code}`);
            return { success: true, result: { code } };
        }
    };

    const verifyCodeTool: ToolConfig = {
        name: 'verifyCodeTool',
        description: 'Verifies the provided code for accuracy and quality.',
        type: 'qa',
        inputs: [{ name: 'codeToVerify', type: 'string', required: true, description: 'The code to be verified.' }],
        outputs: ['verificationStatus'],
        config: {},
        handler: async (params: { codeToVerify: string }): Promise<ToolResult> => {
            const status = `Code starting with \\"${params.codeToVerify.substring(0, 30)}...\\" has been verified. LGTM!`;
            console.log(`[Tool Handler - verifyCodeTool] Status: ${status}`);
            return { success: true, result: { verificationStatus: status } };
        }
    };

    const createPRTool: ToolConfig = {
        name: 'createPRTool',
        description: 'Creates a pull request with the given task description and code.',
        type: 'communication',
        inputs: [
            { name: 'taskDescription', type: 'string', required: true, description: 'Original task description.' },
            { name: 'code', type: 'string', required: true, description: 'The code to include in the PR.' }
        ],
        outputs: ['prStatus'],
        config: {},
        handler: async (params: { taskDescription: string; code: string }): Promise<ToolResult> => {
            const status = `PR created for task \\"${params.taskDescription}\\". Code: \\"${params.code.substring(0, 30)}...\\"`;
            console.log(`[Tool Handler - createPRTool] Status: ${status}`);
            return { success: true, result: { prStatus: status } };
        }
    };

    // Register tools
    const toolRegistry = symphony.tool.registry;
    toolRegistry.registerTool(delegateTaskTool.name, delegateTaskTool);
    toolRegistry.registerTool(writeCodeTool.name, writeCodeTool);
    toolRegistry.registerTool(verifyCodeTool.name, verifyCodeTool);
    toolRegistry.registerTool(createPRTool.name, createPRTool);
    console.log('✓ [Tools] All team workflow tools registered.\\n');

    // --- Agent Definitions ---

    const createAgent = async (name: string, description: string, assignedTool: ToolConfig) => {
        const agentLLMConfig = { model: 'gpt-4o-mini', useFunctionCalling: true, temperature: 0.1 };
        const systemPrompt = `You are ${name}, ${description}.
You MUST respond with a JSON object containing "tool_name" and "parameters".
Your available tool is:
- Tool Name: "${assignedTool.name}"
  - Description: "${assignedTool.description}"
  - Parameters: ${JSON.stringify(assignedTool.inputs)}
Respond ONLY with the JSON object as described.`;

        const config: AgentConfig = {
            name,
            description,
            task: 'Follow instructions and use your assigned tool.', // Generic task
            tools: [assignedTool.name],
            llm: agentLLMConfig,
            systemPrompt
        };
        try {
            const agent = await symphony.agent.create(config);
            console.log(`✓ [Agent] ${name} created successfully.`);
            return agent;
        } catch (error) {
            console.error(`✗ [Agent] ${name} creation failed:`, error);
            throw error; // Re-throw to halt test
        }
    };

    const teamManagerAgent = await createAgent('TeamManagerAgent', 'responsible for delegating tasks.', delegateTaskTool);
    const juniorEngineerAgent = await createAgent('JuniorEngineerAgent', 'responsible for writing code.', writeCodeTool);
    const seniorEngineerAgent = await createAgent('SeniorEngineerAgent', 'responsible for verifying code.', verifyCodeTool);
    const communicatorAgent = await createAgent('CommunicatorAgent', 'responsible for creating pull requests.', createPRTool);
    console.log('\\n');

    // --- Workflow Execution ---
    let currentTaskDescription = "Implement a new feature: user login modal.";
    let codeWritten = "";
    let verificationResult = "";

    // Step 1: Team Manager delegates task
    console.log(`[Workflow Step 1] Manager to delegate: "${currentTaskDescription}"`);
    try {
        const managerResult = await teamManagerAgent.run(`Delegate the following task: ${currentTaskDescription}`);
        if (!managerResult.success || !managerResult.result?.toolsExecuted?.[0]?.result?.delegationDecision) {
            throw new Error(`Manager delegation failed or gave unexpected output: ${JSON.stringify(managerResult)}`);
        }
        const delegation = managerResult.result.toolsExecuted[0].result.delegationDecision;
        console.log(`  Manager's decision: ${delegation}
`);
        // For this test, we assume delegation implies passing currentTaskDescription to Junior
    } catch (error) {
        console.error('✗ [Workflow Step 1] Manager delegation failed:', error);
        process.exit(1);
    }

    // Step 2: Junior Engineer writes code
    console.log(`[Workflow Step 2] Junior Engineer to code for: "${currentTaskDescription}"`);
    try {
        const juniorResult = await juniorEngineerAgent.run(`Write code for the task: ${currentTaskDescription}`);
        if (!juniorResult.success || !juniorResult.result?.toolsExecuted?.[0]?.result?.code) {
            throw new Error(`Junior engineer coding failed or gave unexpected output: ${JSON.stringify(juniorResult)}`);
        }
        codeWritten = juniorResult.result.toolsExecuted[0].result.code;
        console.log(`  Junior's code: ${codeWritten.substring(0, 50)}...
`);
    } catch (error) {
        console.error('✗ [Workflow Step 2] Junior Engineer coding failed:', error);
        process.exit(1);
    }

    // Step 3: Senior Engineer verifies code
    console.log(`[Workflow Step 3] Senior Engineer to verify code: "${codeWritten.substring(0, 50)}..."`);
    try {
        const seniorResult = await seniorEngineerAgent.run(`Verify the following code: ${codeWritten}`);
        if (!seniorResult.success || !seniorResult.result?.toolsExecuted?.[0]?.result?.verificationStatus) {
            throw new Error(`Senior engineer verification failed or gave unexpected output: ${JSON.stringify(seniorResult)}`);
        }
        verificationResult = seniorResult.result.toolsExecuted[0].result.verificationStatus;
        console.log(`  Senior's verification: ${verificationResult}
`);
    } catch (error) {
        console.error('✗ [Workflow Step 3] Senior Engineer verification failed:', error);
        process.exit(1);
    }

    // Step 4: Communicator creates PR
    console.log(`[Workflow Step 4] Communicator to create PR for task: "${currentTaskDescription}" with verified code.`);
    try {
        const communicatorTask = `Create a PR for the task: "${currentTaskDescription}". The verified code is: ${codeWritten}`;
        const communicatorResult = await communicatorAgent.run(communicatorTask);
        if (!communicatorResult.success || !communicatorResult.result?.toolsExecuted?.[0]?.result?.prStatus) {
            throw new Error(`Communicator PR creation failed or gave unexpected output: ${JSON.stringify(communicatorResult)}`);
        }
        const prStatus = communicatorResult.result.toolsExecuted[0].result.prStatus;
        console.log(`  Communicator's PR status: ${prStatus}`);
        
        // Final verification
        if (!prStatus.includes(currentTaskDescription) || !prStatus.includes(codeWritten.substring(0, 30))) {
            throw new Error(`Final PR status does not seem to contain original task or code. Status: ${prStatus}`);
        }
        console.log('✓ [Verification] Final PR status seems correct.');

    } catch (error) {
        console.error('✗ [Workflow Step 4] Communicator PR creation failed:', error);
        process.exit(1);
    }

    console.log('\\n=== Team Sequential Workflow Test Complete ===');
}

// Run the test
testTeamSequentialWorkflow().catch(error => {
    console.error('Unhandled error during team sequential workflow test execution:', error);
    process.exit(1);
}); 