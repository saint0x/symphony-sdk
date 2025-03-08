import { symphony } from 'symphonic';
import { tripleAddTool } from '../tools';
import { AgentConfig } from 'symphonic/types';

class CalculatorAgent {
    private agent: any;
    private initialized: boolean = false;

    constructor() {
        const config: AgentConfig = {
            name: 'calculator',
            description: 'Performs arithmetic calculations',
            task: 'Add three numbers together',
            tools: [tripleAddTool],
            llm: {
                provider: 'openai',
                model: 'gpt-4',
                temperature: 0.7,
                maxTokens: 2000
            }
        };

        this.initialize(config);
    }

    private async initialize(config: AgentConfig): Promise<void> {
        try {
            // Ensure symphony is initialized
            if (!symphony.isInitialized()) {
                await symphony.initialize();
            }

            // Create agent with validated config
            this.agent = await symphony.agent.createAgent(config);
            this.initialized = true;

            // Start initialization metric
            symphony.startMetric('calculator_agent_init', {
                agentName: config.name,
                toolCount: config.tools.length
            });
        } catch (error) {
            symphony.startMetric('calculator_agent_init', {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private assertInitialized(): void {
        if (!this.initialized) {
            throw new Error('Calculator agent is not initialized');
        }
    }

    async run(task: string, options: Record<string, any> = {}): Promise<any> {
        this.assertInitialized();

        const metricId = `calculator_agent_run_${Date.now()}`;
        symphony.startMetric(metricId, { task, options });

        try {
            // Run the agent
            const result = await this.agent.run(task, options);

            // End metric with success
            symphony.endMetric(metricId, {
                success: true,
                result: result.result
            });

            return result;
        } catch (error) {
            // End metric with error
            symphony.endMetric(metricId, {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });

            throw error;
        }
    }
}

export const calculatorAgent = new CalculatorAgent(); 