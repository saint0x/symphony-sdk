import { symphony } from '../../src';
import { logger } from '../../src/utils/logger';
import { LLMConfiguration } from '../../src/llm/config';

// Initialize LLM configuration
const llmConfig = LLMConfiguration.getInstance();
llmConfig.setProviderConfig('openai', {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o-mini-2024-07-18',
    maxTokens: 2048,
    temperature: 0.7
});

// Ensure required environment variables are set
if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required for tests');
}

process.env.DEFAULT_LLM_PROVIDER = 'openai'; // Explicitly set OpenAI as provider
process.env.DEFAULT_LLM_MODEL = 'gpt-4o-mini-2024-07-18'; // Set the correct model

interface SearchResult {
    title: string;
    link: string;
    snippet: string;
    source?: string;
    published_date?: string;
    additional_info?: Record<string, string>;
}

interface ToolResult {
    success: boolean;
    data?: {
        content?: string;
        response?: string;
        results?: SearchResult[];
    };
    error?: string;
}

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

// Create LLM-capable agent for testing
const searchAgent = await symphony.agent.create({
    name: "search_agent",
    description: "handles search operations and analysis",
    task: "perform web searches and analyze results",
    tools: ["webSearch"],
    llm: {
        provider: "openai",
        model: "gpt-4o-mini-2024-07-18"
    },
    maxCalls: 5,
    requireApproval: false,
    timeout: 5000
});

export class LLMSearchTester {
    async testLLMBasic() {
        logger.info('Testing basic LLM capabilities');
        const startTime = Date.now();

        try {
            logger.debug('Starting basic LLM test', {
                metadata: {
                    agent: searchAgent.name,
                    llm: searchAgent.llm,
                    query: "What is the capital of France?"
                }
            });

            const result = await searchAgent.run("What is the capital of France?") as ToolResult;
            
            logger.debug('LLM response received', {
                metadata: {
                    success: result.success,
                    error: result.error,
                    responseLength: result.data?.content?.length || result.data?.response?.length,
                    tokenMetrics: result.data?.metrics?.tokenCounts,
                    duration: Date.now() - startTime
                }
            });

            if (!result.success || !result.data) {
                logger.error('LLM execution failed', {
                    metadata: {
                        error: result.error,
                        apiDetails: {
                            provider: searchAgent.llm.provider,
                            model: searchAgent.llm.model,
                            keyPresent: !!process.env.OPENAI_API_KEY,
                            keyLength: process.env.OPENAI_API_KEY?.length
                        }
                    }
                });
                throw new Error('Agent execution failed');
            }

            // Don't fail the test if token counting failed
            if (result.data.metrics?.tokenCounts === null) {
                logger.warn('Token counting failed but agent execution succeeded');
            }

            // Verify response content
            const response = result.data.content || result.data.response;
            if (typeof response !== 'string' || !response.toLowerCase().includes('paris')) {
                logger.error('Invalid response content', {
                    metadata: {
                        responseType: typeof response,
                        responseLength: response?.length,
                        containsExpectedTerm: response?.toLowerCase().includes('paris')
                    }
                });
                throw new Error('Response did not contain expected content (Paris)');
            }

            return {
                success: true,
                result: result.data,
                metrics: { duration: Date.now() - startTime }
            };
        } catch (error: any) {
            logger.error('Basic LLM test failed', {
                metadata: {
                    error: error.message,
                    stack: error.stack,
                    apiDetails: {
                        provider: searchAgent.llm.provider,
                        model: searchAgent.llm.model,
                        keyPresent: !!process.env.OPENAI_API_KEY,
                        keyLength: process.env.OPENAI_API_KEY?.length
                    }
                }
            });
            return {
                success: false,
                error: error.message,
                metrics: { duration: Date.now() - startTime }
            };
        }
    }

    async testLLMSequential() {
        logger.info('Testing sequential LLM responses');
        const startTime = Date.now();

        try {
            const responses: any[] = [];
            const numbers = ['one', '1', 'first', 'two', '2', 'second', 'three', '3', 'third', 'four', '4', 'fourth', 'five', '5', 'fifth'];
            
            // Get five sequential responses
            for (let i = 1; i <= 5; i++) {
                const result = await searchAgent.run(`Tell me about the number ${i}`) as ToolResult;
                
                if (!result.success || !result.data) {
                    throw new Error(`Failed to get response ${i}`);
                }

                // Don't fail the test if token counting failed
                if (result.data.metrics?.tokenCounts === null) {
                    logger.warn(`Token counting failed but agent execution succeeded for response ${i}`);
                }

                // Verify response mentions the number
                const response = result.data.content || result.data.response;
                if (typeof response !== 'string' || !numbers.some(num => response.toLowerCase().includes(num))) {
                    throw new Error(`Response ${i} did not contain the expected number`);
                }
                responses.push(response);
            }

            return {
                success: true,
                result: { responses },
                metrics: { duration: Date.now() - startTime }
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                metrics: { duration: Date.now() - startTime }
            };
        }
    }

    async testSearch() {
        logger.info('Testing search capabilities');
        const startTime = Date.now();

        try {
            const searchQuery = "Search for latest developments in quantum computing 2024";
            
            logger.debug('Starting search test', {
                metadata: {
                    agent: searchAgent.name,
                    query: searchQuery,
                    tools: searchAgent.tools
                }
            });

            const result = await searchAgent.run(searchQuery) as ToolResult;
            
            logger.debug('Search results received', {
                metadata: {
                    success: result.success,
                    error: result.error,
                    resultCount: result.data?.results?.length,
                    duration: Date.now() - startTime
                }
            });
            
            // Verify search results format
            if (!result.success || !result.data || !Array.isArray(result.data.results)) {
                logger.error('Invalid search results format', {
                    metadata: {
                        success: result.success,
                        error: result.error,
                        dataType: typeof result.data,
                        resultsType: result.data ? typeof result.data.results : 'undefined'
                    }
                });
                throw new Error('Search returned invalid results format');
            }

            // Verify search results content
            const results = result.data.results;
            if (results.length === 0) {
                logger.error('Empty search results', {
                    metadata: {
                        query: searchQuery
                    }
                });
                throw new Error('Search returned no results');
            }

            // Check if results contain relevant keywords
            const relevantTerms = ['quantum', 'computing', '2024', 'computer', 'qubits'];
            const contentAnalysis = results.map(result => {
                const content = (result.title + ' ' + result.snippet).toLowerCase();
                return {
                    title: result.title,
                    hasRelevantTerms: relevantTerms.filter(term => content.includes(term))
                };
            });

            const hasRelevantContent = contentAnalysis.some(analysis => analysis.hasRelevantTerms.length > 0);

            if (!hasRelevantContent) {
                logger.error('Search results not relevant', {
                    metadata: {
                        query: searchQuery,
                        contentAnalysis,
                        expectedTerms: relevantTerms
                    }
                });
                throw new Error('Search results not relevant to query');
            }

            logger.info('Search results analysis', {
                metadata: {
                    resultCount: results.length,
                    relevantResults: contentAnalysis.filter(a => a.hasRelevantTerms.length > 0).length,
                    topTerms: contentAnalysis.reduce((acc, curr) => {
                        curr.hasRelevantTerms.forEach(term => acc[term] = (acc[term] || 0) + 1);
                        return acc;
                    }, {} as Record<string, number>)
                }
            });

            return {
                success: true,
                result: result.data,
                metrics: { duration: Date.now() - startTime }
            };
        } catch (error: any) {
            logger.error('Search test failed', {
                metadata: {
                    error: error.message,
                    stack: error.stack
                }
            });
            return {
                success: false,
                error: error.message,
                metrics: { duration: Date.now() - startTime }
            };
        }
    }

    async testLLMWithSearch() {
        logger.info('Testing LLM with search integration');
        const startTime = Date.now();

        try {
            // First perform search
            const searchResult = await searchAgent.run("Search for latest breakthrough in fusion energy") as ToolResult;
            
            // Verify search results format
            if (!searchResult.success || !searchResult.data || !Array.isArray(searchResult.data.results)) {
                throw new Error('Search returned invalid results format');
            }

            // Don't fail the test if token counting failed
            if (searchResult.data.metrics?.tokenCounts === null) {
                logger.warn('Token counting failed but search succeeded');
            }

            // Verify search results content
            const results = searchResult.data.results;
            if (results.length === 0) {
                throw new Error('Search returned no results');
            }

            // Check if results contain relevant keywords
            const searchTerms = ['fusion', 'energy', 'breakthrough', 'reactor', 'plasma'];
            const hasRelevantContent = results.some(result => {
                const content = (result.title + ' ' + result.snippet).toLowerCase();
                return searchTerms.some(term => content.includes(term));
            });

            if (!hasRelevantContent) {
                throw new Error('Search results not relevant to query');
            }

            // Then analyze results
            const analysisResult = await searchAgent.run(`Analyze these search results about fusion energy breakthroughs: ${JSON.stringify(results)}`) as ToolResult;
            
            if (!analysisResult.success || !analysisResult.data) {
                throw new Error('Analysis failed');
            }

            // Don't fail the test if token counting failed
            if (analysisResult.data.metrics?.tokenCounts === null) {
                logger.warn('Token counting failed but analysis succeeded');
            }

            // Verify analysis content
            const analysis = analysisResult.data.content || analysisResult.data.response;
            if (typeof analysis !== 'string' || !searchTerms.some(term => analysis.toLowerCase().includes(term))) {
                throw new Error('Analysis not relevant to search results');
            }

            return {
                success: true,
                result: {
                    search: searchResult.data,
                    analysis: analysisResult.data
                },
                metrics: { duration: Date.now() - startTime }
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                metrics: { duration: Date.now() - startTime }
            };
        }
    }

    async runAllTests() {
        logger.info('Starting LLM and search test suite');

        const results = {
            llmBasic: await this.testLLMBasic(),
            llmSequential: await this.testLLMSequential(),
            search: await this.testSearch(),
            llmWithSearch: await this.testLLMWithSearch()
        };

        const failedTests = Object.entries(results)
            .filter(([_, result]) => !result.success)
            .map(([test, result]) => ({
                test,
                error: result.error || 'Unknown error'
            }));

        const success = failedTests.length === 0;

        logger.info('LLM and search tests completed', {
            metadata: {
                success,
                totalTests: Object.keys(results).length,
                failedTests: failedTests.length
            }
        });

        return {
            success,
            results,
            failedTests: failedTests.length > 0 ? failedTests : undefined
        };
    }
}

// Export test runner function
export async function runLLMSearchTests() {
    const tester = new LLMSearchTester();
    return await tester.runAllTests();
} 