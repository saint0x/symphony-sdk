import { ConversationEngineInterface, RuntimeContext, Conversation, RuntimeDependencies } from "../types";
import { ConversationManager } from '../conversation/ConversationManager';
import { LLMRequestConfig } from '../../llm/types';

/**
 * The ConversationEngine is responsible for managing the conversational flow of an agent's task.
 */
export class ConversationEngine implements ConversationEngineInterface {
    private dependencies: RuntimeDependencies;

    constructor(dependencies: RuntimeDependencies) {
        this.dependencies = dependencies;
    }

    async initialize(): Promise<void> {
        this.dependencies.logger.info('ConversationEngine', 'ConversationEngine initialized');
    }

    getDependencies(): string[] {
        return ['logger', 'llmHandler'];
    }

    getState(): string {
        return 'ready';
    }

    async healthCheck(): Promise<boolean> {
        return true;
    }

    /**
     * Initiates a new conversation for a given task.
     * @param task The user's initial task description.
     * @param context The runtime context.
     * @returns A new Conversation object.
     */
    async initiate(task: string, context: { sessionId: string }): Promise<Conversation> {
        const conversation = new ConversationManager(task, context.sessionId);
        
        // For now, we'll just add a simple, hardcoded opening response.
        // In the future, this would use an LLM to be more dynamic.
        const openingResponse = `Understood. Starting task: ${task}`;
        conversation.addTurn('assistant', openingResponse);
        conversation.currentState = 'working';
        
        this.dependencies.logger.info('ConversationEngine', `Initiated conversation for task: ${task}`, {
            conversationId: conversation.id,
            sessionId: context.sessionId
        });

        return conversation;
    }

    /**
     * Runs the main execution logic and updates the conversation.
     * (This will be implemented in a later step)
     */
    async run(conversation: Conversation, _context: RuntimeContext): Promise<Conversation> {
        this.dependencies.logger.warn('ConversationEngine', 'run method is not yet implemented.');
        return conversation;
    }

    /**
     * Concludes the conversation after execution is complete.
     * This involves generating a final summary response.
     */
    async conclude(conversation: Conversation, context: RuntimeContext): Promise<Conversation> {
        this.dependencies.logger.info('ConversationEngine', 'Concluding conversation.', {
            conversationId: conversation.id,
            sessionId: context.sessionId
        });

        // Generate a final summary using the LLM
        const history = conversation.turns.map((turn: any) => `${turn.role}: ${turn.content}`).join('\n');
        const summaryPrompt = `Based on the following conversation, provide a concise summary of the outcome:\n\n${history}`;

        try {
            // Extract model from agent config, handling both string and object types
            let model: string | undefined;
            if (typeof context.agentConfig.llm === 'string') {
                model = context.agentConfig.llm;
            } else if (context.agentConfig.llm && typeof context.agentConfig.llm === 'object') {
                model = context.agentConfig.llm.model;
            }

            const request: any = {
                messages: [{ role: 'user', content: summaryPrompt }],
                llmConfig: {
                    model: model,
                    temperature: 0.5
                } as LLMRequestConfig
            };
            const response = await this.dependencies.llmHandler.complete(request);
            const finalResponse = response.content || 'I was unable to summarize my work.';

            conversation.addTurn('assistant', finalResponse);
            conversation.finalResponse = finalResponse;
            conversation.currentState = 'completed';

            this.dependencies.logger.info('ConversationEngine', 'Conversation concluded successfully.', {
                conversationId: conversation.id
            });

        } catch (error) {
            this.dependencies.logger.error('ConversationEngine', 'Failed to generate final summary', { error });
            conversation.currentState = 'error';
            conversation.finalResponse = 'I was unable to summarize my work.';
        }

        return conversation;
    }
} 