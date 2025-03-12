import sdkInstance from './sdk';
import { performance } from 'perf_hooks';

// Add timestamp to all logs
const originalConsoleLog = console.log;
console.log = (...args) => {
    originalConsoleLog(`[${new Date().toISOString()}]`, ...args);
};

async function runCognitivePipeline() {
    console.log('Starting cognitive analysis pipeline...');
    
    // Initialize SDK
    console.log('Initializing SDK...');
    await sdkInstance.initialize();
    console.log('SDK initialized successfully');

    try {
        // Create web search tool
        console.log('Setting up web search tool...');
        const webSearchTool = await sdkInstance.tool.getTool('webSearchTool');
        
        // Execute search
        console.log('Executing web search for biomimetic architecture...');
        const searchResult = await webSearchTool.run({ 
            query: "latest innovations in biomimetic architecture and sustainable urban design 2024",
            type: "search"
        });

        const searchResults = searchResult.result?.organic || [];
        console.log('\nTop search results:');
        searchResults.slice(0, 3).forEach((result: any, index: number) => {
            console.log(`\nResult ${index + 1}:`);
            console.log(`Title: ${result.title}`);
            console.log(`Link: ${result.link}`);
            console.log(`Snippet: ${result.snippet}`);
        });

        // Create ponder tool
        console.log('\nInitializing ponder tool for deep analysis...');
        const ponderTool = await sdkInstance.tool.getTool('ponderTool');
        
        // Prepare rich context for analysis
        const context = {
            searchResults: searchResults.slice(0, 3).map((r: any) => ({
                title: r.title,
                snippet: r.snippet
            })),
            currentYear: new Date().getFullYear(),
            domainContext: {
                technology: 'biomimetic architecture',
                scope: 'urban development and sustainability',
                timeframe: 'near to long term',
                perspective: 'interdisciplinary synthesis',
                focusAreas: [
                    'biological inspiration',
                    'sustainable materials',
                    'adaptive systems',
                    'urban ecology',
                    'social impact'
                ]
            }
        };

        // Execute deep analysis
        console.log('Beginning deep cognitive analysis...');
        const ponderResult = await ponderTool.run({
            query: "What are the most radical and transformative implications of biomimetic architecture for the future of human habitation and urban ecosystems? Consider unexpected connections and revolutionary possibilities.",
            context: context
        });

        // Output analysis results
        console.log('\n=== Cognitive Analysis Results ===');
        console.log('\nThinking Evolution:');
        console.log(JSON.stringify(ponderResult.result?.thinkingEvolution, null, 2));
        
        console.log('\nKey Thoughts:');
        console.log(JSON.stringify(ponderResult.result?.thoughts, null, 2));
        
        console.log('\nMeta Analysis:');
        console.log(JSON.stringify(ponderResult.result?.metaAnalysis, null, 2));
        
        console.log('\nAvant-Garde Conclusions:');
        console.log(JSON.stringify(ponderResult.result?.conclusion, null, 2));

    } catch (error) {
        console.error('Pipeline failed:', error instanceof Error ? error.message : 'Unknown error');
        console.error('Error details:', error);
        process.exit(1);
    }
}

// Execute the pipeline
runCognitivePipeline().catch(error => {
    console.error('Pipeline execution failed:', error);
    process.exit(1);
}); 