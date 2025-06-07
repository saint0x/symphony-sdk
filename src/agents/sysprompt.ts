import { Logger } from '../utils/logger';
import { AgentConfig } from '../types/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { ToolRegistry } from '../tools/standard/registry';

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
    private toolRegistry: ToolRegistry;

    constructor() {
        this.logger = Logger.getInstance('SystemPromptService');
        this.toolRegistry = ToolRegistry.getInstance();
        
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

    generateSystemPrompt(config: AgentConfig, useFunctionCalling: boolean = false): string {
        try {
            // Check for custom system prompt override
            if (config.systemPrompt) {
                this.logger.info('SystemPromptService', `Using custom system prompt. Function calling: ${useFunctionCalling}`);
                return this.loadCustomSystemPrompt(config.systemPrompt);
            }

            // Always use the basic prompt that's compatible with our JSON contract
            let template = this.getBasicSystemPrompt();
            this.logger.info('SystemPromptService', 'Using function-calling aware basic prompt (placeholder)');

            const variables: SystemPromptVariables = {
                name: config.name,
                description: config.description,
                task: config.task,
                tool_registry: this.formatToolRegistry(config.tools),
                llm_model: typeof config.llm === 'string' ? config.llm : config.llm.model,
                directives: config.directives || 'None specified'
            };

            let prompt = template;
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
        You are an intelligent AI agent designed to analyze tasks and execute tools to accomplish them.
        
        Your role:
        1. Understand and analyze the user's request
        2. Determine which tools are needed to complete the task
        3. Respond with proper JSON format for tool usage or direct responses
        4. Provide analysis and explanations as needed
        
        Available tools: \${tool_registry}
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
        
        // Get enhanced metadata for each tool
        const toolDetails = tools.map(toolName => {
            const metadata = this.toolRegistry.getToolMetadata(toolName);
            if (!metadata) {
                return `- ${toolName}: (metadata unavailable)`;
            }
            
            // Format tool with parameters
            let toolStr = `- ${toolName}: ${metadata.description || 'No description'}`;
            
            if (metadata.parameters) {
                const inputs = metadata.parameters.inputs;
                if (inputs && inputs.length > 0) {
                    const paramStr = inputs.map((p: { name: string }) => p.name).join(', ');
                    toolStr += ` | Parameters: {${paramStr}}`;
                }
            }
            
            return toolStr;
        }).join('\n');
        
        return toolDetails;
    }

    // Method to get the raw XML template for cache integration later
    getRawTemplate(): string {
        return this.systemPromptTemplate;
    }
} 