import { ToolConfig, ToolResult } from '../../../types/sdk';
import { LLMHandler } from '../../../llm/handler';

export const createPlanTool: ToolConfig = {
    name: 'createPlan',
    description: 'Create execution plan using LLM',
    type: 'planning',
    config: {
        inputs: ['objective', 'query', 'constraints', 'context'],
        outputs: ['plan'],
        handler: async (params: any): Promise<ToolResult<any>> => {
            try {
                // Accept both 'objective' and 'query' for flexibility
                const objective = params.objective || params.query;
                const { constraints = {}, context = {} } = params;
                
                if (!objective) {
                    return {
                        success: false,
                        error: 'Objective or query parameter is required'
                    };
                }

                console.log('[CREATEPLAN] Making real LLM call to generate plan...');
                
                // REAL LLM CALL - Generate actual plan using AI
                const llm = LLMHandler.getInstance();
                const response = await llm.complete({
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert project planning assistant. Create detailed, actionable execution plans.'
                        },
                        {
                            role: 'user',
                            content: `Create a detailed execution plan for: ${objective}

Constraints: ${JSON.stringify(constraints)}
Context: ${JSON.stringify(context)}

Provide a structured plan with:
1. Clear phases/steps
2. Estimated timelines  
3. Resource requirements
4. Dependencies
5. Risk considerations

Format as a concise but complete execution roadmap.`
                        }
                    ],
                    temperature: 0.7,
                    maxTokens: 1024
                });

                const planContent = response.toString();
                
                console.log(`[CREATEPLAN] Generated ${planContent.length} character plan`);

                // Structure the response
                const plan = {
                    objective,
                    constraints,
                    context,
                    generatedPlan: planContent,
                    timestamp: new Date().toISOString(),
                    model: 'LLM-generated',
                    planLength: planContent.length
                };

                return {
                    success: true,
                    result: { plan }
                };
            } catch (error) {
                console.error('[CREATEPLAN] LLM call failed:', error);
                return {
                    success: false,
                    error: `Plan generation failed: ${error instanceof Error ? error.message : String(error)}`
                };
            }
        }
    }
}; 