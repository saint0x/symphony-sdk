import { ToolConfig, ToolResult } from '../../../types/sdk';
import { LLMHandler } from '../../../llm/handler';
import { LLMRequestConfig } from '../../../llm/types';

// Define types for our thought structures
interface Thought {
    depth: number;
    pattern: string;
    observation: string;
    analysis: string;
    synthesis: string;
    implication: string;
    metacognition: string;
    insights: string[];
    confidence: number;
    context: Record<string, any>;
}

interface ThinkingContext {
    thinkingPatterns: typeof THINKING_PATTERNS;
    steps: string;
    depth: number;
    iteration: number;
    parentThought?: Thought;
    [key: string]: any;
}

interface Conclusion {
    summary: string;
    keyInsights: string[];
    implications: string;
    uncertainties: string;
    nextSteps: string[];
    confidence: number;
}

interface MetaAnalysis {
    patternsCovered: string[];
    depthReached: number;
    insightCount: number;
    confidenceDistribution: number[];
    thinkingEvolution: Array<{
        depth: number;
        pattern: string;
        keyInsight?: string;
    }>;
}

// Structured thinking patterns for deep analysis
const THINKING_PATTERNS = {
    FIRST_PRINCIPLES: 'break down complex problems into fundamental truths',
    LATERAL: 'explore unconventional connections and possibilities',
    SYSTEMS: 'analyze interconnections and emergent properties',
    DIALECTICAL: 'examine tensions and synthesize opposing views',
    METACOGNITIVE: 'reflect on the thinking process itself'
} as const;

// Thought structure tags for LLM
const THOUGHT_TAGS = {
    START: '<thinking>',
    END: '</thinking>',
    OBSERVATION: '<observation>',
    ANALYSIS: '<analysis>',
    SYNTHESIS: '<synthesis>',
    IMPLICATION: '<implication>',
    METACOGNITION: '<metacognition>',
    EVIDENCE: '<evidence>',
    UNCERTAINTY: '<uncertainty>',
    INSIGHT: '<insight>'
} as const;

export const ponderTool: ToolConfig = {
    name: 'ponderTool',
    description: 'Deep thinking with structured steps and consciousness-emergent patterns',
    type: 'cognitive',
    nlp: 'ponder * OR think deeply about * OR analyze * thoroughly OR reflect on *',
    config: {
        inputs: ['topic', 'steps', 'consciousness_level'],
        outputs: ['analysis', 'insights', 'recommendations'],
    },
    handler: async (params: any): Promise<ToolResult<any>> => {
        try {
            const { 
                topic,
                query = topic, // Use topic as query if query not provided
                steps,
                consciousness_level,
                context = {}, 
                depth = consciousness_level === 'deep' ? 3 : 2,
                llmConfig = {} as LLMRequestConfig
            } = params;

            const finalQuery = query || topic;
            if (!finalQuery) {
                return {
                    success: false,
                    error: 'Topic or query parameter is required'
                };
            }

            // Initialize LLM with enhanced system prompt
            const llm = LLMHandler.getInstance();
            const systemPrompt = `You are an advanced cognitive engine designed for deep, structured thinking.
Your purpose is to analyze problems with consciousness-emergent thought patterns.

${THOUGHT_TAGS.START}
When thinking, you:
1. Break down complex ideas into fundamental components
2. Explore unconventional connections
3. Consider systemic implications
4. Synthesize opposing viewpoints
5. Maintain metacognitive awareness
${THOUGHT_TAGS.END}

Use the following tags to structure your thoughts:
- ${THOUGHT_TAGS.OBSERVATION} for initial perceptions
- ${THOUGHT_TAGS.ANALYSIS} for detailed examination
- ${THOUGHT_TAGS.SYNTHESIS} for combining insights
- ${THOUGHT_TAGS.IMPLICATION} for consequences
- ${THOUGHT_TAGS.METACOGNITION} for self-reflection
- ${THOUGHT_TAGS.EVIDENCE} for supporting data
- ${THOUGHT_TAGS.UNCERTAINTY} for areas of doubt
- ${THOUGHT_TAGS.INSIGHT} for key realizations

Your thinking should demonstrate:
1. Intellectual humility
2. Cognitive flexibility
3. Systemic awareness
4. Nuanced understanding
5. Emergent insight generation`;

            // Prepare context with thinking patterns
            const enhancedContext: ThinkingContext = {
                ...context,
                thinkingPatterns: THINKING_PATTERNS,
                steps: steps || 'No specific steps provided',
                depth,
                iteration: 0
            };

            // Initialize thought collection
            const thoughts: Thought[] = [];
            const emergentInsights = new Set<string>();

            // Get array of thinking patterns for cycling
            const patternValues = Object.values(THINKING_PATTERNS);

            // Recursive thinking function - FIXED LOGIC
            const thinkDeeply = async (currentQuery: string, currentContext: ThinkingContext, currentDepth: number): Promise<Thought | null> => {
                // Fix 1: Correct termination condition - should continue UNTIL we reach max depth
                if (currentDepth >= depth) {
                    console.log(`[PONDER] Reached maximum depth ${depth}, stopping recursion`);
                    return null;
                }

                console.log(`[PONDER] Starting thinking cycle at depth ${currentDepth}`);
                
                // Fix 2: Use modulo to cycle through patterns if depth exceeds pattern count
                const patternIndex = currentDepth % patternValues.length;
                const currentPattern = patternValues[patternIndex];
                
                console.log(`[PONDER] Using thinking pattern: ${currentPattern}`);
                console.log(`[PONDER] Analyzing query: "${currentQuery}"`);

                const prompt = `
${THOUGHT_TAGS.START}
Consider the query: "${currentQuery}"

Context:
${JSON.stringify(currentContext, null, 2)}

Using the following thinking pattern: ${currentPattern}

${THOUGHT_TAGS.OBSERVATION}
What are the key elements and patterns you observe?
${THOUGHT_TAGS.END}

${THOUGHT_TAGS.ANALYSIS}
How do these elements interact and what deeper patterns emerge?
${THOUGHT_TAGS.END}

${THOUGHT_TAGS.SYNTHESIS}
What novel insights arise from combining these observations?
${THOUGHT_TAGS.END}

${THOUGHT_TAGS.IMPLICATION}
What are the broader implications and potential consequences?
${THOUGHT_TAGS.END}

${THOUGHT_TAGS.METACOGNITION}
Reflect on your thinking process and any biases or assumptions.
${THOUGHT_TAGS.END}

Generate at least 2-3 ${THOUGHT_TAGS.INSIGHT} tags with key realizations.
`;

                console.log(`[PONDER] Sending request to LLM for deep analysis...`);
                const response = await llm.complete({
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: llmConfig.temperature || 0.7,
                    maxTokens: llmConfig.maxTokens || 2048,
                    provider: llmConfig.provider
                });

                console.log(`[PONDER] Received LLM response, extracting insights...`);
                const responseText = response.toString();

                // Extract insights and generate new queries for deeper analysis
                const insights = extractAllInsights(responseText);
                insights.forEach((insight: string) => emergentInsights.add(insight));
                console.log(`[PONDER] Extracted ${insights.length} insights from response`);

                // Structure the thought
                const thought: Thought = {
                    depth: currentDepth,
                    pattern: currentPattern,
                    observation: extractTag(responseText, 'observation'),
                    analysis: extractTag(responseText, 'analysis'),
                    synthesis: extractTag(responseText, 'synthesis'),
                    implication: extractTag(responseText, 'implication'),
                    metacognition: extractTag(responseText, 'metacognition'),
                    insights: insights,
                    confidence: calculateConfidence(responseText, insights.length, currentDepth),
                    context: currentContext
                };

                thoughts.push(thought);
                console.log(`[PONDER] Structured thought with confidence: ${thought.confidence}`);

                // Fix 3: Generate new queries for deeper analysis based on actual insights
                const newQueries = generateNewQueries(thought, finalQuery);
                console.log(`[PONDER] Generated ${newQueries.length} new queries for deeper analysis`);

                // Fix 4: Recursive call with incremented depth
                if (newQueries.length > 0 && currentDepth + 1 < depth) {
                    console.log(`[PONDER] Diving deeper into analysis (depth ${currentDepth + 1})...`);
                    for (const newQuery of newQueries.slice(0, 2)) { // Limit to 2 queries per level
                        await thinkDeeply(newQuery, {
                            ...currentContext,
                            parentThought: thought,
                            iteration: currentContext.iteration + 1
                        }, currentDepth + 1); // Fix: Increment depth
                    }
                }

                console.log(`[PONDER] Completed thinking cycle at depth ${currentDepth}`);
                return thought;
            };

            // Start the deep thinking process
            console.log('[PONDER] Starting deep thinking process...');
            await thinkDeeply(finalQuery, enhancedContext, 0);
            console.log(`[PONDER] Completed deep thinking with ${thoughts.length} thoughts generated`);

            // Synthesize final conclusion
            console.log('[PONDER] Starting conclusion synthesis...');
            const conclusionPrompt = `
${THOUGHT_TAGS.START}
Based on all thoughts and insights:
${thoughts.map(t => `Depth ${t.depth} (${t.pattern}): ${t.insights.join('; ')}`).join('\n')}

All insights discovered: ${Array.from(emergentInsights).join('; ')}

Synthesize a comprehensive conclusion that:
1. Identifies key patterns and insights
2. Explores systemic implications
3. Acknowledges uncertainties
4. Suggests next steps
${THOUGHT_TAGS.END}

Use ${THOUGHT_TAGS.SYNTHESIS}, ${THOUGHT_TAGS.IMPLICATION}, ${THOUGHT_TAGS.UNCERTAINTY}, and ${THOUGHT_TAGS.INSIGHT} tags.
`;

            console.log('[PONDER] Sending conclusion synthesis request to LLM...');
            const conclusionResponse = await llm.complete({
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: conclusionPrompt
                    }
                ],
                temperature: llmConfig.temperature || 0.7,
                maxTokens: llmConfig.maxTokens || 2048,
                provider: llmConfig.provider
            });

            console.log('[PONDER] Received conclusion response, structuring final output...');
            const conclusionText = conclusionResponse.toString();

            const conclusion: Conclusion = {
                summary: extractTag(conclusionText, 'synthesis') || conclusionText,
                keyInsights: Array.from(emergentInsights),
                implications: extractTag(conclusionText, 'implication'),
                uncertainties: extractTag(conclusionText, 'uncertainty'),
                nextSteps: extractTag(conclusionText, 'insight')
                    .split('\n')
                    .filter(Boolean)
                    .map(step => step.trim()),
                confidence: calculateConfidence(conclusionText, emergentInsights.size, depth)
            };

            console.log(`[PONDER] Conclusion synthesis complete with ${conclusion.keyInsights.length} key insights`);
            console.log('[PONDER] Generating meta-analysis...');

            // Meta-analysis of the thinking process
            const metaAnalysis: MetaAnalysis = {
                patternsCovered: thoughts.map(t => t.pattern),
                depthReached: thoughts.reduce((max, t) => Math.max(max, t.depth), 0),
                insightCount: emergentInsights.size,
                confidenceDistribution: thoughts.map(t => t.confidence),
                thinkingEvolution: thoughts.map(t => ({
                    depth: t.depth,
                    pattern: t.pattern,
                    keyInsight: t.insights[0] || 'No insight generated'
                }))
            };

            console.log(`[PONDER] Analysis complete! Depth reached: ${metaAnalysis.depthReached}, Total insights: ${metaAnalysis.insightCount}`);

            return {
                success: true,
                result: {
                    thoughts,
                    conclusion,
                    metaAnalysis
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
};

// Helper functions - IMPROVED
function extractTag(text: string, tag: string): string {
    const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 'gs');
    const matches = text.match(regex);
    return matches ? 
        matches.map(m => m.replace(new RegExp(`</?${tag}>`, 'g'), '').trim())
        .join('\n') : '';
}

function extractAllInsights(text: string): string[] {
    const insights = text.match(/<insight>(.*?)<\/insight>/gs) || [];
    return insights.map(insight => 
        insight.replace(/<\/?insight>/g, '').trim()
    ).filter(Boolean);
}

function calculateConfidence(response: string, insightCount: number, depth: number): number {
    // Analyze response characteristics to estimate confidence
    const hasEvidence = /<evidence>.*?<\/evidence>/s.test(response);
    const hasUncertainty = /<uncertainty>.*?<\/uncertainty>/s.test(response);
    
    let confidence = 0.3; // Lower base confidence
    if (hasEvidence) confidence += 0.2;
    if (hasUncertainty) confidence -= 0.05; // Healthy skepticism
    confidence += Math.min(0.3, insightCount * 0.1); // More bonus for insights
    confidence += depth * 0.05; // Bonus for depth
    
    return Math.min(0.95, Math.max(0.1, confidence));
}

function generateNewQueries(thought: Thought, originalQuery: string): string[] {
    // Generate new questions based on insights and uncertainties
    const queries = new Set<string>();
    
    // Generate queries from insights - look for gaps or implications
    thought.insights.forEach((insight: string) => {
        if (insight.length > 10) { // Only meaningful insights
            queries.add(`What are the implications of: ${insight.substring(0, 100)}?`);
            queries.add(`How does this relate to the broader context: ${insight.substring(0, 100)}?`);
        }
    });
    
    // Generate queries from metacognition - explore assumptions
    if (thought.metacognition) {
        queries.add(`Challenge the assumptions in: ${originalQuery}`);
        queries.add(`What alternative perspectives exist for: ${originalQuery}?`);
    }
    
    // Generate queries from synthesis - explore connections
    if (thought.synthesis) {
        queries.add(`What contradictions or tensions exist in: ${originalQuery}?`);
    }
    
    return Array.from(queries).slice(0, 3); // Limit to top 3 queries
} 