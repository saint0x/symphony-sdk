import sdkInstance from './sdk';
import TripleAddTool from './tools/calculator';
import CalculatorAgent from './agents/calculator';
import CalculatorTeam from './teams/calculator';
import CalculatorPipeline from './pipelines/calculator';

interface MetricData {
    success: boolean;
    result?: any;
    error?: string;
}

interface ProgressUpdate {
    status: string;
}

async function runExample() {
    console.log('Starting Symphony SDK example...\n');

    try {
        // Wait for SDK to initialize
        await sdkInstance;

        // Create component instances
        const tripleAddTool = new TripleAddTool();
        const calculatorAgent = new CalculatorAgent();
        const calculatorTeam = new CalculatorTeam();
        const calculatorPipeline = new CalculatorPipeline();
        
        // Run test scenarios
        await runTestScenarios(tripleAddTool, calculatorAgent, calculatorTeam, calculatorPipeline);
    } catch (error) {
        console.error('Error running example:', error);
        process.exit(1);
    }
}

async function runTestScenarios(
    tripleAddTool: TripleAddTool,
    calculatorAgent: CalculatorAgent,
    calculatorTeam: CalculatorTeam,
    calculatorPipeline: CalculatorPipeline
) {
    console.log('Running test scenarios...\n');

    // Test tool
    console.log('1. Testing Triple Add Tool:');
    const toolResult = await tripleAddTool.run({ num1: 10, num2: 20, num3: 30 });
    console.log('Tool result:', toolResult, '\n');

    // Test agent
    console.log('2. Testing Calculator Agent:');
    const agentResult = await calculatorAgent.run('Add the numbers 10, 20, and 30');
    console.log('Agent result:', agentResult, '\n');

    // Test team
    console.log('3. Testing Calculator Team:');
    const teamResult = await calculatorTeam.run('Calculate (10, 20, 30) and (40, 50, 60) in parallel');
    console.log('Team result:', teamResult, '\n');

    // Test pipeline
    console.log('4. Testing Calculator Pipeline:');
    const pipelineResult = await calculatorPipeline.run({
        operation: 'add',
        numbers: [10, 20, 30]
    });
    console.log('Pipeline result:', pipelineResult, '\n');

    console.log('All test scenarios completed\n');
}

runExample().catch(error => {
    console.error('Failed to run example:', error);
    process.exit(1);
});
