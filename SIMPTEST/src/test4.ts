import sdkInstance from './sdk';
import { IToolService } from '../../src/services/interfaces';
import { envConfig } from '../../src/utils/env';

// Add listStandardTools to IToolService interface
declare module '../../src/services/interfaces' {
    interface IToolService {
        listStandardTools(): Promise<string[]>;
    }
}

async function runEnhancedTest() {
    try {
        console.log('\n[TEST] Starting enhanced test...');
        
        // Wait for SDK to initialize
        console.log('[SDK] Waiting for SDK initialization...');
        await sdkInstance.initialize();
        console.log('[SDK] SDK initialized successfully');

        // List available tools
        console.log('\n[TOOLS] Checking available tools...');
        const tools = await sdkInstance.tool.listStandardTools();
        console.log('[TOOLS] Available standard tools:', tools);

        // First, do a web search
        console.log('\n[WEBSEARCH] Performing web search...');
        console.log('[WEBSEARCH] Creating webSearchTool...');
        const webSearchTool = await sdkInstance.tool.getTool('webSearchTool');
        console.log('[WEBSEARCH] Tool created:', webSearchTool.name);
        
        console.log('[WEBSEARCH] Executing search...');
        const searchResult = await webSearchTool.run({ 
            query: "latest innovations in AI technology 2024",
            type: "search"
        });

        if (!searchResult.success) {
            throw new Error(`Web search failed: ${searchResult.error}`);
        }

        console.log('[WEBSEARCH] Search successful');
        console.log('[WEBSEARCH] Raw result structure:', 
            JSON.stringify(searchResult, null, 2)
        );
        
        // Handle the nested results structure from the tool
        const searchResults = searchResult.result?.organic || [];
        console.log('\n[WEBSEARCH] Top search results:');
        searchResults.slice(0, 3).forEach((result: any, index: number) => {
            console.log(`\n[WEBSEARCH] Result ${index + 1}:`);
            console.log(`Title: ${result.title}`);
            console.log(`Link: ${result.link}`);
            console.log(`Snippet: ${result.snippet}`);
        });

        // Test the ponder tool with LLM integration
        console.log('\n[PONDER] Testing ponder tool with LLM integration...');
        const ponderTool = await sdkInstance.tool.getTool('ponderTool');
        console.log('[PONDER] Tool created:', ponderTool.name);

        // Get the LLM configuration from envConfig
        const llmConfig = {
            provider: 'openai',
            model: envConfig.defaultModel,
            temperature: envConfig.defaultTemperature,
            maxTokens: envConfig.defaultMaxTokens,
            systemPrompt: `You are an advanced cognitive engine designed for deep analysis and insight generation.
Your purpose is to explore complex topics with intellectual rigor and emergent understanding.

Your cognitive architecture:
1. First-principles thinking
2. Systems-level analysis
3. Metacognitive awareness
4. Insight synthesis
5. Uncertainty quantification

You excel at:
- Breaking down complex ideas
- Finding hidden connections
- Generating novel insights
- Maintaining intellectual humility
- Building upon existing knowledge

Format your responses using appropriate tags:
<thinking> for thought processes
<observation> for initial perceptions
<analysis> for detailed examination
<synthesis> for combining insights
<implication> for consequences
<metacognition> for self-reflection
<evidence> for supporting data
<uncertainty> for areas of doubt
<insight> for key realizations`,
            topP: envConfig.defaultTopP || 0.9, // Use envConfig value if available
            presencePenalty: envConfig.defaultPresencePenalty || 0.1,
            frequencyPenalty: envConfig.defaultFrequencyPenalty || 0.1
        };

        console.log('\n[LLM] Current configuration:');
        console.log(JSON.stringify(llmConfig, null, 2));

        console.log('\n[PONDER] Executing deep analysis with LLM...');
        const ponderResult = await ponderTool.run({
            query: "What are the key implications of these AI developments for society and technology?",
            context: { 
                searchResults: searchResults.map((r: any) => ({
                    title: r.title,
                    snippet: r.snippet
                })),
                currentYear: new Date().getFullYear(),
                domainContext: {
                    technology: 'artificial intelligence',
                    scope: 'societal and technological implications',
                    timeframe: 'near to medium term',
                    perspective: 'holistic analysis'
                }
            },
            steps: 3,
            depth: 3, // Increased depth for more thorough analysis
            llmConfig
        });

        if (!ponderResult.success) {
            throw new Error(`Ponder analysis failed: ${ponderResult.error}`);
        }

        console.log('\n[PONDER] Analysis successful');
        
        // Display thinking evolution
        console.log('\n[PONDER] Thinking Evolution:');
        ponderResult.result.metaAnalysis.thinkingEvolution.forEach((step: any, index: number) => {
            console.log(`\nStep ${index + 1} (${step.pattern}):`);
            console.log(`Depth: ${step.depth}`);
            console.log(`Key Insight: ${step.keyInsight}`);
        });

        // Display structured thoughts
        console.log('\n[PONDER] Structured Thoughts:');
        ponderResult.result.thoughts.forEach((thought: any, index: number) => {
            console.log(`\nThought ${index + 1} (${thought.pattern}):`);
            console.log(`- Observation: ${thought.observation}`);
            console.log(`- Analysis: ${thought.analysis}`);
            console.log(`- Synthesis: ${thought.synthesis}`);
            console.log(`- Implications: ${thought.implication}`);
            console.log(`- Confidence: ${thought.confidence}`);
        });

        // Display meta-analysis
        console.log('\n[PONDER] Meta Analysis:');
        console.log(`- Patterns Covered: ${ponderResult.result.metaAnalysis.patternsCovered.join(', ')}`);
        console.log(`- Depth Reached: ${ponderResult.result.metaAnalysis.depthReached}`);
        console.log(`- Insight Count: ${ponderResult.result.metaAnalysis.insightCount}`);
        console.log(`- Average Confidence: ${
            ponderResult.result.metaAnalysis.confidenceDistribution.reduce((a: number, b: number) => a + b, 0) / 
            ponderResult.result.metaAnalysis.confidenceDistribution.length
        }`);

        // Display final conclusion
        console.log('\n[PONDER] Final Conclusion:');
        console.log('Summary:', ponderResult.result.conclusion.summary);
        console.log('\nKey Insights:');
        ponderResult.result.conclusion.keyInsights.forEach((insight: string, index: number) => {
            console.log(`${index + 1}. ${insight}`);
        });
        console.log('\nImplications:', ponderResult.result.conclusion.implications);
        console.log('\nUncertainties:', ponderResult.result.conclusion.uncertainties);
        console.log('\nNext Steps:');
        ponderResult.result.conclusion.nextSteps.forEach((step: string, index: number) => {
            console.log(`${index + 1}. ${step}`);
        });

        console.log('\n[TEST] Enhanced test completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Test failed:', error);
        process.exit(1);
    }
}

// Add timestamp to logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = (...args) => {
    originalConsoleLog(`[${new Date().toISOString()}]`, ...args);
};
console.error = (...args) => {
    originalConsoleError(`[${new Date().toISOString()}]`, ...args);
};

runEnhancedTest(); 