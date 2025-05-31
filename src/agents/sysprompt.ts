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
                // If using function calling, we might want to ensure the custom prompt doesn't conflict
                // For now, we'll assume custom prompts are aware or need manual adjustment
                this.logger.info('SystemPromptService', `Using custom system prompt. Function calling: ${useFunctionCalling}`);
                return this.loadCustomSystemPrompt(config.systemPrompt);
            }

            // Determine which template/instructions to use
            let template = this.systemPromptTemplate;
            if (useFunctionCalling) {
                // Potentially use a different template or modify the existing one
                // For now, we'll modify the basic prompt if the XML one is not function-call-aware
                // This is a placeholder - ideally, you'd have specific templates.
                template = this.getFunctionCallingAwareBasicPrompt(); 
                this.logger.info('SystemPromptService', 'Using function-calling aware basic prompt (placeholder)');
            } else if (this.systemPromptTemplate.includes("<ToolExecution>")) {
                 this.logger.info('SystemPromptService', 'Using XML system prompt template with TOOL_CALL format');
            } else {
                 this.logger.info('SystemPromptService', 'Using basic system prompt with TOOL_CALL format');
                 template = this.getBasicSystemPrompt(); // Fallback to old basic if XML failed and not func calling
            }

            const variables: SystemPromptVariables = {
                name: config.name,
                description: config.description,
                task: config.task,
                tool_registry: useFunctionCalling ? "Functions will be provided via API." : this.formatToolRegistry(config.tools),
                llm_model: typeof config.llm === 'string' ? config.llm : config.llm.model,
                directives: config.directives || 'None specified'
            };

            let prompt = template;
            Object.entries(variables).forEach(([key, value]) => {
                const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
                prompt = prompt.replace(regex, value);
            });

            // If using function calling, remove the old TOOL_CALL block if it exists from a generic template
            if (useFunctionCalling && prompt.includes("TOOL_CALL:")) {
                prompt = prompt.replace(/<Instructions>[\s\S]*?IMPORTANT: When you need to use a tool[\s\S]*?<\/Instructions>/gm, 
                    `<Instructions>
        You are an intelligent AI agent. Analyze tasks and use the provided functions to accomplish them.
        When a function is needed, the system will handle the call based on your arguments.
    </Instructions>`);
                prompt = prompt.replace(/<ToolExecution>[\s\S]*?<\/ToolExecution>/gm, '');
            }

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
        // Generate dynamic parameter reference
        const parameterReference = this.generateParameterReference();
        
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
        3. Execute tools by using the TOOL_CALL format
        4. Provide the results and any additional analysis
        
        IMPORTANT: When you need to use a tool, you MUST format your response exactly as:
        TOOL_CALL: toolName
        PARAMETERS: {"param1": "value1", "param2": "value2"}
        
        Then continue with your analysis or explanation.
        
        Tool Parameter Reference:
${parameterReference}
        
        Example:
        If asked to "create a file test.txt with content 'Hello World'", respond:
        TOOL_CALL: writeFile
        PARAMETERS: {"path": "test.txt", "content": "Hello World"}
        
        I will create the file test.txt with the content "Hello World".
    </Instructions>
    
    <Directives>
        \${directives}
    </Directives>
</SystemPrompt>`;
    }

    private getFunctionCallingAwareBasicPrompt(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<SystemPrompt>
    <AgentIdentity>
        <Description>You are an agent that \${description}</Description>
        <Task>You have been tasked to \${task}</Task>
        <Capabilities>
            <Tools>Available tools (functions) will be provided by the system.</Tools>
        </Capabilities>
    </AgentIdentity>
    
    <Instructions>
        You are an intelligent AI agent designed to analyze tasks and use available functions to accomplish them.
        Your role:
        1. Understand and analyze the user's request.
        2. Determine if a function call is needed to complete the task.
        3. If so, indicate the function and parameters to the system.
        4. Provide the results and any additional analysis based on function outputs or direct reasoning.
        The system will handle the actual function execution.
    </Instructions>
    
    <Directives>
        \${directives}
    </Directives>
</SystemPrompt>`;
    }

    private generateParameterReference(): string {
        // Get common tools for parameter reference
        const commonTools = ['writeFile', 'readFile', 'webSearch'];
        const references: string[] = [];
        
        for (const toolName of commonTools) {
            const metadata = this.toolRegistry.getToolMetadata(toolName);
            if (metadata && metadata.parameters && metadata.parameters.inputs) {
                const params = metadata.parameters.inputs
                    .map((p: { name: string }) => `"${p.name}": "${p.name}_value"`)
                    .join(', ');
                references.push(`        - ${toolName}: {${params}}`);
            }
        }
        
        return references.length > 0 ? references.join('\n') : '        - No parameter reference available';
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