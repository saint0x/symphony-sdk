import { symphony } from 'symphonic';
import type { AgentConfig, AgentResult } from 'symphonic';
import transformerTool from '../tools/transformer';
import { envConfig } from 'symphonic/utils/env';

class TransformerAgent {
    private agent: Promise<any>;

    constructor() {
        const config: AgentConfig = {
            name: 'Transformer Agent',
            description: 'An agent that performs type-safe data transformations',
            task: 'process data transformations',
            tools: [transformerTool],
            llm: {
                provider: 'openai',
                model: 'gpt-4',
                temperature: 0.7,
                maxTokens: 2000,
                apiKey: envConfig.openaiApiKey
            },
            capabilities: ['data.transformation']
        };

        this.agent = symphony.agent.create(config);
    }

    async run(task: string): Promise<AgentResult> {
        const startTime = Date.now();
        try {
            // Parse the task to extract data and transformation type
            const taskLower = task.toLowerCase();
            
            // Extract the data to transform
            let data: string | number | boolean | object;
            if (task.includes('"')) {
                // Extract quoted string, but check for JSON first
                const jsonMatch = task.match(/({[^}]+})/);
                if (jsonMatch) {
                    try {
                        data = JSON.parse(jsonMatch[1]);
                    } catch {
                        // If JSON parsing fails, treat as regular quoted string
                        data = task.match(/"([^"]+)"/)?.[1] || '';
                    }
                } else {
                    data = task.match(/"([^"]+)"/)?.[1] || '';
                }
            } else if (task.includes('{')) {
                // Extract JSON object
                const jsonStr = task.slice(task.indexOf('{'), task.lastIndexOf('}') + 1);
                try {
                    data = JSON.parse(jsonStr);
                } catch {
                    data = jsonStr;
                }
            } else if (task.includes('true') || task.includes('false')) {
                // Extract boolean
                data = task.includes('true');
            } else {
                // Default to string
                data = task.replace(/transform |to |into |using |with /g, '').trim();
            }
            
            // Determine transformation type
            const transformType = taskLower.includes('uppercase') ? 'uppercase'
                : taskLower.includes('reverse') ? 'reverse'
                : taskLower.includes('json') ? 'jsonify'
                : taskLower.includes('base64') ? 'base64'
                : null;

            if (!transformType) {
                throw new Error('Unknown transformation type');
            }

            const result = await transformerTool.handler({
                data,
                transformType
            });

            return {
                success: true,
                result: result.result,
                metadata: result.metadata,
                metrics: {
                    duration: Date.now() - startTime,
                    startTime,
                    endTime: Date.now(),
                    toolCalls: 1,
                    ...result.metrics
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                result: null,
                metrics: {
                    duration: Date.now() - startTime,
                    startTime,
                    endTime: Date.now(),
                    toolCalls: 0
                }
            };
        }
    }
}

export default TransformerAgent; 