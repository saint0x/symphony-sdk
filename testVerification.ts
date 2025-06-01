import { ToolUsageVerifier, ParameterSchema, ToolSchema, VerificationResult } from './src/utils/verification';
import * as assert from 'assert';

const logger = {
  log: (message: string, ...args: any[]) => console.log(`[TEST_LOG] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[TEST_ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[TEST_WARN] ${message}`, ...args),
};

async function runVerificationTests() {
  logger.log('=== TEST: ToolUsageVerifier Logic ===');

  // Test Suite 1: verifyData
  logger.log('\n--- Test Suite 1: verifyData ---');

  const simpleSchema: { [key: string]: ParameterSchema } = {
    name: { type: 'string', required: true, minLength: 3 },
    age: { type: 'number', required: false },
    isActive: { type: 'boolean' },
    meta: {
      type: 'object',
      objectSchema: {
        role: { type: 'string', pattern: /^(admin|user|guest)$/ },
        lastLogin: { type: 'number' }
      }
    },
    tags: { type: 'array', arrayItemSchema: { type: 'string', minLength: 2 } }
  };

  // Test Case 1.1: Valid data
  let data1 = { name: 'Alice', age: 30, isActive: true, meta: { role: 'admin', lastLogin: 123 }, tags: ['dev', 'test'] };
  let result1 = ToolUsageVerifier.verifyData(data1, simpleSchema);
  assert.strictEqual(result1.isValid, true, 'Test Case 1.1 FAILED: Valid data');
  assert.strictEqual(result1.errors.length, 0, 'Test Case 1.1 FAILED: Errors found for valid data');
  logger.log('Test Case 1.1 PASSED: Valid data');

  // Test Case 1.2: Missing required field
  let data2 = { age: 25 };
  let result2 = ToolUsageVerifier.verifyData(data2, simpleSchema);
  assert.strictEqual(result2.isValid, false, 'Test Case 1.2 FAILED: Missing required field (isValid)');
  assert.ok(result2.errors.some(e => e.path === 'name' && e.message.includes('required')), 'Test Case 1.2 FAILED: Missing required field (error message)');
  logger.log('Test Case 1.2 PASSED: Missing required field');

  // Test Case 1.3: Invalid type
  let data3 = { name: 'Bob', age: 'twenty' }; // age should be number
  let result3 = ToolUsageVerifier.verifyData(data3, simpleSchema);
  assert.strictEqual(result3.isValid, false, 'Test Case 1.3 FAILED: Invalid type (isValid)');
  assert.ok(result3.errors.some(e => e.path === 'age' && e.message.includes('Invalid type')), 'Test Case 1.3 FAILED: Invalid type (error message)');
  logger.log('Test Case 1.3 PASSED: Invalid type');

  // Test Case 1.4: String minLength violation
  let data4 = { name: 'Al' };
  let result4 = ToolUsageVerifier.verifyData(data4, simpleSchema);
  assert.strictEqual(result4.isValid, false, 'Test Case 1.4 FAILED: String minLength (isValid)');
  assert.ok(result4.errors.some(e => e.path === 'name' && e.message.includes('too short')), 'Test Case 1.4 FAILED: String minLength (error message)');
  logger.log('Test Case 1.4 PASSED: String minLength violation');

  // Test Case 1.5: Nested object pattern violation
  let data5 = { name: 'Charlie', meta: { role: 'superadmin' } }; // role pattern mismatch
  let result5 = ToolUsageVerifier.verifyData(data5, simpleSchema);
  assert.strictEqual(result5.isValid, false, 'Test Case 1.5 FAILED: Nested object pattern (isValid)');
  assert.ok(result5.errors.some(e => e.path === 'meta.role' && e.message.includes('does not match pattern')), 'Test Case 1.5 FAILED: Nested object pattern (error message)');
  logger.log('Test Case 1.5 PASSED: Nested object pattern violation');

  // Test Case 1.6: Array item schema violation
  let data6 = { name: 'Dave', tags: ['a', 'b'] }; // tag 'a' is too short
  let result6 = ToolUsageVerifier.verifyData(data6, simpleSchema);
  assert.strictEqual(result6.isValid, false, 'Test Case 1.6 FAILED: Array item schema (isValid)');
  assert.ok(result6.errors.some(e => e.path === 'tags[0]' && e.message.includes('too short')), 'Test Case 1.6 FAILED: Array item schema (error message for tags[0])');
  logger.log('Test Case 1.6 PASSED: Array item schema violation');

  // Test Suite 2: verifyTeamTaskOverallSuccess (Basic Cases)
  logger.log('\n--- Test Suite 2: verifyTeamTaskOverallSuccess (Basic Cases) ---');

  // Test Case 2.1: Parallel success (some succeed)
  let parallelResult1 = { individualResults: [{ success: true }, { success: false }, { result: { success: true } }] };
  let overall1 = ToolUsageVerifier.verifyTeamTaskOverallSuccess(parallelResult1, 'parallel');
  assert.strictEqual(overall1.overallSuccess, true, 'Test Case 2.1 FAILED: Parallel success (some succeed)');
  assert.strictEqual(overall1.derivedMetrics?.successfulAgentTasks, 2, 'Test Case 2.1 FAILED: Parallel success count');
  logger.log('Test Case 2.1 PASSED: Parallel success (some succeed)');

  // Test Case 2.2: Parallel failure (all fail)
  let parallelResult2 = { individualResults: [{ success: false, error: 'e1' }, { result: { success: false, error: 'e2' } }] };
  let overall2 = ToolUsageVerifier.verifyTeamTaskOverallSuccess(parallelResult2, 'parallel');
  assert.strictEqual(overall2.overallSuccess, false, 'Test Case 2.2 FAILED: Parallel failure (all fail)');
  assert.ok(overall2.reason?.includes('All 2 participating agents failed'), 'Test Case 2.2 FAILED: Parallel failure reason');
  logger.log('Test Case 2.2 PASSED: Parallel failure (all fail)');

  // Test Case 2.3: Sequential success (all succeed)
  let sequentialResult1 = { individualResults: [{ success: true }, { result: { success: true } }] };
  let overall3 = ToolUsageVerifier.verifyTeamTaskOverallSuccess(sequentialResult1, 'sequential');
  assert.strictEqual(overall3.overallSuccess, true, 'Test Case 2.3 FAILED: Sequential success');
  assert.ok(overall3.reason?.includes('All agents in sequential succeeded'), 'Test Case 2.3 FAILED: Sequential success reason');
  logger.log('Test Case 2.3 PASSED: Sequential success');

  // Test Case 2.4: Sequential failure (one fails)
  let sequentialResult2 = { individualResults: [{ success: true }, { success: false, error: 'early exit' }] };
  let overall4 = ToolUsageVerifier.verifyTeamTaskOverallSuccess(sequentialResult2, 'sequential');
  assert.strictEqual(overall4.overallSuccess, false, 'Test Case 2.4 FAILED: Sequential failure');
  assert.ok(overall4.reason?.includes('agent(s) failed, breaking the sequential'), 'Test Case 2.4 FAILED: Sequential failure reason');
  logger.log('Test Case 2.4 PASSED: Sequential failure');
  
  // Test Case 2.5: Pipeline success
  let pipelineResult1 = { pipelineResults: [ { result: { success: true } }, { result: { success: true } } ] };
  let overall5 = ToolUsageVerifier.verifyTeamTaskOverallSuccess(pipelineResult1, 'pipeline');
  assert.strictEqual(overall5.overallSuccess, true, 'Test Case 2.5 FAILED: Pipeline success');
  logger.log('Test Case 2.5 PASSED: Pipeline success');

  // Test Case 2.6: Pipeline failure
  let pipelineResult2 = { pipelineResults: [ { result: { success: true } }, { error: 'pipeline break' } ] };
  let overall6 = ToolUsageVerifier.verifyTeamTaskOverallSuccess(pipelineResult2, 'pipeline');
  assert.strictEqual(overall6.overallSuccess, false, 'Test Case 2.6 FAILED: Pipeline failure');
  logger.log('Test Case 2.6 PASSED: Pipeline failure');

  // Test Case 2.7: Collaborative success (manager ok, some contributions ok)
  let collabResult1 = { managerAnalysis: { success: true }, individualContributions: [{ success: true }, { success: false }] };
  let overall7 = ToolUsageVerifier.verifyTeamTaskOverallSuccess(collabResult1, 'collaborative');
  assert.strictEqual(overall7.overallSuccess, true, 'Test Case 2.7 FAILED: Collaborative success (manager ok, some contrib ok)');
  logger.log('Test Case 2.7 PASSED: Collaborative success (manager ok, some contrib ok)');

  // Test Case 2.8: Collaborative failure (manager fails)
  let collabResult2 = { managerAnalysis: { success: false, error: 'manager error' } };
  let overall8 = ToolUsageVerifier.verifyTeamTaskOverallSuccess(collabResult2, 'collaborative');
  assert.strictEqual(overall8.overallSuccess, false, 'Test Case 2.8 FAILED: Collaborative failure (manager fails)');
  logger.log('Test Case 2.8 PASSED: Collaborative failure (manager fails)');

  // Test Case 2.9: Collaborative success (manager ok, no contributions needed/made)
  let collabResult3 = { managerAnalysis: { success: true }, individualContributions: [] };
  let overall9 = ToolUsageVerifier.verifyTeamTaskOverallSuccess(collabResult3, 'collaborative');
  assert.strictEqual(overall9.overallSuccess, true, 'Test Case 2.9 FAILED: Collaborative success (manager ok, no contrib)');
  logger.log('Test Case 2.9 PASSED: Collaborative success (manager ok, no contrib)');

  // Test Case 2.10: Role-based success
  let roleBasedResult1 = { result: { success: true } };
  let overall10 = ToolUsageVerifier.verifyTeamTaskOverallSuccess(roleBasedResult1, 'role_based');
  assert.strictEqual(overall10.overallSuccess, true, 'Test Case 2.10 FAILED: Role-based success');
  assert.strictEqual(overall10.derivedMetrics?.successfulAgentTasks, 1, 'Test Case 2.10 FAILED: Role-based success metrics');
  logger.log('Test Case 2.10 PASSED: Role-based success');

  // Test Case 2.11: Role-based failure
  let roleBasedResult2 = { result: { success: false, error: 'role agent failed' } };
  let overall11 = ToolUsageVerifier.verifyTeamTaskOverallSuccess(roleBasedResult2, 'role_based');
  assert.strictEqual(overall11.overallSuccess, false, 'Test Case 2.11 FAILED: Role-based failure');
  assert.strictEqual(overall11.derivedMetrics?.failedAgentTasks, 1, 'Test Case 2.11 FAILED: Role-based failure metrics');
  logger.log('Test Case 2.11 PASSED: Role-based failure');

  // Test Case 2.12: Unknown strategy
  let unknownResult = { individualResults: [] }; // Content doesn't matter for this case
  let overall12 = ToolUsageVerifier.verifyTeamTaskOverallSuccess(unknownResult, 'unknown_strategy_type');
  assert.strictEqual(overall12.overallSuccess, false, 'Test Case 2.12 FAILED: Unknown strategy');
  assert.ok(overall12.reason?.includes('Unknown strategy: unknown_strategy_type'), 'Test Case 2.12 FAILED: Unknown strategy reason');
  logger.log('Test Case 2.12 PASSED: Unknown strategy');

  // Test Case 2.13: Malformed strategy result (e.g., missing individualResults for parallel)
  let malformedParallel = { somethingElse: [] };
  let overall13 = ToolUsageVerifier.verifyTeamTaskOverallSuccess(malformedParallel, 'parallel');
  assert.strictEqual(overall13.overallSuccess, false, 'Test Case 2.13 FAILED: Malformed parallel (isValid)');
  assert.ok(overall13.reason?.includes('Malformed strategy result: individualResults is not an array or is missing'), 'Test Case 2.13 FAILED: Malformed parallel (reason)');
  logger.log('Test Case 2.13 PASSED: Malformed parallel result');

  logger.log('\n🎉🎉🎉 ToolUsageVerifier Tests PASSED! 🎉🎉🎉');
  process.exitCode = 0;

} 

runVerificationTests().catch(err => {
  logger.error('Test script encountered an error:', err.message);
  if (err.stack) logger.error('Stack:', err.stack);
  process.exitCode = 1;
}).finally(() => {
    if (process.exitCode === 0) {
        setTimeout(() => process.exit(0), 500);
    } else {
        setTimeout(() => process.exit(process.exitCode || 1), 500);
    }
}); 