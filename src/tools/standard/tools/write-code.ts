import { ToolConfig, ToolResult } from '../../../types/sdk';
import { LLMHandler } from '../../../llm/handler';

export const writeCodeTool: ToolConfig = {
    name: 'writeCodeTool',
    description: 'Generate code using LLM',
    type: 'code',
    config: {
        inputs: ['prompt', 'spec', 'query', 'language', 'context'],
        outputs: ['code', 'explanation'],
    },
    handler: async (params: any): Promise<ToolResult<any>> => {
        try {
            // Accept 'prompt', 'spec', and 'query' for flexibility
            let spec = params.prompt || params.spec || params.query;
            const { language = 'javascript', context = {}, components } = params;

            if (components) {
                spec = `Implement the following components: ${JSON.stringify(components, null, 2)}`;
            }
            
            if (!spec) {
                return {
                    success: false,
                    error: 'Prompt, spec, or query parameter is required'
                };
            }

            console.log(`[WRITECODE] Making real LLM call to generate ${language} code...`);

            // REAL LLM CALL - Generate actual code using AI
            const llm = LLMHandler.getInstance();
            const response = await llm.complete({
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert ${language} developer. Generate clean, production-ready code with proper documentation and error handling.`
                    },
                    {
                        role: 'user',
                        content: `Generate ${language} code for: ${spec}

Context: ${JSON.stringify(context)}

Requirements:
- Write clean, readable code
- Include proper error handling
- Add comments for complex logic
- Follow ${language} best practices
- Make it production-ready

Provide working code that can be immediately used.`
                    }
                ],
                temperature: 0.3, // Lower temperature for more consistent code
                maxTokens: 1500
            });

            const generatedCode = response.toString();
            
            console.log(`[WRITECODE] Generated ${generatedCode.length} characters of ${language} code`);

            // Generate explanation
            const explanationResponse = await llm.complete({
                messages: [
                    {
                        role: 'system',
                        content: 'You are a code documentation expert. Explain code implementations clearly and concisely.'
                    },
                    {
                        role: 'user',
                        content: `Explain this ${language} code implementation:\n\n${generatedCode}\n\nProvide a brief explanation of:\n1. What the code does\n2. Key components and their roles\n3. Any important implementation details`
                    }
                ],
                temperature: 0.5,
                maxTokens: 500
            });

            const explanation = explanationResponse.toString();

            return {
                success: true,
                result: {
                    code: generatedCode,
                    explanation,
                    language,
                    context,
                    spec: spec,
                    codeLength: generatedCode.length,
                    timestamp: new Date().toISOString(),
                    model: 'LLM-generated'
                }
            };
        } catch (error) {
            console.error('[WRITECODE] LLM call failed:', error);
            return {
                success: false,
                error: `Code generation failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}; 