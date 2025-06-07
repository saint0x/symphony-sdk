import { ConversationEngineInterface, RuntimeContext, Conversation, RuntimeDependencies } from "../RuntimeTypes";
import { ConversationManager } from '../conversation/ConversationManager';

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
    async initiate(task: string, context: RuntimeContext): Promise<Conversation> {
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
     * (This will be implemented in a later step)
     */
    async conclude(conversation: Conversation, _context: RuntimeContext): Promise<Conversation> {
        this.dependencies.logger.warn('ConversationEngine', 'conclude method is not yet implemented.');
        return conversation;
    }
} 