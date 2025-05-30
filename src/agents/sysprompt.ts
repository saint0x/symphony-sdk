import { Logger } from '../utils/logger';
import { AgentConfig } from '../types/sdk';
import * as fs from 'fs';
import * as path from 'path';

export interface SystemPromptVariables {
    name: string;
    description: string;
    task: string;
    tool_registry: string;
    llm_model: string;
    directives: string;
}

export class SystemPromptService {
    private logger: Logger;
    private systemPromptTemplate: string;

    constructor() {
        this.logger = Logger.getInstance('SystemPromptService');
        
        try {
            // Load default system prompt template
            const templatePath = path.join(__dirname, 'sysprompt.xml');
            this.systemPromptTemplate = fs.readFileSync(templatePath, 'utf-8');
            this.logger.info('SystemPromptService', 'Loaded system prompt template');
        } catch (error) {
            this.logger.warn('SystemPromptService', 'Failed to load XML template, using basic prompt');
            this.systemPromptTemplate = this.getBasicSystemPrompt();
        }
    }

    generateSystemPrompt(config: AgentConfig): string {
        try {
            // Check for custom system prompt override
            if (config.systemPrompt) {
                return this.loadCustomSystemPrompt(config.systemPrompt);
            }

            // Otherwise, use the default template with variables
            const variables: SystemPromptVariables = {
                name: config.name,
                description: config.description,
                task: config.task,
                tool_registry: this.formatToolRegistry(config.tools),
                llm_model: typeof config.llm === 'string' ? config.llm : config.llm.model,
                directives: config.directives || 'None specified'
            };

            let prompt = this.systemPromptTemplate;

            // Replace variables in the template
            Object.entries(variables).forEach(([key, value]) => {
                const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
                prompt = prompt.replace(regex, value);
            });

            return prompt;

        } catch (error) {
            this.logger.error('SystemPromptService', 'Failed to generate system prompt', { error });
            return this.getBasicSystemPrompt();
        }
    }

    private loadCustomSystemPrompt(systemPrompt: string): string {
        // Check if it's a file path
        if (systemPrompt.endsWith('.xml') || systemPrompt.endsWith('.txt') || systemPrompt.endsWith('.md')) {
            try {
                const content = fs.readFileSync(systemPrompt, 'utf-8');
                this.logger.info('SystemPromptService', `Loaded custom system prompt from file: ${systemPrompt}`);
                return content;
            } catch (error) {
                this.logger.warn('SystemPromptService', `Failed to load system prompt from file: ${systemPrompt}, treating as string`);
                // Fall through to treat as string
            }
        }

        // Otherwise, treat as direct string content
        this.logger.info('SystemPromptService', 'Using custom system prompt string');
        return systemPrompt;
    }

    private getBasicSystemPrompt(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<SystemPrompt>
    <AgentIdentity>
        <Description>You are an agent that \${description}</Description>
        <Task>You have been tasked to \${task}</Task>
        <Capabilities>
            <Tools>Available tools: \${tool_registry}</Tools>
        </Capabilities>
    </AgentIdentity>
    
    <Instructions>
        You are an intelligent AI agent designed to analyze tasks and provide helpful responses.
        
        Your role:
        1. Understand and analyze the user's request
        2. Think about how to best accomplish the task
        3. Provide a helpful, detailed response
        4. If tools would be useful, you can suggest which tools would help
        
        Remember: You are focused on analysis and planning, not automatic tool execution.
    </Instructions>
    
    <Directives>
        \${directives}
    </Directives>
</SystemPrompt>`;
    }

    private formatToolRegistry(tools: string[]): string {
        if (!tools || tools.length === 0) {
            return 'No tools available';
        }
        
        return tools.map(tool => `- ${tool}`).join('\n');
    }

    // Method to get the raw XML template for cache integration later
    getRawTemplate(): string {
        return this.systemPromptTemplate;
    }
} 