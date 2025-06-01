import { Logger } from './logger';

// Define a basic structure for schema definitions
// For more robust validation, consider libraries like Zod in the future.
export interface ParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  required?: boolean;
  minLength?: number; // For strings
  maxLength?: number; // For strings
  pattern?: RegExp; // For strings
  objectSchema?: { [key: string]: ParameterSchema }; // For nested objects
  arrayItemSchema?: ParameterSchema; // For arrays of a specific type
}

// Schema for a tool's input and output
export interface ToolSchema {
  input: { [paramName: string]: ParameterSchema };
  output?: { [paramName: string]: ParameterSchema };
}

export interface VerificationError {
  path: string; // e.g., 'taskPayload.title' or 'agentResults[0].output'
  message: string;
  expected?: any;
  received?: any;
}

export interface VerificationResult {
  isValid: boolean;
  errors: VerificationError[];
}

export class ToolUsageVerifier {
  private static readonly logger = Logger.getInstance('ToolUsageVerifier');

  /**
   * Verifies data against a given parameter schema.
   * @param data The data object to verify.
   * @param schema The schema to verify against, mapping keys to ParameterSchema.
   * @param parentPath The base path for error reporting (used in recursion).
   * @returns VerificationResult indicating if data is valid and any errors.
   */
  static verifyData(
    data: any,
    schema: { [key: string]: ParameterSchema },
    parentPath: string = ''
  ): VerificationResult {
    const errors: VerificationError[] = [];

    for (const key in schema) {
      if (!schema.hasOwnProperty(key)) continue;

      const paramSchema = schema[key];
      const value = data ? data[key] : undefined;
      const currentPath = parentPath ? `${parentPath}.${key}` : key;

      if (paramSchema.required && value === undefined) {
        errors.push({
          path: currentPath,
          message: `Parameter is required.`,
          received: 'undefined'
        });
        continue;
      }

      if (!paramSchema.required && value === undefined) {
        continue;
      }

      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (paramSchema.type !== 'any' && actualType !== paramSchema.type) {
        errors.push({
          path: currentPath,
          message: `Invalid type. Expected ${paramSchema.type} but received ${actualType}.`,
          expected: paramSchema.type,
          received: actualType
        });
        continue;
      }

      if (paramSchema.type === 'string') {
        if (typeof value === 'string') { // Ensure value is string before accessing length/test
            if (paramSchema.minLength !== undefined && value.length < paramSchema.minLength) {
            errors.push({ path: currentPath, message: `String is too short. Minimum length: ${paramSchema.minLength}.`, received: value.length });
            }
            if (paramSchema.maxLength !== undefined && value.length > paramSchema.maxLength) {
            errors.push({ path: currentPath, message: `String is too long. Maximum length: ${paramSchema.maxLength}.`, received: value.length });
            }
            if (paramSchema.pattern && !paramSchema.pattern.test(value)) {
            errors.push({ path: currentPath, message: `String does not match pattern: ${paramSchema.pattern}.`, received: value });
            }
        } else if (paramSchema.required) { // Already caught by type check if type is string, but as safeguard
            errors.push({ path: currentPath, message: `Expected a string but received ${actualType}.`, expected: 'string', received: actualType });
        }
      }

      if (paramSchema.type === 'object' && paramSchema.objectSchema && value) {
        const nestedResult = this.verifyData(value, paramSchema.objectSchema, currentPath);
        if (!nestedResult.isValid) {
          errors.push(...nestedResult.errors);
        }
      }

      if (paramSchema.type === 'array' && paramSchema.arrayItemSchema && Array.isArray(value)) {
        value.forEach((item, index) => {
          // Create a temporary schema and data structure to reuse verifyData for the item
          const itemWrapperSchema = { item: paramSchema.arrayItemSchema! };
          const itemWrapperData = { item: item };
          const itemPathPrefix = `${currentPath}[${index}]`;
          
          const itemResult = this.verifyData(itemWrapperData, itemWrapperSchema, itemPathPrefix);
          if (!itemResult.isValid) {
            // Adjust paths from "array[0].item.property" to "array[0].property" 
            // or "array[0].item" to "array[0]"
            itemResult.errors.forEach(err => {
              const escapedPrefix = this.escapeRegExp(itemPathPrefix);
              const regexPattern = `^${escapedPrefix}\\.item`;
              errors.push({ ...err, path: err.path.replace(new RegExp(regexPattern), itemPathPrefix) });
            });
          }
        });
      }
    }
    return { isValid: errors.length === 0, errors };
  }

  // Helper to escape regex special characters for path replacement
  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }


  /**
   * Verifies the overall success of a team task based on agent results and strategy.
   * This is crucial for addressing the "false positive success" scenario.
   * @param strategyResult The result object from a specific strategy execution method (e.g., executeParallel).
   * @param strategyName The name of the strategy used (e.g., 'parallel', 'collaborative').
   * @returns An object indicating overallSuccess, a reason, and any derivedMetrics.
   */
  static verifyTeamTaskOverallSuccess(
    strategyResult: any,
    strategyName: string
  ): { overallSuccess: boolean; reason?: string; derivedMetrics?: any } {
    if (!strategyResult) {
      return { overallSuccess: false, reason: "Strategy result data is missing or undefined." };
    }

    let individualAgentResults: any[] = [];

    switch (strategyName) {
      case 'parallel':
      case 'sequential':
        if (!strategyResult.hasOwnProperty('individualResults') || !Array.isArray(strategyResult.individualResults)) {
          return { overallSuccess: false, reason: "Malformed strategy result: individualResults is not an array or is missing." };
        }
        individualAgentResults = strategyResult.individualResults;
        break;
      
      case 'pipeline':
        if (!strategyResult.hasOwnProperty('pipelineResults') || !Array.isArray(strategyResult.pipelineResults)) {
          return { overallSuccess: false, reason: "Malformed strategy result: pipelineResults is not an array or is missing." };
        }
        individualAgentResults = strategyResult.pipelineResults;
        break;

      case 'collaborative':
        const managerAnalysis = strategyResult.managerAnalysis;
        if (!managerAnalysis || managerAnalysis.success === false || managerAnalysis.error || (managerAnalysis.result && managerAnalysis.result.success === false)) {
          return {
            overallSuccess: false,
            reason: `Manager agent failed during analysis/delegation: ${managerAnalysis?.error || managerAnalysis?.result?.error || 'Unknown manager error'}`
          };
        }
        if (!strategyResult.hasOwnProperty('individualContributions') || !Array.isArray(strategyResult.individualContributions)) {
          return { overallSuccess: false, reason: "Malformed strategy result: individualContributions is not an array or is missing." };
        }
        individualAgentResults = strategyResult.individualContributions;
        break;

      case 'role_based':
        ToolUsageVerifier.logger.debug('Verification', 'Verifying role_based strategy', { strategyResult }); // DEBUG LOG
        if (!strategyResult.result) {
            ToolUsageVerifier.logger.warn('Verification', 'Agent result missing in role_based strategy for verification.');
            return { overallSuccess: false, reason: "Agent result missing in role_based strategy." };
        }
        const agentSucceeded = strategyResult.result.success === true && !strategyResult.result.error;
        ToolUsageVerifier.logger.debug('Verification', 'Role_based agentSucceeded:', { agentSucceeded, agentSuccess: strategyResult.result.success, agentError: strategyResult.result.error }); // DEBUG LOG
        return {
          overallSuccess: agentSucceeded,
          reason: agentSucceeded ? "Role-based agent task successful." : `Role-based agent task failed: ${strategyResult.result.error || 'Unknown error'}`,
          derivedMetrics: { agentCalls: 1, successfulAgentTasks: agentSucceeded ? 1: 0, failedAgentTasks: agentSucceeded ? 0: 1}
        };

      default:
        ToolUsageVerifier.logger.warn('ToolUsageVerifier', `Unknown strategy name "${strategyName}" for overall success verification.`);
        return { overallSuccess: false, reason: `Unknown strategy: ${strategyName}` };
    }

    if (individualAgentResults.length === 0) {
        if (strategyName === 'collaborative') { 
             return { overallSuccess: true, reason: "Manager analysis/execution succeeded, and no further sub-tasks were created, delegated, or required action."};
        }
        return { overallSuccess: false, reason: `No agent tasks were executed or recorded for ${strategyName} strategy.` };
    }

    let successfulAgentTasks = 0;
    let failedAgentTasks = 0;
    const totalAgentTasks = individualAgentResults.length;

    for (const res of individualAgentResults) {
      let agentTaskSuccessful = false;
      let agentTaskError = null;

      if (strategyName === 'pipeline') { 
          agentTaskSuccessful = res.result?.success === true && !res.error; 
          agentTaskError = res.error || res.result?.error;
      } else { 
          agentTaskSuccessful = (res.result?.success === true && !res.result?.error) || (res.success === true && !res.error);
          agentTaskError = res.result?.error || res.error;
      }
      
      if (agentTaskSuccessful) {
        successfulAgentTasks++;
      } else {
        failedAgentTasks++;
        ToolUsageVerifier.logger.warn('ToolUsageVerifier', `Agent task failed within ${strategyName} strategy. Agent: ${res.agent || 'Unknown'}, Error: ${JSON.stringify(agentTaskError)}`, { agentResult: res });
      }
    }
    
    const metrics = { totalAgentTasks, successfulAgentTasks, failedAgentTasks };

    switch (strategyName) {
      case 'parallel':
        if (successfulAgentTasks > 0) return { overallSuccess: true, reason: `${successfulAgentTasks}/${totalAgentTasks} agents succeeded in parallel execution.`, derivedMetrics: metrics };
        return { overallSuccess: false, reason: `All ${totalAgentTasks} participating agents failed in parallel execution.`, derivedMetrics: metrics };

      case 'sequential':
      case 'pipeline':
        if (failedAgentTasks > 0) return { overallSuccess: false, reason: `${failedAgentTasks}/${totalAgentTasks} agent(s) failed, breaking the ${strategyName}.`, derivedMetrics: metrics };
        if (totalAgentTasks > 0 && successfulAgentTasks === totalAgentTasks) return { overallSuccess: true, reason: `All agents in ${strategyName} succeeded.`, derivedMetrics: metrics };
        return { overallSuccess: false, reason: `${strategyName} execution did not complete as expected (e.g., no successful agents or mixed results).`, derivedMetrics: metrics };
        
      case 'collaborative':
        if (totalAgentTasks > 0) {
            if (successfulAgentTasks > 0) return { overallSuccess: true, reason: `Manager succeeded, and ${successfulAgentTasks}/${totalAgentTasks} delegated/sub-tasks succeeded.`, derivedMetrics: metrics };
            return { overallSuccess: false, reason: `Manager succeeded, but all ${totalAgentTasks} delegated/sub-tasks failed.`, derivedMetrics: metrics };
        }
        return { overallSuccess: true, reason: "Manager succeeded, and no further sub-tasks required action or all were successful.", derivedMetrics: metrics };

      default:
        ToolUsageVerifier.logger.error('ToolUsageVerifier', `Reached unexpected default in final success aggregation for strategy: ${strategyName}`);
        return { overallSuccess: false, reason: `Unhandled strategy ${strategyName} in final success aggregation.`, derivedMetrics: metrics };
    }
  }
} 