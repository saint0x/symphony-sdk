// testPersistNlpOnInit.ts
import { Symphony } from './src/symphony';
import { SymphonyConfig } from './src/types/symphony';
import { ToolConfig, NlpPatternDefinition } from './src/types/tool.types';
const fs = require('fs/promises');
const path = require('path');
const assert = require('assert');

// Define types for stricter checking
interface SymphonyInstance {
  initialize: () => Promise<void>;
  state: string;
  tool: any;
  nlp: any;
  db: any; 
}

// Helper to check if a string exists in the DB
async function checkNlpPatternInDb(symphonyInstance: SymphonyInstance, toolName: string, nlpPattern: string): Promise<boolean> {
    console.log(`[ISOLATED_TEST_DB_CHECK] Checking for Tool: ${toolName}, Pattern: "${nlpPattern}"`);
    try {
        const patterns = await symphonyInstance.nlp.getNlpPatternsByTool(toolName);
        const found = patterns.some((p: any) => p.nlpPattern === nlpPattern && p.isActive);
        console.log(`[ISOLATED_TEST_DB_CHECK] Result for Tool: ${toolName}, Pattern: "${nlpPattern}", Found: ${found}`);
        return found;
    } catch (e: any) {
        console.warn(`[ISOLATED_TEST_DB_CHECK] ⚠️  Could not verify pattern in DB for ${toolName} due to: ${(e as Error).message}`);
        return false; 
    }
}

async function runIsolatedTest() {
  console.log('\n=== ISOLATED TEST: persistNlpOnInit ===');
  
  const sdkConfig: SymphonyConfig = {
    name: 'TestSDK_persistNlpOnInit_Isolated',
    db: {
        adapter: 'sqlite',
        path: './symphony.db' // Uses the same DB
    },
    logging: { level: 'debug' }, // More verbose logging from SDK
    serviceRegistry: {
        enabled: false,
        maxRetries: 3,
        retryDelay: 1000
    },
    metrics: {
        enabled: true,
        detailed: false
    }
  };

  const sym: SymphonyInstance = new Symphony(sdkConfig);

  try {
    console.log(`[ISOLATED_TEST] Initializing SDK with config:`, JSON.stringify(sdkConfig, null, 0));
    await sym.initialize();
    console.log(`[ISOLATED_TEST] SDK initialized. State: ${sym.state}`);
    assert.strictEqual(sym.state, 'READY', `[ISOLATED_TEST] SDK not in READY state. State: ${sym.state}`);

    const nlpToolPersistName = 'nlpToolPersistTS_Isolated';
    const nlpToolPersistPattern = `isolated test pattern for {subject} persist ${Date.now()}`;
    
    console.log(`[ISOLATED_TEST] --- Attempting to create tool '${nlpToolPersistName}' ---`);
    console.log(`[ISOLATED_TEST] Pattern to be explicitly persisted: "${nlpToolPersistPattern}"`);

    await sym.tool.create({
      name: nlpToolPersistName,
      description: 'Isolated Test Tool with NLP, explicit persistence (true)',
      nlp: nlpToolPersistPattern,
      handler: async (params: any) => ({ success: true, result: `Images of ${params.subject} found (Isolated Test).` })
    });
    console.log(`[ISOLATED_TEST] Tool '${nlpToolPersistName}' creation call completed.`);

    console.log(`[ISOLATED_TEST] --- Explicitly persisting NLP pattern for '${nlpToolPersistName}' ---`);
    await sym.nlp.ensurePatternPersisted({
        toolName: nlpToolPersistName,
        nlpPattern: nlpToolPersistPattern,
        source: 'test_script_explicit_persist'
    });
    console.log(`[ISOLATED_TEST] Explicit persistence call for '${nlpToolPersistName}' completed.`);
    
    console.log('[ISOLATED_TEST] Waiting 300ms for potential DB write to settle...');
    await new Promise(resolve => setTimeout(resolve, 300)); 

    console.log(`[ISOLATED_TEST] Checking database for pattern of tool '${nlpToolPersistName}'...`);
    let isInDbPersist = await checkNlpPatternInDb(sym, nlpToolPersistName, nlpToolPersistPattern);
    
    assert.strictEqual(isInDbPersist, true, `[ISOLATED_TEST] ❌ ERROR: Pattern for '${nlpToolPersistName}' (explicit persist) NOT found in DB.`);
    console.log(`[ISOLATED_TEST] ✅ Pattern for '${nlpToolPersistName}' correctly FOUND in DB.`);
    
    console.log('\n🎉🎉🎉 ISOLATED persistNlpOnInit TEST PASSED! 🎉🎉🎉');
    process.exitCode = 0;
    
  } catch (error: any) {
    console.error('\n❌ ISOLATED persistNlpOnInit TEST FAILED:', (error as Error).message);
    if ((error as Error).stack) console.error('Stack:', (error as Error).stack);
    process.exitCode = 1; 
  } finally {
    console.log("--- ISOLATED Test Script Finalizing ---");
    // Added timeout to allow logs to flush before exiting, bun can be very fast.
    if (process.exitCode === 0) {
        console.log('🔚 ISOLATED Test script finished successfully. Exiting with code 0.');
        setTimeout(() => process.exit(0), 500);
    } else {
        console.error(`🔚 ISOLATED Test script finished with errors. Exiting with code ${process.exitCode || 1}.`);
        setTimeout(() => process.exit(process.exitCode || 1), 500);
    }
  }
}

// Handle exit signals gracefully
function handleExitSignals(signal: string) {
  console.log(`\n🛑 ISOLATED Test received ${signal}. Exiting...`);
  process.exit(signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1); 
}
process.on('SIGINT', () => handleExitSignals('SIGINT'));
process.on('SIGTERM', () => handleExitSignals('SIGTERM'));

process.on('uncaughtException', (error: Error, origin: string) => {
  console.error('🚨🚨🚨 ISOLATED UNCAUGHT EXCEPTION! 🚨🚨🚨');
  console.error('Origin:', origin);
  console.error('Error:', error);
  process.exitCode = 1;
  process.exit(1); // Force exit
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('🚨🚨🚨 ISOLATED UNHANDLED PROMISE REJECTION! 🚨🚨🚨');
  console.error('Reason:', reason);
  process.exitCode = 1;
  process.exit(1); // Force exit
});

runIsolatedTest(); 