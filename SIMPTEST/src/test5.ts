import sdkInstance from './sdk';
import { performance } from 'perf_hooks';

// Add timestamp to all logs
const originalConsoleLog = console.log;
console.log = (...args) => {
    originalConsoleLog(`[${new Date().toISOString()}]`, ...args);
};

async function runCognitivePipeline() {
    console.log('STARTING COGNITIVE ANALYSIS PIPELINE...');
    
    // Initialize SDK
    console.log('INITIALIZING SDK...');
    await sdkInstance.initialize();
    console.log('SDK INITIALIZED SUCCESSFULLY');

    try {
        // Create web search tool
        console.log('SETTING UP WEB SEARCH TOOL...');
        const webSearchTool = await sdkInstance.tool.getTool('webSearchTool');
        
        // Execute search
        console.log('EXECUTING WEB SEARCH FOR QUANTUM BIOLOGY AND CONSCIOUSNESS...');
        const searchResult = await webSearchTool.run({ 
            query: "quantum effects in biological systems consciousness art latest research 2024",
            type: "search"
        });

        const searchResults = searchResult.result?.organic || [];
        console.log('\nTOP SEARCH RESULTS:');
        searchResults.slice(0, 3).forEach((result: any, index: number) => {
            console.log(`\nResult ${index + 1}:`);
            console.log(`Title: ${result.title}`);
            console.log(`Link: ${result.link}`);
            console.log(`Snippet: ${result.snippet}`);
        });

        // Create ponder tool
        console.log('\nINITIALIZING PONDER TOOL FOR DEEP ANALYSIS...');
        const ponderTool = await sdkInstance.tool.getTool('ponderTool');
        
        // Prepare rich context for analysis
        const context = {
            searchResults: searchResults.slice(0, 3).map((r: any) => ({
                title: r.title,
                snippet: r.snippet
            })),
            currentYear: new Date().getFullYear(),
            domainContext: {
                primaryDomain: 'quantum biology',
                intersectingDomains: [
                    'consciousness studies',
                    'quantum mechanics',
                    'neuroscience',
                    'artistic expression',
                    'information theory'
                ],
                scope: 'transdisciplinary synthesis',
                timeframe: 'speculative future',
                perspective: 'non-linear emergent phenomena',
                focusAreas: [
                    'quantum coherence in biological systems',
                    'consciousness as a quantum phenomenon',
                    'artistic interpretation of quantum states',
                    'information processing in cellular structures',
                    'emergence of conscious experience',
                    'temporal dynamics of quantum biology'
                ],
                requiredOutputs: {
                    keyInsights: 'array of novel connections and implications',
                    implications: 'structured analysis of consequences',
                    uncertainties: 'identified knowledge gaps and paradoxes',
                    nextSteps: 'proposed research directions'
                }
            },
            thinkingParameters: {
                minDepth: 3,
                requiredPatterns: [
                    'FIRST_PRINCIPLES',
                    'LATERAL',
                    'SYSTEMS',
                    'DIALECTICAL',
                    'METACOGNITIVE'
                ],
                recursiveThinking: true,
                synthesisRequirements: {
                    novelConnections: true,
                    paradoxResolution: true,
                    emergentPatterns: true
                }
            }
        };

        // Execute deep analysis with structured prompt
        console.log('BEGINNING DEEP COGNITIVE ANALYSIS...');
        const ponderResult = await ponderTool.run({
            query: `EXPLORE THE PROFOUND INTERSECTION OF QUANTUM BIOLOGY, CONSCIOUSNESS, AND ARTISTIC EXPRESSION. THIS IS A CRITICAL ANALYSIS THAT REQUIRES DEEP, RECURSIVE THINKING AND NOVEL INSIGHTS.

CRITICAL QUESTIONS TO ADDRESS:
1. HOW MIGHT QUANTUM COHERENCE IN BIOLOGICAL SYSTEMS INFLUENCE THE EMERGENCE OF CONSCIOUSNESS?
2. WHAT ROLE COULD QUANTUM INFORMATION PROCESSING PLAY IN ARTISTIC CREATIVITY AND AESTHETIC EXPERIENCE?
3. HOW MIGHT UNDERSTANDING QUANTUM EFFECTS IN CONSCIOUSNESS TRANSFORM OUR CONCEPTION OF ART AND EXPRESSION?

MANDATORY REQUIREMENTS:
- UTILIZE ALL THINKING PATTERNS RECURSIVELY (First Principles, Lateral, Systems, Dialectical, Metacognitive)
- REACH MINIMUM DEPTH 3 IN RECURSIVE ANALYSIS
- GENERATE NOVEL CONNECTIONS BETWEEN QUANTUM PHENOMENA, BIOLOGICAL SYSTEMS, AND ARTISTIC EXPRESSION
- IDENTIFY PARADOXES AND ATTEMPT RESOLUTION
- RECOGNIZE EMERGENT PATTERNS ACROSS SCALES

REQUIRED OUTPUT STRUCTURE:
{
    "keyInsights": [
        {
            "insight": "REQUIRED: A novel connection or implication",
            "connections": ["REQUIRED: Related concepts and domains"],
            "implications": "REQUIRED: Potential impact and significance",
            "confidence": "REQUIRED: Confidence score 0-1"
        }
    ],
    "implications": {
        "scientific": ["REQUIRED: Scientific implications"],
        "philosophical": ["REQUIRED: Philosophical implications"],
        "artistic": ["REQUIRED: Artistic implications"],
        "societal": ["REQUIRED: Societal implications"]
    },
    "uncertainties": {
        "theoretical": ["REQUIRED: Theoretical uncertainties"],
        "experimental": ["REQUIRED: Experimental uncertainties"],
        "philosophical": ["REQUIRED: Philosophical uncertainties"]
    },
    "nextSteps": [
        {
            "direction": "REQUIRED: Research direction",
            "methodology": "REQUIRED: Proposed approach",
            "expectedOutcome": "REQUIRED: Potential discovery",
            "impact": "REQUIRED: Potential significance"
        }
    ],
    "reflection": "REQUIRED: A comprehensive paragraph reflecting on the analysis, its implications, and potential future directions. This should be thought-provoking and avant-garde in its conclusions."
}`,
            context: context
        });

        // Output analysis results
        console.log('\n=== COGNITIVE ANALYSIS RESULTS ===');
        console.log('\nThinking Evolution:');
        console.log(JSON.stringify(ponderResult.result?.thinkingEvolution, null, 2));
        
        console.log('\nKey Insights:');
        console.log(JSON.stringify(ponderResult.result?.thoughts, null, 2));
        
        console.log('\nMeta Analysis:');
        console.log(JSON.stringify(ponderResult.result?.metaAnalysis, null, 2));
        
        console.log('\nStructured Outputs:');
        console.log(JSON.stringify({
            keyInsights: ponderResult.result?.keyInsights || [],
            implications: ponderResult.result?.implications || {},
            uncertainties: ponderResult.result?.uncertainties || {},
            nextSteps: ponderResult.result?.nextSteps || [],
            reflection: ponderResult.result?.reflection || "No reflection provided."
        }, null, 2));

        console.log('\nANALYSIS COMPLETE. EXITING...');
        process.exit(0);

    } catch (error) {
        console.error('PIPELINE FAILED:', error instanceof Error ? error.message : 'Unknown error');
        console.error('Error details:', error);
        process.exit(1);
    }
}

// Execute the pipeline
runCognitivePipeline().catch(error => {
    console.error('PIPELINE EXECUTION FAILED:', error);
    process.exit(1);
}); 