import { v4 as uuidv4 } from 'uuid';
import { Conversation, ConversationTurn, ConversationState, ConversationMetadata, ConversationJSON } from "../types";

/**
 * Manages the state and flow of a single conversation.
 */
export class ConversationManager implements Conversation {
    public readonly id: string;
    public readonly originalTask: string;
    public readonly sessionId: string;
    public readonly createdAt: number;
    
    public turns: ConversationTurn[] = [];
    public currentState: ConversationState = 'initiated';
    public finalResponse?: string;

    constructor(task: string, sessionId: string) {
        this.id = uuidv4();
        this.originalTask = task;
        this.sessionId = sessionId;
        this.createdAt = Date.now();

        // Add the initial user request as the first turn
        this.addTurn('user', task);
    }

    public addTurn(role: 'user' | 'assistant', content: string, metadata?: ConversationMetadata): ConversationTurn {
        const turn: ConversationTurn = {
            id: uuidv4(),
            role,
            content,
            timestamp: Date.now(),
            metadata
        };
        this.turns.push(turn);
        return turn;
    }

    public getRecentTurns(count: number): ConversationTurn[] {
        return this.turns.slice(-count);
    }

    public getFinalResponse(): string | undefined {
        if (this.currentState === 'completed') {
            const lastTurn = this.turns[this.turns.length - 1];
            if (lastTurn?.role === 'assistant') {
                return lastTurn.content;
            }
        }
        return undefined;
    }

    public getReasoningChain(): string[] {
        return this.turns
            .filter(turn => turn.role === 'assistant' && turn.metadata?.toolUsed)
            .map(turn => `Used tool ${turn.metadata!.toolUsed} to: ${turn.content}`);
    }

    public getFlowSummary(): string {
        const userRequest = this.turns[0]?.content || this.originalTask;
        const finalResponse = this.getFinalResponse() || "Task in progress.";
        return `Task: "${userRequest}" -> Result: "${finalResponse}"`;
    }

    public getCurrentState(): ConversationState {
        return this.currentState;
    }

    public toJSON(): ConversationJSON {
        return {
            id: this.id,
            originalTask: this.originalTask,
            turns: this.turns,
            finalResponse: this.finalResponse || this.getFinalResponse() || "",
            reasoningChain: this.getReasoningChain(),
            duration: Date.now() - this.createdAt,
            state: this.currentState
        };
    }
} 