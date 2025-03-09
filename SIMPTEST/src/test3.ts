import symphony from './sdk';
import TypeInferencePipeline from './pipelines/typeInference';

async function testTypeInference() {
    console.log('[TEST] Starting type inference pipeline test...');
    
    // Initialize the pipeline through SDK
    const typeInferencePipeline = new TypeInferencePipeline();
    const pipeline = await symphony.pipeline.create(typeInferencePipeline.getConfig());
    
    // Test cases with increasing complexity
    const testCases = [
        {
            name: 'Simple Primitive',
            input: 'test',
            complexity: 2
        },
        {
            name: 'Nested Object',
            input: {
                name: 'test',
                value: 123,
                nested: {
                    array: [1, 2, 3],
                    flag: true
                }
            },
            complexity: 3
        },
        {
            name: 'Complex Array',
            input: [
                { type: 'string', value: 'test' },
                { type: 'number', value: 123 },
                { type: 'boolean', value: true },
                { 
                    type: 'object',
                    value: {
                        nested: [1, 2, 3],
                        deep: { a: 1, b: 2 }
                    }
                }
            ],
            complexity: 4
        },
        {
            name: 'Mixed Types',
            input: {
                string: 'test',
                number: 123,
                boolean: true,
                array: [1, 'two', false],
                object: {
                    date: new Date().toISOString(),
                    regex: '/test/',
                    func: 'x => x * 2'
                }
            },
            complexity: 5
        }
    ];

    // Run tests
    for (const testCase of testCases) {
        console.log(`\n[TEST] Running test case: ${testCase.name}`);
        console.log('[TEST] Input:', JSON.stringify(testCase.input, null, 2));
        
        const startTime = Date.now();
        const result = await typeInferencePipeline.run(pipeline, testCase.input, {
            complexity: testCase.complexity
        });
        
        console.log(`[TEST] Completed in ${Date.now() - startTime}ms`);
        
        if (result.success) {
            console.log('[TEST] Pipeline steps:');
            result.metadata.pipelineSteps?.forEach(step => {
                console.log(`  - ${step.name}:`);
                console.log(`    Duration: ${step.duration}ms`);
                console.log(`    Type Checks: ${step.typeChecks}`);
                console.log(`    Operations: ${step.operations}`);
            });
            
            console.log('\n[TEST] Overall metrics:');
            console.log(`  Total Duration: ${result.metrics.duration}ms`);
            console.log(`  Total Operations: ${result.metrics.totalOperations}`);
            console.log(`  Total Type Checks: ${result.metrics.totalTypeChecks}`);
            
            // Verify type safety
            console.log('\n[TEST] Type Analysis:');
            if (typeof result.metadata.typeAnalysis === 'object') {
                Object.entries(result.metadata.typeAnalysis).forEach(([path, type]) => {
                    console.log(`  ${path}: ${type}`);
                });
            }
        } else {
            console.error('[TEST] Test failed:', result.error);
        }
    }

    // Print summary
    console.log('\n[TEST] Test Summary:');
    console.log(`Total test cases: ${testCases.length}`);
    console.log('Type inference capabilities tested:');
    console.log('- Recursive type wrapping');
    console.log('- Complex object transformation');
    console.log('- Type analysis and inference');
    console.log('- String transformations');
    console.log('- Performance metrics');
}

// Run the test
testTypeInference().catch(console.error); 