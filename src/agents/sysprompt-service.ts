import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AgentConfig } from '../types/sdk';
import { Logger } from '../utils/logger';

export interface SystemPromptVariables {
    description: string;
    task: string;
    tool_registry: string;
    FAST_PATH_THRESHOLD: number;
}

export class SystemPromptService {
    private static instance: SystemPromptService;
    private logger: Logger;
    private systemPromptTemplate: string = '';

    private constructor() {
        this.logger = Logger.getInstance('SystemPromptService');
        this.loadSystemPromptTemplate();
    }

    static getInstance(): SystemPromptService {
        if (!SystemPromptService.instance) {
            SystemPromptService.instance = new SystemPromptService();
        }
        return SystemPromptService.instance;
    }

    private loadSystemPromptTemplate(): void {
        try {
            const promptPath = resolve(__dirname, 'sysprompt.xml');
            this.systemPromptTemplate = readFileSync(promptPath, 'utf-8');
            this.logger.info('SystemPromptService', 'Loaded XML system prompt template', {
                templateLength: this.systemPromptTemplate.length
            });
        } catch (error) {
            this.logger.error('SystemPromptService', 'Failed to load system prompt template', { error });
            // Fallback to basic system prompt
            this.systemPromptTemplate = this.getBasicSystemPrompt();
        }
    }

    private getBasicSystemPrompt(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<SystemPrompt>
    <AgentIdentity>
        <Description>You are an agent that \${description}</Description>
        <Task>You have been tasked to \${task}</Task>
        <Capabilities>
            <Tools>REGISTERED_TOOLS: \${tool_registry}</Tools>
        </Capabilities>
    </AgentIdentity>
    
    <Instructions>
        You are an intelligent AI agent that can use tools to accomplish tasks.
        
        Available tools: \${tool_registry}
        
        When given a task:
        1. Analyze the task requirements
        2. Select the most appropriate tool(s)
        3. Execute the tools with proper parameters
        4. Return a helpful response
        
        Always be helpful, accurate, and efficient in your responses.
    </Instructions>
</SystemPrompt>`;
    }

    generateSystemPrompt(config: AgentConfig): string {
        try {
            const variables: SystemPromptVariables = {
                description: config.description,
                task: config.task,
                tool_registry: this.formatToolRegistry(config.tools),
                FAST_PATH_THRESHOLD: config.thresholds?.fastPath || 0.7
            };

            let systemPrompt = this.systemPromptTemplate;
            
            // Replace template variables
            Object.entries(variables).forEach(([key, value]) => {
                const pattern = new RegExp(`\\$\\{${key}\\}`, 'g');
                systemPrompt = systemPrompt.replace(pattern, String(value));
            });

            // Extract the actual prompt content from XML (simple extraction)
            const instructionsMatch = systemPrompt.match(/<Instructions>([\s\S]*?)<\/Instructions>/);
            if (instructionsMatch) {
                return this.cleanXmlContent(instructionsMatch[1]);
            }

            // Fallback: extract content between AgentIdentity and ToolExecution
            const identityMatch = systemPrompt.match(/<AgentIdentity>([\s\S]*?)<\/AgentIdentity>/);
            if (identityMatch) {
                return this.cleanXmlContent(identityMatch[1]) + 
                       "\n\nYou are an intelligent AI agent. Use the available tools to accomplish the given task effectively.";
            }

            // Final fallback
            return `You are an AI agent that ${variables.description}. Your task is to ${variables.task}. Available tools: ${variables.tool_registry}`;

        } catch (error) {
            this.logger.error('SystemPromptService', 'Failed to generate system prompt', { error });
            return `You are an AI agent. Use available tools to accomplish tasks.`;
        }
    }

    private formatToolRegistry(tools: string[]): string {
        if (!tools || tools.length === 0) {
            return 'No tools available';
        }
        
        return tools.map(tool => `- ${tool}`).join('\n');
    }

    private cleanXmlContent(content: string): string {
        return content
            .replace(/<[^>]+>/g, '') // Remove XML tags
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim();
    }

    // Method to get the raw XML template for cache integration later
    getRawTemplate(): string {
        return this.systemPromptTemplate;
    }
} 