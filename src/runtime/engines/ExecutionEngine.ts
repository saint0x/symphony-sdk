import { ExecutionEngineInterface } from "../RuntimeTypes";
import { RuntimeDependencies } from "../RuntimeTypes";
import { ToolResult, AgentConfig } from "../../types/sdk";
import { LLMRequest, LLMMessage, LLMConfig as RichLLMAgentConfig } from "../../llm/types";
import { SystemPromptService } from "../../agents/sysprompt";
import { ExecutionState } from "../context/ExecutionState";

/**
 * The ExecutionEngine is responsible for the core "magic" of tool execution.
 * It preserves the original, brilliant unconscious tool execution logic.
 */
export class ExecutionEngine implements ExecutionEngineInterface {
    private dependencies: RuntimeDependencies;
    private systemPromptService: SystemPromptService;

    constructor(dependencies: RuntimeDependencies) {
        this.dependencies = dependencies;
        this.systemPromptService = new SystemPromptService();
    }

    async initialize(): Promise<void> {
        this.dependencies.logger.info('ExecutionEngine', 'ExecutionEngine initialized');
    }
    
    getDependencies(): string[] {
        return ['toolRegistry', 'contextAPI', 'llmHandler', 'logger'];
    }

    getState(): string {
        return 'ready';
    }

    async healthCheck(): Promise<boolean> {
        return true;
    }

    /**
     * Executes a task using the "magic" of unconscious tool execution.
     * This is a direct port of the original, successful logic from AgentExecutor.
     * @param task The task to execute.
     * @param agentConfig The configuration of the agent performing the task.
     * @param state The current execution state.
     * @returns A promise that resolves with the result of the tool execution.
     */
    async execute(task: string, agentConfig: AgentConfig, state: ExecutionState): Promise<ToolResult> {
        try {
            this.dependencies.logger.info('ExecutionEngine', `Executing task: ${task}`);

            const agentHasTools = agentConfig.tools && agentConfig.tools.length > 0;
            let systemPrompt = this.systemPromptService.generateSystemPrompt(agentConfig, agentHasTools);
            
            if (agentConfig.directives && !agentConfig.systemPrompt) {
                systemPrompt += `\n\nAdditional Directives:\n${agentConfig.directives}`;
            }
            
            this.dependencies.logger.info('ExecutionEngine', 'Generated system prompt', {
                promptLength: systemPrompt.length,
                agentName: agentConfig.name,
                toolCount: agentConfig.tools.length,
                hasCustomDirectives: !!agentConfig.directives
            });

            const analysisResult = await this._analyzeAndExecute(task, systemPrompt, agentConfig, state);
            
            let overallTaskSuccess = true;
            let primaryError: string | undefined;
            let finalResponse = analysisResult.response;

            if (analysisResult.toolsExecuted && analysisResult.toolsExecuted.length > 0) {
                const firstFailedTool = analysisResult.toolsExecuted.find(t => !t.success);
                if (firstFailedTool) {
                    overallTaskSuccess = false;
                    primaryError = `Tool '${firstFailedTool.name}' failed: ${firstFailedTool.error || 'Unknown tool error'}`;
                }
            } else {
                const agentHasTools = agentConfig.tools && agentConfig.tools.length > 0;
                if (agentHasTools) {
                    let llmIndicatedNoToolViaJson = false;
                    if (analysisResult.response) { 
                        try {
                            const parsedResponse = JSON.parse(analysisResult.response);
                            if (parsedResponse.tool_name === 'none' || parsedResponse.toolName === 'none') {
                                llmIndicatedNoToolViaJson = true;
                            }
                        } catch (e) {
                             this.dependencies.logger.debug('ExecutionEngine', 'execute: Could not parse analysisResult.response as JSON.', { response: analysisResult.response });
                        }
                    }

                    if (!llmIndicatedNoToolViaJson) {
                        overallTaskSuccess = false;
                        primaryError = `Agent ${agentConfig.name} has tools but did not select one.`;
                        this.dependencies.logger.warn('ExecutionEngine', primaryError, { agentName: agentConfig.name });
                    }
                }
            }

            return {
                success: overallTaskSuccess,
                result: {
                    response: finalResponse,
                    reasoning: analysisResult.reasoning,
                    agent: analysisResult.agent,
                    timestamp: analysisResult.timestamp,
                    model: analysisResult.model,
                    tokenUsage: analysisResult.tokenUsage,
                    toolsExecuted: analysisResult.toolsExecuted
                },
                error: primaryError
            };

        } catch (error) {
            this.dependencies.logger.error('ExecutionEngine', 'Task execution failed', { error });
            const fallbackResult = {
                response: `Agent ${agentConfig.name} encountered an error processing: ${task}`,
                error: error instanceof Error ? error.message : String(error),
                fallback: true,
                timestamp: new Date().toISOString()
            };

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                result: fallbackResult
            };
        }
    }

    private async _analyzeAndExecute(task: string, systemPrompt: string, agentConfig: AgentConfig, _state: ExecutionState) {
        const agentLLMConfig = typeof agentConfig.llm === 'object' ? agentConfig.llm as RichLLMAgentConfig : null;
        const agentHasTools = agentConfig.tools && agentConfig.tools.length > 0;

        let finalSystemPrompt = systemPrompt;

        if (agentHasTools) {
            let jsonInstruction = "";
            const baseInstruction = "\n\n--- BEGIN SDK JSON REQUIREMENTS ---";
            const endInstruction = "\n--- END SDK JSON REQUIREMENTS ---";
            let toolGuidance = `
YOU HAVE TOOLS. TO USE A TOOL: your JSON object MUST contain a "tool_name" (string) key AND a "parameters" (object) key.
IF NO TOOL IS NEEDED: your JSON object MUST contain a "tool_name" (string) key set EXPLICITLY to "none", AND a "response" (string) key with your direct textual answer.`;
            
            jsonInstruction = `${baseInstruction}\nYOUR ENTIRE RESPONSE MUST BE A SINGLE VALID JSON OBJECT.${toolGuidance}\nFAILURE TO ADHERE TO THIS JSON STRUCTURE WILL RESULT IN AN ERROR.${endInstruction}`;
            
            finalSystemPrompt += jsonInstruction;
        }

        const initialMessages: LLMMessage[] = [
            { role: 'system', content: finalSystemPrompt }, 
            { role: 'user', content: task }
        ];

        const baseLlmSettings = {
            model: agentLLMConfig?.model || (typeof agentConfig.llm === 'string' ? agentConfig.llm : 'default-model'),
            temperature: agentLLMConfig?.temperature ?? 0.7,
            maxTokens: agentLLMConfig?.maxTokens ?? 2048,
        };

        const llmRequest: LLMRequest = {
            messages: initialMessages,
            llmConfig: baseLlmSettings
        };

        if (agentHasTools) {
            llmRequest.expectsJsonResponse = true;
        }

        const llmResponse = await this.dependencies.llmHandler.complete(llmRequest);

        if (!llmResponse) {
            this.dependencies.logger.error('ExecutionEngine', 'LLM completion returned null/undefined.');
            throw new Error('LLM completion failed.');
        }

        let toolResults: any[] = [];
        let actualResponseContent = llmResponse.content;

        if (agentHasTools && llmResponse.content) { 
            try {
                const parsedJson = JSON.parse(llmResponse.content);
                const toolName = parsedJson.tool_name || parsedJson.toolName;
                const parameters = parsedJson.parameters;

                if (toolName && toolName !== 'none' && parameters) {
                    const toolResultData = await this.dependencies.toolRegistry.executeTool(toolName, parameters);
                    toolResults.push({ name: toolName, success: toolResultData.success, result: toolResultData.result, error: toolResultData.error });
                    actualResponseContent = `Tool ${toolName} executed. Success: ${toolResultData.success}. Result: ${JSON.stringify(toolResultData.result || toolResultData.error)}`;
                } else if (toolName === 'none') {
                    actualResponseContent = parsedJson.response || "No further action taken.";
                } else {
                    actualResponseContent = llmResponse.content; // Fallback to raw content
                }
            } catch (e) {
                this.dependencies.logger.error('ExecutionEngine', 'Failed to parse LLM content as JSON.', { content: llmResponse.content, error: e });
                actualResponseContent = llmResponse.content || "Error: LLM response was not valid JSON."; 
            }
        }

        return {
            response: actualResponseContent ?? '',
            reasoning: toolResults.length > 0 
                ? `Processed ${toolResults.length} tool actions. First tool: ${toolResults[0].name}, Success: ${toolResults[0].success}` 
                : (agentHasTools ? 'No tool actions taken as per LLM decision.' : 'Direct LLM response as agent has no tools.'),
            agent: agentConfig.name,
            timestamp: new Date().toISOString(),
            model: llmResponse.model,
            tokenUsage: llmResponse.usage,
            toolsExecuted: toolResults.length > 0 ? toolResults : undefined
        };
    }
} 