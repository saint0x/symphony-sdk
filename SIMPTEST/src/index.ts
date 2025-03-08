import { symphony } from './sdk';
import type { ComponentStatusDetails } from './sdk';
import { tripleAddTool } from './tools/calculator';
import { calculatorAgent } from './agents/calculator';
import { calculatorTeam } from './teams/calculator';
import { calculatorPipeline } from './pipelines/calculator';

interface MetricData {
    success: boolean;
    result?: any;
    error?: string;
}

async function runExample() {
    console.log('Starting Symphony SDK example...\n');

    try {
        // Initialize Symphony core first
        console.log('Initializing Symphony core...\n');
        await symphony.initialize();

        // Wait for registry to be ready
        const registry = await symphony.getRegistry();
        if (!registry) {
            throw new Error('Failed to initialize registry');
        }

        // Initialize components in dependency order
        console.log('Initializing components...\n');
        
        // 1. Initialize tool first since others depend on it
        await tripleAddTool.initialize();
        console.log('Tool initialized');
        
        // 2. Initialize agent which depends on tool
        await calculatorAgent.initialize();
        console.log('Agent initialized');
        
        // 3. Initialize team which depends on agent
        await calculatorTeam.initialize();
        console.log('Team initialized');
        
        // 4. Initialize pipeline which depends on all above
        await calculatorPipeline.initialize();
        console.log('Pipeline initialized');
        
        console.log('\nComponent initialization completed\n');

        // Run test scenarios
        await runTestScenarios();

    } catch (error) {
        console.error('\nExecution error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

async function runTestScenarios() {
    console.log('\nRunning Test Scenarios:');
    console.log('=======================\n');

    // 1. Direct Tool Usage
    console.log('\n1. Direct Tool Usage:');
    console.log('---------------------');
    try {
        const result = await tripleAddTool.run({ num1: 10, num2: 20, num3: 30 });
        console.log('  Success!');
        console.log('  Result:', result.result);
    } catch (error) {
        console.log('  Failed:', error instanceof Error ? error.message : String(error));
    }

    // 2. Agent with Streaming
    console.log('\n2. Agent with Streaming:');
    console.log('------------------------');
    try {
        const result = await calculatorAgent.run('Add the numbers 40, 50, and 60', {
            onProgress: (update: { status: string; result?: any }) => console.log('  Progress:', update.status)
        });
        console.log('  Success!');
        console.log('  Result:', result.result);
    } catch (error) {
        console.log('  Failed:', error instanceof Error ? error.message : String(error));
    }

    // 3. Team Coordination
    console.log('\n3. Team Coordination:');
    console.log('---------------------');
    try {
        const result = await calculatorTeam.run('Calculate (70, 80, 90) in parallel', {
            onProgress: (update: { status: string; result?: any }) => console.log('  Progress:', update.status)
        });
        console.log('  Success!');
        console.log('  Result:', result.result);
    } catch (error) {
        console.log('  Failed:', error instanceof Error ? error.message : String(error));
    }

    // 4. Pipeline Execution
    console.log('\n4. Pipeline Execution:');
    console.log('----------------------');
    try {
        const result = await calculatorPipeline.run();
        console.log('  Success!');
        console.log('  Result:', result.result);
    } catch (error) {
        console.log('  Failed:', error instanceof Error ? error.message : String(error));
    }
}

interface DependencyStatus {
    name: string;
    status: string;
}

function printComponentStatus(statuses: Map<string, ComponentStatusDetails>) {
    for (const [name, state] of statuses) {
        console.log(`\n${name}:`);
        console.log('  Status:', state.status);
        console.log('  Initialization Attempts:', state.initAttempts);
        if (state.lastAttemptTime) {
            console.log('  Last Attempt:', new Date(state.lastAttemptTime).toISOString());
        }
        if (state.error) {
            console.log('  Error:', state.error.message);
        }
        if (state.dependencies.length > 0) {
            console.log('  Dependencies:');
            state.dependencies.forEach((dep: DependencyStatus) => {
                console.log(`    ${dep.name}: ${dep.status}`);
            });
        }
        if (state.validationResult) {
            console.log('  Validation:');
            console.log('    Success:', state.validationResult.success);
            if (state.validationResult.lastValidated) {
                console.log('    Last Validated:', new Date(state.validationResult.lastValidated).toISOString());
            }
            if (state.validationResult.error) {
                console.log('    Error:', state.validationResult.error);
            }
        }
    }
}

// Run the example
runExample().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
