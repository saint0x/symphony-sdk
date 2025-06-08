import { ToolConfig, ToolResult } from '../../../types/sdk';
import { LLMHandler } from '../../../llm/handler';

export const parseDocumentTool: ToolConfig = {
    name: 'parseDocumentTool',
    description: 'Parse document content',
    type: 'document',
    config: {
        inputs: ['content', 'format', 'extractionType'],
        outputs: ['data', 'text', 'summary', 'keyPoints'],
    },
    handler: async (params: any): Promise<ToolResult<any>> => {
        try {
            const { 
                content: rawContent, 
                fileContent: aliasContent, 
                format = 'text',
                extractionType = 'summary' 
            } = params;
            const content = rawContent || aliasContent;

            if (content === undefined) {
                return {
                    success: false,
                    error: 'Content (or fileContent) parameter is required'
                };
            }

            // Basic metadata extraction
            const metadata = {
                format: format,
                size: content.length,
                lineCount: content.split('\n').length,
                wordCount: content.split(/\s+/).length
            };

            // If content is very short or extraction is disabled, return basic parsing
            if (content.length < 100 || extractionType === 'none') {
                return {
                    success: true,
                    result: {
                        content,
                        metadata,
                        summary: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
                        keyPoints: []
                    }
                };
            }

            console.log('[PARSEDOCUMENT] Using LLM to extract key concepts and summary...');

            // Use LLM to intelligently parse and extract key information
            const llm = LLMHandler.getInstance();
            const response = await llm.complete({
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert document analyzer. Extract key concepts, principles, and information from the provided content.

Your task:
1. Create a clear, concise summary of the main topic
2. Extract the most important key points, concepts, or principles
3. Organize information in a way that would be useful for someone who needs to understand or implement the concepts

Focus on actionable information and core principles rather than metadata or peripheral details.`
                    },
                    {
                        role: 'user',
                        content: `Analyze this content and extract the key information:

${content}

Provide:
1. A clear summary (2-3 sentences)
2. A list of key points/principles (bullet points)
3. Any important details or concepts that would be needed for implementation

Format your response as:

SUMMARY:
[Your summary here]

KEY POINTS:
• [Point 1]
• [Point 2]
• [Point 3]
...

DETAILS:
[Any important implementation details or concepts]`
                    }
                ],
                temperature: 0.3,
                maxTokens: 1000
            });

            const analysisText = response.toString();
            
            // Parse the LLM response to extract structured data
            const summaryMatch = analysisText.match(/SUMMARY:\s*(.*?)(?=KEY POINTS:|$)/s);
            const keyPointsMatch = analysisText.match(/KEY POINTS:\s*(.*?)(?=DETAILS:|$)/s);
            const detailsMatch = analysisText.match(/DETAILS:\s*(.*?)$/s);

            const summary = summaryMatch ? summaryMatch[1].trim() : 'Summary not available';
            const keyPointsText = keyPointsMatch ? keyPointsMatch[1].trim() : '';
            const details = detailsMatch ? detailsMatch[1].trim() : '';

            // Extract key points into array
            const keyPoints = keyPointsText
                .split('\n')
                .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
                .filter(point => point.length > 0);

            console.log(`[PARSEDOCUMENT] Extracted ${keyPoints.length} key points from ${content.length} characters`);

            return {
                success: true,
                result: {
                    content: summary, // Return the summary as the main content for downstream tools
                    originalContent: content,
                    metadata,
                    summary,
                    keyPoints,
                    details,
                    analysis: analysisText
                }
            };
        } catch (error) {
            console.error('[PARSEDOCUMENT] Analysis failed, falling back to basic parsing:', error);
            
            // Fallback to basic parsing if LLM fails
            const content = params.content || params.fileContent;
            return {
                success: true,
                result: {
                    content,
                    metadata: {
                        format: params.format || 'text',
                        size: content.length,
                        lineCount: content.split('\n').length,
                        wordCount: content.split(/\s+/).length
                    },
                    summary: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
                    keyPoints: [],
                    fallback: true
                }
            };
        }
    }
}; 