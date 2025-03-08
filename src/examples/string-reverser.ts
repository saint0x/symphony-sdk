import { ToolConfig, AgentConfig, ToolResult } from '../types/sdk';
import { BaseAgent } from '../agents/base';

// Define our string reverser tool
const reverserTool: ToolConfig = {
    name: 'reverser',
    description: 'A tool that reverses input strings',
    inputs: ['text'],
    outputs: ['reversed'],
    handler: async (params: { text: string }): Promise<ToolResult<{ reversed: string }>> => {
        try {
            if (typeof params.text !== 'string') {
                throw new Error('Input must be a string');
            }

            const reversed = params.text.split('').reverse().join('');
            return {
                success: true,
                result: { reversed },
                error: undefined
            };
        } catch (error) {
            return {
                success: false,
                result: undefined,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }
};

// Create a simple agent that uses the reverser
class ReverserAgent extends BaseAgent {
    constructor() {
        const config: AgentConfig = {
            name: 'reverser_agent',
            description: 'An agent that reverses strings',
            task: 'Perform string reversals',
            tools: [reverserTool],
            capabilities: ['string-manipulation', 'text-processing'],
            handler: async () => ({
                success: true,
                result: {},
                error: undefined
            }),
            llm: {
                provider: 'openai',
                model: 'gpt-4',
                apiKey: process.env.OPENAI_API_KEY || ''
            }
        };
        super(config);
    }

    async reverse(text: string): Promise<string> {
        const result = await this.executeTool('reverser', { text });
        if (!result?.reversed) {
            throw new Error('Failed to reverse string');
        }
        return result.reversed;
    }
}

export { ReverserAgent, reverserTool }; 