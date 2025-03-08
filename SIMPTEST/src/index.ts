import { symphony } from './sdk';
import { tools } from './tools';
import { agents } from './agents';
import { teams } from './teams';
import { pipelines } from './pipelines';
import type { ComponentStatusDetails } from './sdk';

interface MetricData {
    success: boolean;
    result?: any;
    error?: string;
}

async function runExample() {
    console.log('Starting Symphony SDK example...\n');

    try {
        // Initialize Symphony core
        console.log('Initializing Symphony core...\n');
        await symphony.componentManager.initialize();

        // Initialize core services
        console.log('Initializing core services...\n');
        await symphony.validation.initialize();
        await symphony.tools.initialize();
        await symphony.agent.initialize();
        await symphony.team.initialize();
        await symphony.pipeline.initialize();

        // Initialize components
        console.log('Initializing components...\n');
        await tools.tripleAdd.initialize();
        await agents.calculatorAgent.initialize();
        await teams.calculatorTeam.initialize();
        await pipelines.calculatorPipeline.initialize();
        
        console.log('\nComponent initialization completed');

        // Run test scenarios
        await runTestScenarios();

    } catch (error) {
        console.error('\nExecution error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

async function runTestScenarios() {
    const scenarios = [
        {
            name: '1. Direct Tool Usage',
            run: async () => {
                const result = await tools.tripleAdd.run({
                    num1: 10,
                    num2: 20,
                    num3: 30
                });
                return result;
            }
        },
        {
            name: '2. Agent with Streaming',
            run: async () => {
                const result = await agents.calculatorAgent.run(
                    'Add the numbers 15, 25, and 35',
                    {
                        onProgress: (update: { status: string }) => {
                            console.log('  Progress:', update.status);
                        }
                    }
                );
                return result;
            }
        },
        {
            name: '3. Team Coordination',
            run: async () => {
                const result = await teams.calculatorTeam.run(
                    'Calculate (10, 20, 30) and (40, 50, 60) in parallel',
                    {
                        onProgress: (update: { status: string }) => {
                            console.log('  Progress:', update.status);
                        }
                    }
                );
                return result;
            }
        },
        {
            name: '4. Pipeline Execution',
            run: async () => {
                const result = await pipelines.calculatorPipeline.run();
                return result;
            }
        }
    ];

    console.log('\nRunning Test Scenarios:');
    console.log('=======================\n');

    for (const scenario of scenarios) {
        console.log(`\n${scenario.name}:`);
        console.log('-'.repeat(scenario.name.length + 1));
        
        const metricId = `test_${scenario.name.toLowerCase().replace(/\s+/g, '_')}`;
        symphony.startMetric(metricId);
        
        try {
            const result = await scenario.run();
            console.log('  Success!');
            console.log('  Result:', result.result);
            
            const successData: MetricData = {
                success: true,
                result: result.result
            };
            symphony.endMetric(metricId, successData);
        } catch (error) {
            console.error('  Failed:', error instanceof Error ? error.message : String(error));
            
            const errorData: MetricData = {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
            symphony.endMetric(metricId, errorData);
        }
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
