import { AgentConfig } from '../../types/sdk';
import { Symphony } from '../core/symphony';
import { validateConfig } from '../../utils/validation';
import { OpenAIProvider } from '../../llm/providers/openai';
import { LLMConfig } from '../../types/llm';

export class AgentService {
    constructor(private symphony: Symphony) {}

    async create(config: AgentConfig): Promise<any> {
        // Validate agent config
        const validation = validateConfig(config, {
            name: { type: 'string', required: true },
            description: { type: 'string', required: true },
            task: { type: 'string', required: true },
            tools: { type: 'object', required: true }
        });

        if (!validation.isValid) {
            throw new Error(`Invalid agent configuration: ${validation.errors.join(', ')}`);
        }

        // Start agent creation metrics
        const metricId = `agent_create_${config.name}`;
        this.symphony.metrics.start(metricId, { agentName: config.name });

        try {
            const registry = await this.symphony.getRegistry();
            const agent = await registry.createAgent({
                ...config,
                executeStream: async function* (input: { task: string } & Record<string, any>) {
                    yield { status: 'initializing', message: 'Starting task execution' };

                    const llmConfig: LLMConfig = {
                        provider: 'openai',
                        apiKey: process.env.OPENAI_API_KEY!,
                        model: process.env.DEFAULT_LLM_MODEL || 'gpt-4',
                        temperature: 0.7
                    };

                    const openai = new OpenAIProvider(llmConfig);
                    await openai.initialize();

                    const llmResponse = await openai.complete({
                        messages: [
                            {
                                role: 'system',
                                content: `You are an AI assistant for task: ${config.task}`
                            },
                            {
                                role: 'user',
                                content: input.task
                            }
                        ]
                    });

                    yield {
                        status: 'thinking',
                        message: llmResponse.content
                    };

                    for (const tool of config.tools) {
                        yield {
                            status: 'executing',
                            message: `Using tool: ${typeof tool === 'object' ? tool.name : tool}`
                        };
                    }

                    yield {
                        status: 'complete',
                        message: 'Task completed'
                    };
                }
            });
            
            this.symphony.metrics.end(metricId, { success: true });
            return agent;
        } catch (error) {
            this.symphony.metrics.end(metricId, { success: false, error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
} 