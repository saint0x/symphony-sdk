import { symphony } from 'symphonic';
import { tripleAddTool } from './tools/calculator';
import { calculatorAgent } from './agents/calculator';
import { calculatorTeam } from './teams';
import { calculatorPipeline } from './pipelines';

async function runExample() {
    console.log('Starting Symphony SDK example...\n');

    try {
        // Initialize Symphony
        await symphony.initialize();
        console.log('Symphony SDK initialized successfully\n');

        // 1. Direct tool usage
        console.log('1. Testing direct tool usage...');
        const toolMetricId = 'direct_tool_test';
        symphony.startMetric(toolMetricId);
        
        try {
            const toolResult = await tripleAddTool.run({
                num1: 10,
                num2: 20,
                num3: 30
            });
            console.log('Tool success! Result:', toolResult.result);
            
            symphony.endMetric(toolMetricId, {
                success: true,
                result: toolResult.result
            });
        } catch (error) {
            symphony.endMetric(toolMetricId, {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }

        // 2. Agent usage with streaming
        console.log('\n2. Testing agent with streaming...');
        const agentMetricId = 'agent_test';
        symphony.startMetric(agentMetricId);
        
        try {
            const agentResult = await calculatorAgent.run(
                'Add the numbers 15, 25, and 35',
                {
                    onProgress: (update: { status: string }) => {
                        console.log('Agent progress:', update.status);
                    }
                }
            );
            console.log('Agent success! Result:', agentResult.result);
            
            symphony.endMetric(agentMetricId, {
                success: true,
                result: agentResult.result
            });
        } catch (error) {
            symphony.endMetric(agentMetricId, {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }

        // 3. Team usage with monitoring
        console.log('\n3. Testing team coordination...');
        const teamMetricId = 'team_test';
        symphony.startMetric(teamMetricId);
        
        try {
            const teamResult = await calculatorTeam.run(
                'Calculate (10 + 20 + 30) and (40 + 50 + 60) in parallel',
                {
                    onProgress: (update: { status: string }) => {
                        console.log('Team progress:', update.status);
                    }
                }
            );
            console.log('Team success! Results:', teamResult.result);
            
            symphony.endMetric(teamMetricId, {
                success: true,
                results: teamResult.result
            });
        } catch (error) {
            symphony.endMetric(teamMetricId, {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }

        // 4. Pipeline usage with monitoring
        console.log('\n4. Testing pipeline execution...');
        const pipelineMetricId = 'pipeline_test';
        symphony.startMetric(pipelineMetricId);
        
        try {
            const pipelineResult = await calculatorPipeline.run();
            console.log('Pipeline success! Final result:', pipelineResult.result);
            
            symphony.endMetric(pipelineMetricId, {
                success: true,
                result: pipelineResult.result,
                stepResults: pipelineResult.stepResults
            });
        } catch (error) {
            symphony.endMetric(pipelineMetricId, {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }

        // Print final metrics summary
        console.log('\nTest run complete! Metrics summary:');
        const metrics = symphony.metrics.getMetrics();
        Object.entries(metrics).forEach(([id, data]) => {
            console.log(`\n${id}:`, data);
        });

    } catch (error) {
        console.error('\nExecution error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

// Run the example
runExample().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
