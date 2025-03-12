import sdkInstance from './sdk';
import { IToolService } from '../../src/services/interfaces';
import { envConfig } from '../../src/utils/env';
import { performance } from 'perf_hooks';

// Add listStandardTools to IToolService interface
declare module '../../src/services/interfaces' {
    interface IToolService {
        listStandardTools(): Promise<string[]>;
    }
}

interface TimingMetric {
    name: string;
    startTime: number;
    endTime: number;
    duration: number;
}

class TimingCollector {
    private metrics: TimingMetric[] = [];
    private startTime: number;

    constructor() {
        this.startTime = performance.now();
    }

    start(name: string): number {
        console.log(`[${new Date().toISOString()}] Starting: ${name}`);
        return performance.now();
    }

    end(name: string, startTime: number) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        this.metrics.push({ name, startTime, endTime, duration });
        console.log(`[${new Date().toISOString()}] Completed: ${name} (${duration.toFixed(2)}ms)`);
    }

    summarize() {
        const totalDuration = performance.now() - this.startTime;
        console.log('\n=== Timing Summary ===');
        console.log(`Total test duration: ${totalDuration.toFixed(2)}ms\n`);
        
        this.metrics.sort((a, b) => b.duration - a.duration);
        console.log('Detailed Breakdown:');
        this.metrics.forEach(metric => {
            console.log(`${metric.name.padEnd(30)}: ${metric.duration.toFixed(2)}ms`);
        });
        
        console.log('\nOperation Timeline:');
        this.metrics.sort((a, b) => a.startTime - b.startTime);
        let lastEnd = this.startTime;
        this.metrics.forEach(metric => {
            const gap = metric.startTime - lastEnd;
            if (gap > 1) {
                console.log(`${'[gap]'.padEnd(30)}: ${gap.toFixed(2)}ms`);
            }
            console.log(`${metric.name.padEnd(30)}: ${metric.duration.toFixed(2)}ms`);
            lastEnd = metric.endTime;
        });
    }
}

async function runEnhancedTest() {
    const timing = new TimingCollector();
    console.log(`[${new Date().toISOString()}] [TEST] Starting enhanced test...`);

    // SDK Initialization
    let t = timing.start('SDK Initialization');
    console.log(`[${new Date().toISOString()}] [SDK] Waiting for SDK initialization...`);
    await sdkInstance.initialize();
    console.log(`[${new Date().toISOString()}] [SDK] SDK initialized successfully`);
    timing.end('SDK Initialization', t);

    // Tool Registration Check
    console.log(`\n[${new Date().toISOString()}] [TOOLS] Checking available tools...`);
    t = timing.start('Tool Registration Check');
    const tools = await sdkInstance.tool.listStandardTools();
    console.log(`[${new Date().toISOString()}] [TOOLS] Available standard tools:`, tools);
    timing.end('Tool Registration Check', t);

    // Web Search Test
    console.log(`\n[${new Date().toISOString()}] [WEBSEARCH] Performing web search...`);
    t = timing.start('Web Search Test');
    console.log(`[${new Date().toISOString()}] [WEBSEARCH] Creating webSearchTool...`);
    const webSearchTool = await sdkInstance.tool.getTool('webSearchTool');
    console.log(`[${new Date().toISOString()}] [WEBSEARCH] Tool created: webSearchTool`);
    
    console.log(`[${new Date().toISOString()}] [WEBSEARCH] Executing search...`);
    const searchStart = timing.start('Web Search API Call');
    console.log(`[${new Date().toISOString()}] [WEBSEARCH] Making API request with Serper API key`);
    const searchResult = await webSearchTool.run({ 
        query: "latest innovations in AI technology 2024",
        type: "search"
    });
    timing.end('Web Search API Call', searchStart);
    
    console.log(`[${new Date().toISOString()}] [WEBSEARCH] Search successful`);
    console.log(`[${new Date().toISOString()}] [WEBSEARCH] Raw result structure:`, 
        JSON.stringify(searchResult, null, 2)
    );
    
    // Log top results
    console.log(`\n[${new Date().toISOString()}] [WEBSEARCH] Top search results:`);
    const searchResults = searchResult.result?.organic || [];
    searchResults.slice(0, 3).forEach((result: any, index: number) => {
        console.log(`\n[${new Date().toISOString()}] [WEBSEARCH] Result ${index + 1}:`);
        console.log(`[${new Date().toISOString()}] Title: ${result.title}`);
        console.log(`[${new Date().toISOString()}] Link: ${result.link}`);
        console.log(`[${new Date().toISOString()}] Snippet: ${result.snippet}`);
    });
    timing.end('Web Search Test', t);

    // Ponder Tool Test
    console.log(`\n[${new Date().toISOString()}] [PONDER] Testing ponder tool with LLM integration...`);
    t = timing.start('Ponder Tool Test');
    console.log('[PONDER] Starting ponder tool test with timeout...');

    try {
        console.log('[PONDER] Creating ponder tool...');
        const ponderTool = await sdkInstance.tool.getTool('ponderTool');
        
        console.log('[PONDER] Setting up test parameters...');
        const testQuery = "What are the key implications of recent AI developments for business and society?";
        const searchResults = searchResult.result.organic.slice(0, 3);
        
        console.log('[PONDER] Preparing context...');
        const context = {
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
        };

        console.log('[PONDER] Executing ponder analysis with timeout...');
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Ponder tool timeout after 60 seconds')), 60000);
        });

        const ponderPromise = ponderTool.run({
            query: testQuery,
            context: context
        }).then(result => {
            console.log('[PONDER] Received response from OpenAI');
            return result;
        }).catch(error => {
            console.error('[PONDER] OpenAI API Error:', error.response?.data || error.message);
            throw error;
        });

        console.log('[PONDER] Waiting for analysis completion or timeout...');
        const ponderResult = await Promise.race([ponderPromise, timeoutPromise])
            .catch(error => {
                if (error.response?.data) {
                    console.error('[PONDER] OpenAI API Error Details:', JSON.stringify(error.response.data, null, 2));
                }
                console.error('[PONDER] Error during analysis:', error.message);
                throw error;
            });

        console.log('[PONDER] Analysis completed successfully');
        console.log('[PONDER] Result structure:', JSON.stringify(ponderResult, null, 2));

    } catch (error: unknown) {
        console.error('[PONDER] Test failed:', error instanceof Error ? error.message : 'Unknown error');
        console.error('[PONDER] Error details:', error);
    } finally {
        console.log('[PONDER] Test section completed');
    }
    timing.end('Ponder Tool Test', t);

    console.log(`\n[${new Date().toISOString()}] [TEST] Enhanced test completed successfully`);
    
    // Output timing summary
    timing.summarize();
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

runEnhancedTest().catch(error => {
    console.error(`[${new Date().toISOString()}] [ERROR] Test failed:`, error);
    process.exit(1);
}); 