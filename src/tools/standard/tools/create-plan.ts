import { ToolConfig, ToolResult } from '../../../types/sdk';
import { LLMHandler } from '../../../llm/handler';

export const createPlanTool: ToolConfig = {
    name: 'createPlanTool',
    description: 'Create execution plan using LLM',
    type: 'planning',
    config: {
        inputs: ['goal', 'context', 'constraints'],
        outputs: ['plan', 'steps'],
    },
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
                        content: `You are a meticulous project planning assistant. Your sole purpose is to create a JSON execution plan.
Given an objective and a list of available tools, you MUST generate a JSON array of plan steps.
Each object in the array represents a single, concrete step.

**RULES:**
1.  **Tool-Centric:** Every single step MUST map directly to one of the provided tools, or be a non-tool step for reasoning or summarization.
2.  **JSON ONLY:** Your entire output must be a single, raw JSON array. Do not include any text, markdown, or explanations before or after the JSON.
3.  **Data Flow:** The 'parameters' for a step can and should reference the output of a previous step. Use a placeholder string like '{{step_1_output}}' to indicate this.
4.  **Strict Schema:** Each JSON object in the array must have these exact keys:
    - "step": A number representing the order of execution.
    - "useTool": A boolean (true/false) indicating if a tool is being called.
    - "tool": If useTool is true, the exact name of the tool. If useTool is false, this MUST be "none".
    - "description": A concise description of what this step achieves.
    - "parameters": If useTool is true, a JSON object of the parameters for the tool. If useTool is false, this can be an empty object.

**Example:**
[
  {
    "step": 1,
    "useTool": true,
    "tool": "ponder",
    "description": "Analyze the project requirements to inform the architecture.",
    "parameters": {
      "query": "Analyze the requirements for a production-grade Rust cron job, focusing on scheduler, jobs, config, and error handling."
    }
  },
  {
    "step": 2,
    "useTool": true,
    "tool": "writeFile",
    "description": "Create the project's Cargo.toml file.",
    "parameters": {
      "filePath": "./code-review.md",
      "content": "Code Review: {{step_1_output.conclusion.summary}}"
    }
  },
  {
    "step": 3,
    "useTool": true,
    "tool": "writeFile",
    "description": "Create the main application entry point.",
    "parameters": {
      "filePath": "./cron-job/src/main.rs",
      "content": "fn main() {\\n    println!(\\"Hello, from the cron job!\\");\\n}"
    }
  },
  {
    "step": 4,
    "useTool": true,
    "tool": "writeFile",
    "description": "Create the project's Cargo.toml file.",
    "parameters": {
      "filePath": "./cron-job/Cargo.toml",
      "content": "[package]\\nname = \\"cron-job\\"\\nversion = \\"0.1.0\\"\\nedition = \\"2021\\"\\n\\n[dependencies]"
    }
  }
]`
                    },
                    {
                        role: 'user',
                        content: `Create a JSON execution plan for the objective: "${objective}"

Available Tools: ${JSON.stringify(context.availableTools)}
Constraints: ${JSON.stringify(constraints)}
Context: ${JSON.stringify(context)}`
                    }
                ],
                temperature: 0.1,
                maxTokens: 2048,
                response_format: { type: 'json_object' }
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
}; 