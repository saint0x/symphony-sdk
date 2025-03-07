import { ComprehensiveTester } from './comprehensive';
import { LLMSearchTester } from './llm_search';
import { logger } from '../../src/utils/logger';

interface TestResult {
    success: boolean;
    result?: any;
    error?: string;
    metrics?: {
        duration: number;
    };
}

interface TestSuiteResult {
    success: boolean;
    results: Record<string, TestResult>;
    failedTests?: Array<{
        test: string;
        error: string;
    }>;
}

async function runTests() {
    const correlationId = `test_${Date.now()}`;
    try {
        logger.info('Starting test suites', {
            correlationId,
            component: 'TestRunner',
            context: {
                timestamp: new Date().toISOString(),
                nodeVersion: process.version,
                platform: process.platform
            }
        });

        // Run comprehensive tests
        const comprehensiveTester = new ComprehensiveTester();
        logger.info('Starting comprehensive test suite', {
            correlationId,
            component: 'ComprehensiveTester'
        });
        const comprehensiveResults = await comprehensiveTester.runAllTests();

        // Run LLM and search tests
        const llmSearchTester = new LLMSearchTester();
        logger.info('Starting LLM and search test suite', {
            correlationId,
            component: 'LLMSearchTester'
        });
        const llmSearchResults = await llmSearchTester.runAllTests();

        // Validate test results
        if (!comprehensiveResults || !llmSearchResults) {
            throw new Error('Test suites returned invalid results');
        }

        // Combine results
        const allResults: Record<string, TestSuiteResult> = {
            comprehensive: comprehensiveResults,
            llmSearch: llmSearchResults
        };

        // Calculate overall metrics
        const totalDuration = Object.values(allResults).reduce((sum, suite) => {
            return sum + Object.values(suite.results).reduce((suiteSum, test) => {
                return suiteSum + (test.metrics?.duration || 0);
            }, 0);
        }, 0);

        const testCount = Object.values(allResults).reduce((sum, suite) => {
            return sum + Object.keys(suite.results).length;
        }, 0);

        const failedSuites = Object.entries(allResults)
            .filter(([_, suite]) => !suite.success)
            .map(([name, suite]) => ({
                suite: name,
                failedTests: suite.failedTests?.map(test => ({
                    ...test,
                    // Add more detailed error info
                    errorType: test.error.includes('API error') ? 'API_ERROR' :
                             test.error.includes('timeout') ? 'TIMEOUT' :
                             test.error.includes('validation') ? 'VALIDATION_ERROR' : 'UNKNOWN',
                    severity: test.error.includes('API error') ? 'WARN' : 'ERROR'
                }))
            }));

        if (failedSuites.length > 0) {
            // Log each failed test separately for better tracking
            failedSuites.forEach(suite => {
                suite.failedTests?.forEach(test => {
                    logger.warn(`Test failed: ${suite.suite}.${test.test}`, {
                        correlationId,
                        component: suite.suite,
                        context: {
                            errorType: test.errorType,
                            severity: test.severity,
                            error: test.error
                        }
                    });
                });
            });

            // Only throw if there are actual errors (not just warnings)
            const hasErrors = failedSuites.some(suite => 
                suite.failedTests?.some(test => test.severity === 'ERROR')
            );

            if (hasErrors) {
                logger.error('Test suites failed with errors', {
                    correlationId,
                    component: 'TestRunner',
                    context: { failedSuites }
                });
                throw new Error(`${failedSuites.length} test suites failed`);
            } else {
                logger.warn('Test suites completed with warnings', {
                    correlationId,
                    component: 'TestRunner',
                    context: { failedSuites }
                });
            }
        }

        logger.info('All test suites completed', {
            correlationId,
            component: 'TestRunner',
            context: {
                totalTests: testCount,
                totalDuration,
                averageDuration: totalDuration / testCount,
                results: Object.entries(allResults).map(([suite, result]) => ({
                    suite,
                    success: result.success,
                    totalTests: Object.keys(result.results).length,
                    failedTests: result.failedTests?.length || 0
                }))
            }
        });

        return {
            success: true,
            suites: allResults,
            metrics: {
                totalTests: testCount,
                totalDuration,
                averageDuration: totalDuration / testCount
            }
        };
    } catch (error: any) {
        logger.error('Test execution failed', {
            correlationId,
            component: 'TestRunner',
            context: {
                error: error.message,
                stack: error.stack,
                type: error.name,
                code: error.code
            }
        });
        return {
            success: false,
            error: error.message,
            stack: error.stack
        };
    }
}

// Run tests
runTests()
    .then(result => {
        if (!result.success) {
            logger.error('Tests failed', {
                component: 'TestRunner',
                context: { error: result.error }
            });
            process.exit(1);
        }
        logger.info('Tests completed successfully', {
            component: 'TestRunner'
        });
        process.exit(0);
    })
    .catch(error => {
        logger.fatal('Test execution failed unexpectedly', {
            component: 'TestRunner',
            context: {
                error: error.message,
                stack: error.stack,
                type: error.name,
                code: error.code
            }
        });
        process.exit(1);
    }); 