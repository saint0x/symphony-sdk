import { readFileSync } from 'fs';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXMLAsync = promisify(parseString);

interface ParsedXML {
    SystemPrompt: {
        AgentIdentity: [{
            Description: string[];
            Task: string[];
            Capabilities: [{
                Tools: string[];
                Status: string[];
            }];
        }];
        CommandMap: [{
            Requirements: [{
                Requirement: string[];
            }];
        }];
        ContextTree: [{
            Requirements: [{
                Requirement: string[];
            }];
        }];
        Validation: [{
            PrimaryLevel: [{
                Requirements: [{
                    Requirement: string[];
                }];
            }];
            SecondaryLevel: [{
                Requirements: [{
                    Requirement: string[];
                }];
            }];
        }];
        CriticalNote: string[];
    };
}

export interface SystemPromptVariables {
    description: string;
    task: string;
    tool_registry: any[];
    FAST_PATH_THRESHOLD: number;
}

export interface ParsedSystemPrompt {
    agentIdentity: {
        description: string;
        task: string;
        capabilities: {
            tools: string;
            status: string;
        };
    };
    commandMap: {
        requirements: string[];
    };
    contextTree: {
        requirements: string[];
    };
    validation: {
        primaryLevel: {
            requirements: string[];
        };
        secondaryLevel: {
            requirements: string[];
        };
    };
    criticalNote: string;
}

export class SystemPromptParser {
    private static instance: SystemPromptParser;
    private cachedPrompt: ParsedSystemPrompt | null = null;

    private constructor() {}

    static getInstance(): SystemPromptParser {
        if (!SystemPromptParser.instance) {
            SystemPromptParser.instance = new SystemPromptParser();
        }
        return SystemPromptParser.instance;
    }

    async parseSystemPrompt(xmlPath: string, variables: SystemPromptVariables): Promise<ParsedSystemPrompt> {
        if (this.cachedPrompt) {
            return this.interpolateVariables(this.cachedPrompt, variables);
        }

        const xmlContent = readFileSync(xmlPath, 'utf-8');
        const parsed = await parseXMLAsync(xmlContent) as ParsedXML;
        
        // Transform the parsed XML into our structured format
        const prompt: ParsedSystemPrompt = {
            agentIdentity: {
                description: parsed.SystemPrompt.AgentIdentity[0].Description[0],
                task: parsed.SystemPrompt.AgentIdentity[0].Task[0],
                capabilities: {
                    tools: parsed.SystemPrompt.AgentIdentity[0].Capabilities[0].Tools[0],
                    status: parsed.SystemPrompt.AgentIdentity[0].Capabilities[0].Status[0]
                }
            },
            commandMap: {
                requirements: parsed.SystemPrompt.CommandMap[0].Requirements[0].Requirement
            },
            contextTree: {
                requirements: parsed.SystemPrompt.ContextTree[0].Requirements[0].Requirement
            },
            validation: {
                primaryLevel: {
                    requirements: parsed.SystemPrompt.Validation[0].PrimaryLevel[0].Requirements[0].Requirement
                },
                secondaryLevel: {
                    requirements: parsed.SystemPrompt.Validation[0].SecondaryLevel[0].Requirements[0].Requirement
                }
            },
            criticalNote: parsed.SystemPrompt.CriticalNote[0]
        };

        this.cachedPrompt = prompt;
        return this.interpolateVariables(prompt, variables);
    }

    private interpolateVariables(prompt: ParsedSystemPrompt, variables: SystemPromptVariables): ParsedSystemPrompt {
        const interpolated = JSON.parse(JSON.stringify(prompt));
        
        // Replace variables in the format ${variableName}
        const replaceVariables = (text: string): string => {
            return text.replace(/\${(\w+)}/g, (match, varName) => {
                return variables[varName as keyof SystemPromptVariables]?.toString() || match;
            });
        };

        interpolated.agentIdentity.description = replaceVariables(interpolated.agentIdentity.description);
        interpolated.agentIdentity.task = replaceVariables(interpolated.agentIdentity.task);
        interpolated.agentIdentity.capabilities.tools = replaceVariables(interpolated.agentIdentity.capabilities.tools);

        return interpolated;
    }

    formatToString(parsed: ParsedSystemPrompt): string {
        return `You are an agent with the following configuration:

IDENTITY:
${parsed.agentIdentity.description}
${parsed.agentIdentity.task}

CAPABILITIES:
${parsed.agentIdentity.capabilities.tools}
${parsed.agentIdentity.capabilities.status}

VALIDATION REQUIREMENTS:
Primary:
${parsed.validation.primaryLevel.requirements.map(req => `- ${req}`).join('\n')}

Secondary:
${parsed.validation.secondaryLevel.requirements.map(req => `- ${req}`).join('\n')}

CRITICAL REQUIREMENTS:
${parsed.criticalNote}

When executing tasks:
1. Follow all validation requirements
2. Maintain context tree consistency
3. Use command map patterns appropriately
4. Handle errors according to specifications
5. Monitor and maintain performance thresholds`;
    }
} 