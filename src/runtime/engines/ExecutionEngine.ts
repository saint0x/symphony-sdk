import { ExecutionEngineInterface } from "../RuntimeTypes";
import { RuntimeDependencies } from "../RuntimeTypes";
import { ToolResult, AgentConfig } from "../../types/sdk";
import { LLMRequest, LLMMessage, LLMConfig as RichLLMAgentConfig } from "../../llm/types";
import { SystemPromptService } from "../../agents/sysprompt";
import { ExecutionState } from "../context/ExecutionState";
import { LLMHandler } from '../../llm/handler';
import { RuntimeExecutionResult, RuntimeTask } from '../RuntimeTypes';
import { logger, LogCategory } from '../../utils/logger';
import { ToolRegistry } from '../../tools/standard/registry';
import { ToolConfig } from '../../types/tool.types';
import { LLMError, ToolError, ValidationError, ErrorCode, ErrorUtils } from '../../errors/index';

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
     * Executes a task using iterative tool orchestration for multi-step workflows.
     * Supports both single-tool and multi-tool chaining scenarios.
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

            // Check if task requires multi-tool orchestration
            const requiresOrchestration = this._detectMultiToolRequirement(task);
            
            if (requiresOrchestration && agentHasTools) {
                this.dependencies.logger.info('ExecutionEngine', 'Detected multi-tool requirement, using orchestration mode');
                return await this._executeWithOrchestration(task, systemPrompt, agentConfig, state);
            } else {
                this.dependencies.logger.info('ExecutionEngine', 'Using single-tool execution mode');
                return await this._executeSingleStep(task, systemPrompt, agentConfig, state);
            }

        } catch (error: any) {
            this.dependencies.logger.error('ExecutionEngine', 'Task execution failed', { 
                error: error.message, 
                task, 
                agentName: agentConfig.name 
            });

            if (error instanceof ToolError || error instanceof LLMError || error instanceof ValidationError) {
                // Already a SymphonyError, re-throw
                throw error;
            }

            // Convert generic errors
            const symphonyError = ErrorUtils.convertError(
                error,
                'ExecutionEngine',
                'execute',
                { task, agentName: agentConfig.name }
            );
            throw symphonyError;
        }
    }

    /**
     * Executes a multi-tool workflow with proper orchestration and context flow
     */
    private async _executeWithOrchestration(task: string, systemPrompt: string, agentConfig: AgentConfig, _state: ExecutionState): Promise<ToolResult> {
        const conversationHistory: LLMMessage[] = [];
        const allToolResults: any[] = [];
        let overallSuccess = true;
        let primaryError: string | undefined;
        let finalResponse = '';
        let orchestrationStep = 0;
        const maxSteps = 5; // Prevent infinite loops

        // Enhanced system prompt for orchestration
        const orchestrationPrompt = systemPrompt + `

--- ORCHESTRATION MODE ---
You are executing a multi-step task that requires using multiple tools in sequence.

IMPORTANT ORCHESTRATION RULES:
1. Analyze the full task and identify ALL required steps
2. Execute ONE tool at a time, in logical order
3. After each tool execution, I will provide you the result
4. Continue with the next tool based on the previous results
5. When all required tools have been executed, respond with "tool_name": "none" and provide final synthesis

Your task: ${task}

Start with the FIRST tool needed for this task.`;

        conversationHistory.push({ role: 'system', content: orchestrationPrompt });
        conversationHistory.push({ role: 'user', content: `Execute the first step of this task: ${task}` });

        while (orchestrationStep < maxSteps) {
            orchestrationStep++;
            this.dependencies.logger.info('ExecutionEngine', `Orchestration step ${orchestrationStep}`, {
                conversationLength: conversationHistory.length,
                toolsExecutedSoFar: allToolResults.length
            });

            // Execute current step
            const stepResult = await this._executeSingleOrchestrationStep(conversationHistory, agentConfig);
            
            if (!stepResult.success) {
                overallSuccess = false;
                primaryError = stepResult.error;
                break;
            }

            // Check if this step executed a tool
            if (stepResult.toolExecuted) {
                allToolResults.push(stepResult.toolExecuted);
                
                // Add tool result to conversation history for context
                conversationHistory.push({
                    role: 'assistant',
                    content: JSON.stringify({
                        tool_name: stepResult.toolExecuted.name,
                        parameters: stepResult.toolExecuted.parameters || {}
                    })
                });
                
                conversationHistory.push({
                    role: 'user', 
                    content: `Tool "${stepResult.toolExecuted.name}" completed. Result: ${JSON.stringify(stepResult.toolExecuted.result)}. ${allToolResults.length < agentConfig.tools.length ? 'Continue with the next required tool.' : 'If all required tools have been used, provide your final synthesis.'}`
                });
            } else {
                // No tool executed, this should be the final response
                finalResponse = stepResult.response || 'Task completed';
                break;
            }
        }

        if (orchestrationStep >= maxSteps) {
            this.dependencies.logger.warn('ExecutionEngine', 'Orchestration reached maximum steps limit');
            overallSuccess = false;
            primaryError = 'Orchestration exceeded maximum step limit';
        }

        // If we don't have a final response, generate one from the last tool result
        if (!finalResponse && allToolResults.length > 0) {
            const lastResult = allToolResults[allToolResults.length - 1];
            finalResponse = lastResult.result?.response || JSON.stringify(lastResult.result) || 'Multi-tool orchestration completed';
        }

        return {
            success: overallSuccess,
            result: {
                response: finalResponse,
                reasoning: `Orchestrated ${allToolResults.length} tools in sequence: ${allToolResults.map(t => t.name).join(' → ')}`,
                agent: agentConfig.name,
                timestamp: new Date().toISOString(),
                model: allToolResults[0]?.model || 'unknown',
                tokenUsage: allToolResults.reduce((sum, t) => sum + (t.tokenUsage || 0), 0),
                toolsExecuted: allToolResults,
                orchestrationSteps: orchestrationStep
            },
            error: primaryError
        };
    }

    /**
     * Executes a single step in the orchestration flow
     */
    private async _executeSingleOrchestrationStep(conversationHistory: LLMMessage[], agentConfig: AgentConfig): Promise<{
        success: boolean;
        toolExecuted?: any;
        response?: string;
        error?: string;
    }> {
        try {
            const agentLLMConfig = typeof agentConfig.llm === 'object' ? agentConfig.llm as RichLLMAgentConfig : null;
            
            const baseLlmSettings = {
                model: agentLLMConfig?.model || (typeof agentConfig.llm === 'string' ? agentConfig.llm : 'default-model'),
                temperature: agentLLMConfig?.temperature ?? 0.7,
                maxTokens: agentLLMConfig?.maxTokens ?? 2048,
            };

            const llmRequest: LLMRequest = {
                messages: [...conversationHistory],
                llmConfig: baseLlmSettings,
                expectsJsonResponse: true
            };

            const llmResponse = await this.dependencies.llmHandler.complete(llmRequest);

            if (!llmResponse || !llmResponse.content) {
                return { success: false, error: 'LLM response was empty' };
            }

            // Parse JSON response
            let parsedJson;
            try {
                parsedJson = JSON.parse(llmResponse.content);
            } catch (e) {
                return { success: false, error: `Invalid JSON response: ${llmResponse.content}` };
            }

            const toolName = parsedJson.tool_name || parsedJson.toolName;
            const parameters = parsedJson.parameters;

            if (toolName && toolName !== 'none' && parameters) {
                // Execute the tool
                const toolResult = await this.dependencies.toolRegistry.executeTool(toolName, parameters);
                
                return {
                    success: true,
                    toolExecuted: {
                        name: toolName,
                        parameters,
                        success: toolResult.success,
                        result: toolResult.result,
                        error: toolResult.error,
                        model: llmResponse.model,
                        tokenUsage: llmResponse.usage
                    }
                };
            } else if (toolName === 'none') {
                // Final response
                return {
                    success: true,
                    response: parsedJson.response || 'Task completed'
                };
            } else {
                return { success: false, error: `Invalid tool specification: ${toolName}` };
            }

        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
            };
        }
    }

    /**
     * Executes a single-step task (original behavior)
     */
    private async _executeSingleStep(task: string, systemPrompt: string, agentConfig: AgentConfig, state: ExecutionState): Promise<ToolResult> {
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
    }

    /**
     * Detects if a task requires multi-tool orchestration
     */
    private _detectMultiToolRequirement(task: string): boolean {
        const multiToolIndicators = [
            'first.*then', 'step 1.*step 2', 'sequence', 'chain', 'orchestration',
            'ponder.*write', 'analyze.*generate', 'think.*code', 'both',
            'first.*second', 'after.*then', 'followed by', 'next.*tool',
            'FIRST:', 'SECOND:', '1.', '2.', 'execute TWO tools'
        ];
        
        const taskLower = task.toLowerCase();
        return multiToolIndicators.some(indicator => {
            const regex = new RegExp(indicator.replace('.*', '.*?'), 'i');
            return regex.test(taskLower);
        });
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
            throw new LLMError(
                ErrorCode.LLM_API_ERROR,
                'LLM completion failed - no response received',
                { task, agentConfig: agentConfig.name },
                { component: 'ExecutionEngine', operation: '_analyzeAndExecute' }
            );
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

    private async executeLLMCall(task: RuntimeTask): Promise<RuntimeExecutionResult> {
        try {
            // ... existing implementation ...
        } catch (error: any) {
            // Convert to structured error
            if (error instanceof LLMError) {
                throw error;
            }

            throw new LLMError(
                ErrorCode.LLM_API_ERROR,
                'LLM completion failed',
                error,
                { component: 'ExecutionEngine', operation: 'executeLLMCall', task: task.id }
            );
        }
    }
} 