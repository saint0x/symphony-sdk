import { BaseAgent } from './base';
import { AgentConfig, ToolResult } from '../types/sdk';
import { RuntimeResult, ExecutionStep } from '../runtime/RuntimeTypes';

type ExecuteTaskFn = (task: string, agentConfig: AgentConfig) => Promise<RuntimeResult>;

export class AgentExecutor extends BaseAgent {
    public readonly name: string;
    private executeTaskFn: ExecuteTaskFn;

    constructor(config: AgentConfig, executeFn: ExecuteTaskFn) {
        super(config);
        this.name = config.name;
        this.executeTaskFn = executeFn;
    }

    async executeTask(task: string): Promise<ToolResult> {
        this.logger.info('AgentExecutor', `Executing task via runtime: ${task}`);
        const runtimeResult = await this.executeTaskFn(task, this.config);
        return this.formatRuntimeResult(runtimeResult);
    }
    
    private formatRuntimeResult(runtimeResult: RuntimeResult): ToolResult {
        const { conversation, metrics, executionDetails, success, error } = runtimeResult;

        const formattedResult: any = {
            response: conversation?.finalResponse,
            reasoning: conversation?.reasoningChain.join('\n'),
            agent: this.name,
            timestamp: new Date(metrics.endTime).toISOString(),
            model: metrics.tokenUsage ? (metrics.tokenUsage as any).model : (this.config.llm as any).model,
            toolsExecuted: executionDetails.stepResults.map(this.formatStepToToolCall)
        };

        return {
            success,
            error,
            result: formattedResult
        };
    }

    private formatStepToToolCall(step: ExecutionStep): any {
        return {
            name: step.toolUsed || 'unknown_tool',
            parameters: step.parameters,
            success: step.success,
            result: step.result,
            error: step.error
        };
    }
} 