import { BaseService } from './base';
import { ISymphony } from '../types/symphony';
import { SystemPromptParser } from '../utils/xml';
import { PATHS } from '../config/paths';

export class SystemPromptService extends BaseService {
    private static instance: SystemPromptService;
    private parser: SystemPromptParser;
    private cachedPrompt: string | null = null;

    private constructor(symphony: ISymphony) {
        super(symphony, 'SystemPromptService');
        this.parser = SystemPromptParser.getInstance();
    }

    public static getInstance(symphony: ISymphony): SystemPromptService {
        if (!SystemPromptService.instance) {
            SystemPromptService.instance = new SystemPromptService(symphony);
        }
        return SystemPromptService.instance;
    }

    async getSystemPrompt(variables: {
        description: string;
        task: string;
        tool_registry: any[];
        FAST_PATH_THRESHOLD?: number;
    }): Promise<string> {
        if (this.cachedPrompt) {
            // Replace variables in cached prompt
            return this.replaceVariables(this.cachedPrompt, variables);
        }

        const parsedPrompt = await this.parser.parseSystemPrompt(PATHS.SYSTEM_PROMPT, {
            ...variables,
            FAST_PATH_THRESHOLD: variables.FAST_PATH_THRESHOLD || 0.7
        });
        const formattedPrompt = this.parser.formatToString(parsedPrompt);
        this.cachedPrompt = formattedPrompt;
        return this.replaceVariables(formattedPrompt, variables);
    }

    private replaceVariables(prompt: string, variables: Record<string, any>): string {
        return prompt.replace(/\${(\w+)}/g, (match, key) => {
            return variables[key]?.toString() || match;
        });
    }

    protected async initializeInternal(): Promise<void> {
        // Verify system prompt file exists and is valid
        try {
            await this.parser.parseSystemPrompt(PATHS.SYSTEM_PROMPT, {
                description: 'test',
                task: 'test',
                tool_registry: [],
                FAST_PATH_THRESHOLD: 0.7
            });
        } catch (error) {
            throw new Error(`Failed to initialize SystemPromptService: ${error}`);
        }
    }
} 