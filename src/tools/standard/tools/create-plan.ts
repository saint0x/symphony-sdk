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
4.  **Complete Parameters:** Include ALL required parameters for each tool. For writeCode, include 'language' and 'filePath' when saving code to files.
5.  **File Operations:** When the objective mentions saving files to specific paths, ensure the filePath parameter is included.
6.  **Strict Schema:** Each JSON object in the array must have these exact keys:
    - "step": A number representing the order of execution.
    - "useTool": A boolean (true/false) indicating if a tool is being called.
    - "tool": If useTool is true, the exact name of the tool. If useTool is false, this MUST be "none".
    - "description": A concise description of what this step achieves.
    - "parameters": If useTool is true, a JSON object of the parameters for the tool. If useTool is false, this can be an empty object.

**Tool Parameter Guidelines:**
- webSearch: Use "query" parameter
- writeFile: Use "filePath" and "content" parameters  
- readFile: Use "filePath" parameter
- parseDocument: Use "content" parameter
- writeCode: Use "spec" parameter, and include "language" and "filePath" when saving code
- ponder: Use "query" parameter

**Example:**
[
  {
    "step": 1,
    "useTool": true,
    "tool": "webSearch",
    "description": "Search for information about the Builder Pattern in Rust.",
    "parameters": {
      "query": "Builder Pattern Rust programming language explanation examples"
    }
  },
  {
    "step": 2,
    "useTool": true,
    "tool": "writeFile",
    "description": "Save search results to a research file.",
    "parameters": {
      "filePath": "/path/to/research-notes.md",
      "content": "Research findings: {{step_1_output}}"
    }
  },
  {
    "step": 3,
    "useTool": true,
    "tool": "readFile",
    "description": "Read the research file contents.",
    "parameters": {
      "filePath": "/path/to/research-notes.md"
    }
  },
  {
    "step": 4,
    "useTool": true,
    "tool": "parseDocument",
    "description": "Parse the research content to extract key principles.",
    "parameters": {
      "content": "{{step_3_output.content}}"
    }
  },
  {
    "step": 5,
    "useTool": true,
    "tool": "writeCode",
    "description": "Generate Rust code implementing the Builder Pattern and save to file.",
    "parameters": {
      "spec": "Based on these principles: {{step_4_output}}, create a simple Rust implementation of the Builder Pattern for a Computer struct with cpu (String) and ram_gb (u32) fields",
      "language": "rust",
      "filePath": "/path/to/example.rs"
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