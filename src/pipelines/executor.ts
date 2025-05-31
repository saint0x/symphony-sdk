import { PipelineResult, PipelineStepResult, AgentConfig, TeamConfig } from '../types/sdk';
import { Logger } from '../utils/logger';
import { ChainExecutor, ToolChain } from '../tools/executor';
import { ToolRegistry } from '../tools/standard/registry';
import { PipelineIntelligence, PipelinePerformanceProfile, OptimizationRecommendation } from './service';
import { IAgentService, ITeamService } from '../services';

// Re-export PipelineStepResult for use by other pipeline modules
export type { PipelineStepResult };

export interface PipelineContext {
  pipelineId: string;
  executionId: string;
  variables: Map<string, any>;
  stepResults: Map<string, PipelineStepResult>;
  globalState: Record<string, any>;
  metadata: {
    startTime: number;
    currentStep: number;
    totalSteps: number;
    retryCount: number;
    errorHistory: Array<{
      step: string;
      error: string;
      timestamp: number;
      retryAttempt: number;
    }>;
  };
}

export interface PipelineStepDefinition {
  id: string;
  name: string;
  type: 'tool' | 'chain' | 'agent' | 'team' | 'condition' | 'transform' | 'parallel' | 'wait';
  tool?: string;
  chain?: ToolChain;
  agent?: string;
  team?: string;
  condition?: {
    expression: string;
    ifTrue: string;
    ifFalse?: string;
  };
  transform?: {
    input: string;
    output: string;
    transformation: string;
  };
  parallel?: {
    steps: string[];
    waitForAll: boolean;
  };
  wait?: {
    duration: number;
    condition?: string;
  };
  inputs?: Record<string, string>;
  inputMap?: (context: PipelineContext) => Record<string, any> | Promise<Record<string, any>>;
  outputs?: Record<string, string>;
  dependencies?: string[];
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
    retryOn: string[];
  };
  timeout?: number;
  continueOnError?: boolean;
}

export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  steps: PipelineStepDefinition[];
  variables?: Record<string, any>;
  errorHandling?: {
    strategy: 'stop' | 'continue' | 'retry' | 'fallback';
    fallbackPipeline?: string;
    maxGlobalRetries: number;
  };
  concurrency?: {
    maxParallelSteps: number;
    resourceLimits: Record<string, number>;
  };
}

export enum PipelineExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

export class PipelineExecutor {
  private pipelineId: string;
  private definition: PipelineDefinition;
  private context: PipelineContext;
  private logger: Logger;
  private toolRegistry: ToolRegistry;
  private chainExecutor: ChainExecutor;
  private status: PipelineExecutionStatus;
  private activeSteps: Map<string, Promise<PipelineStepResult>>;
  private intelligence: PipelineIntelligence;
  private agentService: IAgentService;
  private teamService: ITeamService;

  constructor(definition: PipelineDefinition, agentService: IAgentService, teamService: ITeamService) {
    this.pipelineId = `pipeline_${Date.now()}`;
    this.definition = definition;
    this.status = PipelineExecutionStatus.PENDING;
    this.logger = Logger.getInstance(`PipelineExecutor:${definition.name}`);
    this.toolRegistry = ToolRegistry.getInstance();
    this.chainExecutor = ChainExecutor.getInstance();
    this.activeSteps = new Map();
    this.intelligence = new PipelineIntelligence();
    this.agentService = agentService;
    this.teamService = teamService;

    this.context = {
      pipelineId: this.pipelineId,
      executionId: `${this.pipelineId}_${this.generateId()}`,
      variables: new Map(Object.entries(definition.variables || {})),
      stepResults: new Map(),
      globalState: {},
      metadata: {
        startTime: Date.now(),
        currentStep: 0,
        totalSteps: definition.steps.length,
        retryCount: 0,
        errorHistory: []
      }
    };
  }

  async execute(input?: any): Promise<PipelineResult> {
    const startTime = Date.now();
    this.logger.info('PipelineExecutor', `Starting pipeline execution: ${this.definition.name}`, {
      pipelineId: this.pipelineId,
      executionId: this.context.executionId,
      stepCount: this.definition.steps.length,
      input: input ? Object.keys(input) : [],
      intelligenceEnabled: true
    });

    this.status = PipelineExecutionStatus.RUNNING;

    try {
      // Initialize pipeline context with input
      if (input) {
        Object.entries(input).forEach(([key, value]) => {
          this.context.variables.set(key, value);
        });
      }

      // Build execution plan
      const executionPlan = await this.buildExecutionPlan();
      
      // Execute pipeline steps with intelligence
      await this.executePipeline(executionPlan);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Generate performance profile
      const performanceProfile = await this.intelligence.generatePerformanceProfile(
        this.pipelineId, 
        this.context
      );

      this.status = PipelineExecutionStatus.COMPLETED;

      this.logger.info('PipelineExecutor', `Pipeline execution completed successfully`, {
        pipelineId: this.pipelineId,
        duration,
        stepsExecuted: this.context.stepResults.size,
        successRate: this.calculateSuccessRate(),
        performanceProfile: {
          totalDuration: performanceProfile.totalDuration,
          bottleneckCount: performanceProfile.bottlenecks.length,
          optimizationOpportunities: performanceProfile.optimization.parallelizationOpportunities.length
        }
      });

      return {
        success: true,
        result: {
          pipelineId: this.pipelineId,
          executionId: this.context.executionId,
          status: this.status,
          steps: Array.from(this.context.stepResults.values()),
          output: this.extractPipelineOutput(),
          context: this.serializeContext(),
          performanceProfile
        },
        metrics: {
          duration,
          startTime,
          endTime,
          stepResults: {
            stepsExecuted: this.context.stepResults.size,
            successRate: this.calculateSuccessRate(),
            retryCount: this.context.metadata.retryCount
          },
          intelligence: {
            bottlenecksIdentified: performanceProfile.bottlenecks.length,
            optimizationRecommendations: performanceProfile.optimization.parallelizationOpportunities.length,
            estimatedImprovement: performanceProfile.optimization.estimatedImprovement
          }
        }
      };

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.status = PipelineExecutionStatus.FAILED;

      // Generate performance profile even for failed executions
      let performanceProfile: PipelinePerformanceProfile | undefined;
      try {
        performanceProfile = await this.intelligence.generatePerformanceProfile(
          this.pipelineId, 
          this.context
        );
      } catch (profileError) {
        this.logger.warn('PipelineExecutor', 'Failed to generate performance profile for failed pipeline', {
          error: profileError instanceof Error ? profileError.message : String(profileError)
        });
      }

      this.logger.error('PipelineExecutor', `Pipeline execution failed`, {
        pipelineId: this.pipelineId,
        error: error instanceof Error ? error.message : String(error),
        duration,
        stepsCompleted: this.context.stepResults.size,
        totalSteps: this.definition.steps.length,
        performanceInsights: performanceProfile ? {
          bottlenecks: performanceProfile.bottlenecks.length,
          failurePatterns: Object.keys(performanceProfile.trends.errorPatterns).length
        } : undefined
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        result: {
          pipelineId: this.pipelineId,
          executionId: this.context.executionId,
          status: this.status,
          steps: Array.from(this.context.stepResults.values()),
          context: this.serializeContext(),
          performanceProfile
        },
        metrics: {
          duration,
          startTime,
          endTime,
          stepResults: {
            stepsExecuted: this.context.stepResults.size,
            retryCount: this.context.metadata.retryCount
          }
        }
      };
    }
  }

  private async buildExecutionPlan(): Promise<PipelineStepDefinition[]> {
    this.logger.info('PipelineExecutor', 'Building pipeline execution plan', {
      totalSteps: this.definition.steps.length
    });

    // For now, use simple sequential execution
    // TODO: Implement dependency-based topological sorting
    const plan = [...this.definition.steps];

    // Validate dependencies
    for (const step of plan) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!plan.find(s => s.id === dep)) {
            throw new Error(`Step ${step.id} depends on non-existent step: ${dep}`);
          }
        }
      }
    }

    this.logger.info('PipelineExecutor', 'Execution plan built successfully', {
      planLength: plan.length,
      parallelSteps: plan.filter(s => s.type === 'parallel').length,
      conditionalSteps: plan.filter(s => s.type === 'condition').length
    });

    return plan;
  }

  private async executePipeline(plan: PipelineStepDefinition[]): Promise<any> {
    this.logger.info('PipelineExecutor', 'Executing pipeline steps', {
      planLength: plan.length
    });

    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      this.context.metadata.currentStep = i + 1;

      // Check dependencies
      if (step.dependencies && !await this.checkDependencies(step.dependencies)) {
        throw new Error(`Dependencies not met for step: ${step.id}`);
      }

      // Execute step with retry logic
      const stepResult = await this.executeStepWithRetry(step);
      
      // Store result
      this.context.stepResults.set(step.id, stepResult);

      // Handle step failure
      if (!stepResult.success && !step.continueOnError) {
        const errorStrategy = this.definition.errorHandling?.strategy || 'stop';
        
        if (errorStrategy === 'stop') {
          throw new Error(`Pipeline stopped due to step failure: ${step.id}`);
        } else if (errorStrategy === 'fallback' && this.definition.errorHandling?.fallbackPipeline) {
          this.logger.info('PipelineExecutor', `Executing fallback pipeline: ${this.definition.errorHandling.fallbackPipeline}`);
          // TODO: Implement fallback pipeline execution
        }
      }

      // Update context with step outputs
      if (stepResult.success && stepResult.outputs) {
        Object.entries(stepResult.outputs).forEach(([key, value]) => {
          this.context.variables.set(key, value);
        });
      }
    }

    return this.extractPipelineOutput();
  }

  private async executeStepWithRetry(step: PipelineStepDefinition): Promise<PipelineStepResult> {
    // Use enhanced intelligence-driven retry logic
    return await this.intelligence.executeStepWithEnhancedRecovery(
      step,
      this.context,
      (stepDef) => this.executeStep(stepDef)
    );
  }

  private async executeStep(step: PipelineStepDefinition): Promise<PipelineStepResult> {
    const startTime = Date.now();
    let inputs: Record<string, any> = {};

    try {
      // Resolve inputs: prioritize inputMap if available, otherwise use static inputs
      if (typeof step.inputMap === 'function') {
        this.logger.debug('PipelineExecutor', `Using inputMap function for step: ${step.id}`);
        // Provide the current pipeline context to inputMap
        inputs = await step.inputMap(this.context); 
      } else if (step.inputs) {
        this.logger.debug('PipelineExecutor', `Using static inputs for step: ${step.id}`);
        inputs = await this.resolveInputs(step.inputs);
      } else {
        this.logger.debug('PipelineExecutor', `No inputMap or static inputs for step: ${step.id}, using empty inputs.`);
      }

      this.logger.debug('PipelineExecutor', `Resolved inputs for step ${step.id}:`, { inputs: Object.keys(inputs).length > 0 ? inputs : '{}' });

      let result: any;
      let outputs: Record<string, any> = {};

      this.logger.debug('PipelineExecutor', `Executing step: ${step.id} of type: ${step.type}`, { inputs });

      switch (step.type) {
        case 'tool':
          result = await this.executeToolStep(step, inputs);
          break;
        case 'chain':
          result = await this.executeChainStep(step, inputs);
          break;
        case 'agent':
          result = await this.executeAgentStep(step, inputs);
          break;
        case 'team':
          result = await this.executeTeamStep(step, inputs);
          break;
        case 'condition':
          result = await this.executeConditionStep(step, inputs);
          break;
        case 'transform':
          result = await this.executeTransformStep(step, inputs);
          break;
        case 'parallel':
          result = await this.executeParallelStep(step, inputs);
          break;
        case 'wait':
          result = await this.executeWaitStep(step, inputs);
          break;
        default:
          const exhaustiveCheck: never = step.type;
          throw new Error(`Unknown or unhandled step type: ${exhaustiveCheck}`);
      }

      // Process outputs
      if (step.outputs && result) {
        outputs = await this.processOutputs(step.outputs, result);
      }

      const endTime = Date.now();

      return {
        stepId: step.id,
        success: true,
        result,
        outputs,
        startTime,
        endTime,
        duration: endTime - startTime,
        retryCount: 0
      };

    } catch (error) {
      const endTime = Date.now();
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.logger.error('PipelineExecutor', `Step execution failed: ${step.id}`, {
        error: errorMsg,
        stepType: step.type
      });

      return {
        stepId: step.id,
        success: false,
        error: errorMsg,
        startTime,
        endTime,
        duration: endTime - startTime,
        retryCount: 0
      };
    }
  }

  private async executeToolStep(step: PipelineStepDefinition, inputs: Record<string, any>): Promise<any> {
    if (!step.tool) {
      throw new Error(`Tool step ${step.id} missing tool specification`);
    }

    this.logger.info('PipelineExecutor', `Executing tool step: ${step.tool}`, {
      stepId: step.id,
      inputs: Object.keys(inputs)
    });

    return await this.toolRegistry.executeTool(step.tool, inputs);
  }

  private async executeChainStep(step: PipelineStepDefinition, inputs: Record<string, any>): Promise<any> {
    if (!step.chain) {
      throw new Error(`Chain step ${step.id} missing chain specification`);
    }

    this.logger.info('PipelineExecutor', `Executing chain step`, {
      stepId: step.id,
      chainSteps: step.chain.steps.length
    });

    return await this.chainExecutor.executeChain(step.chain, inputs);
  }

  private async executeAgentStep(step: PipelineStepDefinition, inputs: Record<string, any>): Promise<any> {
    if (!step.agent) {
      throw new Error(`Agent step ${step.id} missing agent specification (agent name).`);
    }
    if (!this.agentService) {
        throw new Error(`AgentService not available in PipelineExecutor for step ${step.id}.`);
    }

    this.logger.info('PipelineExecutor', `Executing agent step: ${step.agent}`, {
      stepId: step.id,
      inputs: Object.keys(inputs)
    });

    const agentInstance = await this.agentService.get(step.agent);
    if (!agentInstance) {
        throw new Error(`Agent named "${step.agent}" not found for step ${step.id}.`);
    }

    // Assuming the primary input for an agent is a 'task' string
    // The inputMap in the pipeline definition should prepare this.
    const task = inputs.task || inputs.prompt || inputs.query;
    if (typeof task !== 'string') {
        throw new Error(`Input for agent step ${step.id} must include a string 'task', 'prompt', or 'query'. Received: ${JSON.stringify(inputs)}`);
    }

    const agentRunResult = await agentInstance.run(task);
    // The result from agentInstance.run() is already an AgentResult (which includes {success, result, error, metrics})
    // The pipeline step output mapping will then extract from agentRunResult.result.toolsExecuted[0].result.codeOutput etc.
    return agentRunResult; 
  }

  private async executeTeamStep(step: PipelineStepDefinition, inputs: Record<string, any>): Promise<any> {
    if (!step.team) {
      throw new Error(`Team step ${step.id} missing team specification (team name).`);
    }
    if (!this.teamService) {
        throw new Error(`TeamService not available in PipelineExecutor for step ${step.id}.`);
    }
    this.logger.warn('PipelineExecutor', `Executing team step: ${step.team} - (Assumed Placeholder Implementation)`, { 
        stepId: step.id, 
        inputs: Object.keys(inputs) 
    });
    // Placeholder: In a real implementation, you would fetch and run the team.
    // const teamInstance = await this.teamService.get(step.team);
    // if (!teamInstance) {
    //     throw new Error(`Team named "${step.team}" not found for step ${step.id}.`);
    // }
    // const teamRunResult = await teamInstance.run(inputs); // Inputs need to be shaped for the team
    // return teamRunResult;
    this.logger.info('PipelineExecutor', `Placeholder: Team step ${step.team} would run here.`);
    return { success: true, result: { message: `Team ${step.team} executed with inputs: ${JSON.stringify(inputs)}` }, error: undefined };
  }

  private async executeConditionStep(step: PipelineStepDefinition, inputs: Record<string, any>): Promise<any> {
    if (!step.condition) {
      throw new Error(`Condition step ${step.id} missing condition specification`);
    }

    this.logger.info('PipelineExecutor', `Executing condition step`, {
      stepId: step.id,
      expression: step.condition.expression
    });

    // Simple condition evaluation (in production, use a proper expression evaluator)
    const conditionResult = await this.evaluateCondition(step.condition.expression, inputs);
    
    return {
      condition: step.condition.expression,
      result: conditionResult,
      nextStep: conditionResult ? step.condition.ifTrue : step.condition.ifFalse
    };
  }

  private async executeTransformStep(step: PipelineStepDefinition, inputs: Record<string, any>): Promise<any> {
    if (!step.transform) {
      throw new Error(`Transform step ${step.id} missing transform specification`);
    }

    this.logger.info('PipelineExecutor', `Executing transform step`, {
      stepId: step.id,
      input: step.transform.input,
      output: step.transform.output
    });

    const inputValue = inputs[step.transform.input];
    const transformedValue = await this.applyTransformation(step.transform.transformation, inputValue);
    
    return {
      [step.transform.output]: transformedValue
    };
  }

  private async executeParallelStep(step: PipelineStepDefinition, _inputs: Record<string, any>): Promise<any> {
    if (!step.parallel) {
      throw new Error(`Parallel step ${step.id} missing parallel specification`);
    }

    this.logger.info('PipelineExecutor', `Executing parallel step`, {
      stepId: step.id,
      parallelSteps: step.parallel.steps.length,
      waitForAll: step.parallel.waitForAll
    });

    // TODO: Implement parallel execution of sub-steps
    // For now, return a placeholder
    return {
      parallelResults: step.parallel.steps.map(stepId => ({ stepId, status: 'pending' }))
    };
  }

  private async executeWaitStep(step: PipelineStepDefinition, _inputs: Record<string, any>): Promise<any> {
    if (!step.wait) {
      throw new Error(`Wait step ${step.id} missing wait specification`);
    }

    this.logger.info('PipelineExecutor', `Executing wait step`, {
      stepId: step.id,
      duration: step.wait.duration
    });

    await this.wait(step.wait.duration);
    
    return {
      waited: step.wait.duration,
      timestamp: Date.now()
    };
  }

  private async resolveInputs(inputSpec: Record<string, string>): Promise<Record<string, any>> {
    const resolved: Record<string, any> = {};

    for (const [key, expression] of Object.entries(inputSpec)) {
      // Simple variable resolution (in production, use a proper expression evaluator)
      if (expression.startsWith('$')) {
        const varName = expression.substring(1);
        resolved[key] = this.context.variables.get(varName);
      } else if (expression.startsWith('@')) {
        // Reference to step output
        const stepId = expression.substring(1);
        const stepResult = this.context.stepResults.get(stepId);
        resolved[key] = stepResult?.result;
      } else {
        // Literal value
        resolved[key] = expression;
      }
    }

    return resolved;
  }

  private getNestedValue(obj: any, path: string): any {
    if (!path) return obj;
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current === null || typeof current !== 'object') return undefined;
        // Handle array indexing like path[0].property
        const R = /^(.*)\[(\d+)\]$/;
        const match = key.match(R);
        if (match) {
            const R_key = match[1];
            const R_index = parseInt(match[2], 10);
            if (R_key) { // Access property then index
                 current = current[R_key];
                 if (!Array.isArray(current) || R_index >= current.length) return undefined;
                 current = current[R_index];
            } else { // Direct array index like [0]
                 if (!Array.isArray(current) || R_index >= current.length) return undefined;
                 current = current[R_index];
            }
        } else {
            current = current[key];
        }
        if (current === undefined) return undefined;
    }
    return current;
  }

  private async processOutputs(outputSpec: Record<string, string>, stepExecutionResult: any): Promise<Record<string, any>> {
    const outputs: Record<string, any> = {};
    // stepExecutionResult is the raw result from the step execution (e.g., from tool.handler or agent.run())

    for (const [key, expression] of Object.entries(outputSpec)) {
      if (expression === '.') {
        outputs[key] = stepExecutionResult;
      } else if (expression.startsWith('.')) {
        // The expression is relative to the core 'result' part of an agent/tool execution if applicable
        // For agent steps, result.result is the agent's output object.
        // For tool steps, result.result is the tool's output object.
        const baseObject = stepExecutionResult?.result || stepExecutionResult; 
        outputs[key] = this.getNestedValue(baseObject, expression.substring(1));
      } else {
        // If not starting with '.', it's treated as a literal string or a complex expression (not supported yet)
        // For now, assume it might be a direct key in the result if not a path
        outputs[key] = this.getNestedValue(stepExecutionResult, expression); 
      }
    }
    this.logger.debug('PipelineExecutor', `Processed outputs for step:`, { outputSpec, stepExecutionResult, generatedOutputs: outputs });
    return outputs;
  }

  private async checkDependencies(dependencies: string[]): Promise<boolean> {
    for (const dep of dependencies) {
      const stepResult = this.context.stepResults.get(dep);
      if (!stepResult || !stepResult.success) {
        return false;
      }
    }
    return true;
  }

  private async evaluateCondition(expression: string, inputs: Record<string, any>): Promise<boolean> {
    // Simple condition evaluation - in production, use a proper expression evaluator
    try {
      // Replace variables in expression
      let evalExpression = expression;
      for (const [key, value] of Object.entries(inputs)) {
        evalExpression = evalExpression.replace(new RegExp(`\\$${key}`, 'g'), JSON.stringify(value));
      }
      
      // For safety, only allow simple comparisons
      if (/^[^;]*$/.test(evalExpression) && !/function|eval|require/.test(evalExpression)) {
        return eval(evalExpression);
      }
      
      return false;
    } catch {
      return false;
    }
  }

  private async applyTransformation(transformation: string, value: any): Promise<any> {
    // Simple transformations - in production, use a proper transformation engine
    switch (transformation) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'json_parse':
        return JSON.parse(String(value));
      case 'json_stringify':
        return JSON.stringify(value);
      case 'number':
        return Number(value);
      case 'string':
        return String(value);
      default:
        return value;
    }
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateSuccessRate(): number {
    const results = Array.from(this.context.stepResults.values());
    if (results.length === 0) return 1;
    
    const successCount = results.filter(r => r.success).length;
    return successCount / results.length;
  }

  private extractPipelineOutput(): any {
    // Extract final outputs based on pipeline definition
    const results = Array.from(this.context.stepResults.values());
    const lastResult = results[results.length - 1];
    
    return {
      finalResult: lastResult?.result,
      allStepResults: results.map(r => ({
        stepId: r.stepId,
        success: r.success,
        result: r.result,
        duration: r.duration
      })),
      variables: Object.fromEntries(this.context.variables),
      metadata: this.context.metadata
    };
  }

  private serializeContext(): any {
    return {
      pipelineId: this.context.pipelineId,
      executionId: this.context.executionId,
      variableCount: this.context.variables.size,
      stepCount: this.context.stepResults.size,
      metadata: this.context.metadata
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 12);
  }

  getPerformanceProfile(): PipelinePerformanceProfile | undefined {
    return this.intelligence.getPerformanceProfile(this.pipelineId);
  }

  getOptimizationRecommendations(): OptimizationRecommendation[] {
    return this.intelligence.getOptimizationRecommendations(this.pipelineId);
  }

  getCircuitBreakerStatus(stepId: string): any {
    const stepKey = `${this.pipelineId}_${stepId}`;
    return this.intelligence.getCircuitBreakerStatus(stepKey);
  }

  resetCircuitBreaker(stepId: string): void {
    const stepKey = `${this.pipelineId}_${stepId}`;
    this.intelligence.resetCircuitBreaker(stepKey);
  }

  getIntelligenceHealth(): any {
    return this.intelligence.getHealthMetrics();
  }

  getPipelineStatus(): any {
    const baseStatus = {
      pipelineId: this.pipelineId,
      name: this.definition.name,
      status: this.status,
      progress: {
        currentStep: this.context.metadata.currentStep,
        totalSteps: this.context.metadata.totalSteps,
        percentage: (this.context.metadata.currentStep / this.context.metadata.totalSteps) * 100
      },
      stepResults: Array.from(this.context.stepResults.values()),
      errorHistory: this.context.metadata.errorHistory,
      activeSteps: this.activeSteps.size
    };

    // Add intelligence insights if available
    const performanceProfile = this.intelligence.getPerformanceProfile(this.pipelineId);
    const optimizationRecommendations = this.intelligence.getOptimizationRecommendations(this.pipelineId);
    const intelligenceHealth = this.intelligence.getHealthMetrics();

    return {
      ...baseStatus,
      intelligence: {
        performanceProfile: performanceProfile ? {
          totalDuration: performanceProfile.totalDuration,
          bottleneckCount: performanceProfile.bottlenecks.length,
          trends: performanceProfile.trends,
          estimatedImprovement: performanceProfile.optimization.estimatedImprovement
        } : undefined,
        optimizationRecommendations: optimizationRecommendations.slice(0, 5), // Top 5 recommendations
        health: intelligenceHealth,
        circuitBreakers: this.definition.steps.map(step => ({
          stepId: step.id,
          status: this.intelligence.getCircuitBreakerStatus(`${this.pipelineId}_${step.id}`)
        })).filter(cb => cb.status)
      }
    };
  }
} 