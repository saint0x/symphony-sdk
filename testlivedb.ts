// testlivedb.ts
import { Symphony } from './src/symphony';
import { SymphonyConfig } from './src/types/symphony';
import { ToolConfig, NlpPatternDefinition } from './src/types/tool.types';
const fs = require('fs/promises');
const path = require('path');
const assert = require('assert'); // Using Node.js built-in assert for simple checks

// Define types for stricter checking, though not strictly necessary for Bun execution
interface SymphonyInstance {
  initialize: () => Promise<void>;
  state: string;
  tool: any;
  nlp: any;
  cache: any;
  memory: any;
  agent: any;
  db: any; // Add other services if used directly
}

// Helper to create a dummy NLP patterns file
async function createNlpSeedFile(filePath: string, patterns: any[]) {
  try {
    await fs.writeFile(filePath, JSON.stringify(patterns, null, 2));
    console.log(`📝 Dummy NLP seed file created at ${filePath}`);
  } catch (err: any) {
    console.error(`❌ Error creating dummy NLP seed file: ${err.message}`);
    throw err; 
  }
}

// Helper to check if a string exists in the DB
async function checkNlpPatternInDb(symphonyInstance: SymphonyInstance, toolName: string, nlpPattern: string): Promise<boolean> {
    try {
        const patterns = await symphonyInstance.nlp.getNlpPatternsByTool(toolName);
        const found = patterns.some((p: any) => p.nlpPattern === nlpPattern && p.isActive);
        console.log(`[DB Check] Tool: ${toolName}, Pattern: "${nlpPattern}", Found: ${found}`);
        return found;
    } catch (e: any) {
        console.warn(`⚠️  Could not verify pattern in DB for ${toolName} due to: ${e.message}`);
        return false; 
    }
}

async function testNlpCacheMemory() {
  console.log('\n=== NLP, Cache, Memory & Initialization System Test (TS Version) ===');
  
  const TIMEOUT_DURATION = 180000; // 3 minutes
  let testTimedOut = false;
  const testTimeoutId = setTimeout(() => {
    testTimedOut = true;
    console.error('\n⏰ Test timeout reached - forcing exit. This indicates a hang or very slow operation.');
    process.exitCode = 1; 
    process.exit(1); 
  }, TIMEOUT_DURATION);
  (global as any).testTimeoutId = testTimeoutId;

  const sdkConfig: SymphonyConfig = {
    name: 'TestSDKInstanceWithLiveDB_TS',
    db: {
        adapter: 'sqlite',
        path: './symphony.db' 
    },
    logging: { level: 'info' },
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
  const NLP_SEED_FILE = path.join(__dirname, `test_nlp_seed_ts_${Date.now()}.json`);

  try {
    console.log(`🚀 Starting TS test with LIVE DB: ${sdkConfig.db!.path}`);

    // Test 1: SDK Initialization
    console.log('\n--- Test 1: SDK Initialization ---');
    const initStart = Date.now();
    await sym.initialize();
    console.log(`✅ SDK initialized successfully in ${Date.now() - initStart}ms.`);
    assert.strictEqual(sym.state, 'READY', `SDK not in READY state. State: ${sym.state}`);

    // Test 2: Tool Creation with NLP
    console.log('\n--- Test 2: Tool Creation with NLP ---');
    const nlpToolDefaultName = 'nlpToolDefaultTS';
    const nlpToolDefaultPattern = `typescript weather in {city} default ${Date.now()}`;
    
    await sym.tool.create({
      name: nlpToolDefaultName,
      description: 'TS Tool with NLP, default persistence (false)',
      nlp: nlpToolDefaultPattern,
      handler: async (params: any) => ({ success: true, result: `Weather in ${params.city} is TS-sunny.` })
    });
    console.log(`✅ Created tool '${nlpToolDefaultName}' (persistNlpOnInit: default false)`);
    let isInDbDefault = await checkNlpPatternInDb(sym, nlpToolDefaultName, nlpToolDefaultPattern);
    assert.strictEqual(isInDbDefault, false, `❌ ERROR: Pattern for '${nlpToolDefaultName}' (default persist) found in DB.`);
    console.log(`✅ Pattern for '${nlpToolDefaultName}' correctly NOT in DB.`);

    const nlpToolPersistName = 'nlpToolPersistTS';
    const nlpToolPersistPattern = `typescript images of {subject} explicit ${Date.now()}`;
    await sym.tool.create({
      name: nlpToolPersistName,
      description: 'TS Tool with NLP, explicit persistence (true)',
      nlp: nlpToolPersistPattern,
      persistNlpOnInit: true,
      handler: async (params: any) => ({ success: true, result: `Images of ${params.subject} found (TS).` })
    });
    console.log(`✅ Created tool '${nlpToolPersistName}' (persistNlpOnInit: true)`);
    await new Promise(resolve => setTimeout(resolve, 300)); // Allow time for DB write
    let isInDbPersist = await checkNlpPatternInDb(sym, nlpToolPersistName, nlpToolPersistPattern);
    assert.strictEqual(isInDbPersist, true, `❌ ERROR: Pattern for '${nlpToolPersistName}' (explicit persist) NOT found in DB.`);
    console.log(`✅ Pattern for '${nlpToolPersistName}' correctly FOUND in DB.`);

    // Test 3: NlpService Seeding
    console.log('\n--- Test 3: NlpService Seeding ---');
    const patternsToSeed = [
      { toolName: 'tsWeatherReporter', nlpPattern: `ts forecast for {location} seeded ${Date.now()}` },
      { toolName: 'tsNewsFetcher', nlpPattern: `ts news about {topic} seeded ${Date.now()}` }
    ];
    await createNlpSeedFile(NLP_SEED_FILE, patternsToSeed);
    
    const seedResult = await sym.nlp.seedPatternsFromFile(NLP_SEED_FILE);
    console.log('📊 NLP Seed Result (TS):', seedResult);
    assert.strictEqual(seedResult.failed, 0, `NlpService seeding had failures (TS).`);
    console.log(`✅ NlpService seed operation completed (TS). Created: ${seedResult.created}, Updated: ${seedResult.updated}, Skipped: ${seedResult.skipped}`);
    
    const weatherPatternInDb = await checkNlpPatternInDb(sym, patternsToSeed[0].toolName, patternsToSeed[0].nlpPattern);
    assert.ok(weatherPatternInDb, `❌ Seeded '${patternsToSeed[0].toolName}' pattern not found in DB (TS)!`);
    console.log(`✅ Seeded '${patternsToSeed[0].toolName}' pattern verified (TS).`);

    // Test 4: Cache Functionality
    console.log('\n--- Test 4: Cache Functionality (TS) ---');
    const cacheKey = `testCacheKeyTS_${Date.now()}`;
    const cacheValue = { data: 'ts cached data', ts: Date.now() };
    await sym.cache.set(cacheKey, cacheValue, 60);
    const retrievedCacheValue = await sym.cache.get(cacheKey);
    assert.deepStrictEqual(retrievedCacheValue, cacheValue, `Cache get/set failed (TS).`);
    console.log(`✅ Cache ops successful (TS).`);
    
    // Test 5: Memory Functionality
    console.log('\n--- Test 5: Memory Functionality (TS) ---');
    const memoryKey = `user:tsTestUser:settings_${Date.now()}`;
    const memoryValue = { pref: 'ts_compact', flag: false };
    await sym.memory.store(memoryKey, memoryValue, 'long_term', { namespace: 'test_ts_prefs' });
    const retrievedMemoryValue = await sym.memory.retrieve(memoryKey, 'long_term', { namespace: 'test_ts_prefs' });
    assert.deepStrictEqual(retrievedMemoryValue, memoryValue, `Memory store/retrieve failed (TS).`);
    console.log(`✅ Memory ops successful (TS).`);

    // Test 6: Agent using a tool with a seeded NLP pattern
    console.log('\n--- Test 6: Agent using seeded NLP (TS) ---');
    const seededToolNameForAgent = patternsToSeed[0].toolName; 
    const seededToolPatternForAgent = patternsToSeed[0].nlpPattern;

    if (!sym.tool.getInfo(seededToolNameForAgent)) {
        await sym.tool.create({
            name: seededToolNameForAgent,
            description: `TS Weather tool (seeded NLP) ${Date.now()}`,
            handler: async (params: any) => {
                assert.ok(params.location, "Location not provided to TS seeded tool handler");
                return { success: true, result: `TS forecast for ${params.location} is super clear!` };
            }
        });
        console.log(`✅ Created '${seededToolNameForAgent}' tool for agent (TS).`);
    }

    const testAgent = await sym.agent.create({
      name: `NLPAgentTS_${Date.now()}`,
      tools: [seededToolNameForAgent], 
      llm: { model: 'gpt-4o-mini', useFunctionCalling: true }, 
      systemPrompt: `You are TS TestAgent. Tool: '${seededToolNameForAgent}': Weather. Params: {"location": "string"}`
    });
    console.log(`✅ Created ${testAgent.name}.`);
    
    const locationMatch = seededToolPatternForAgent.match(/\{(.*?)\}/);
    const dynamicLocation = locationMatch ? locationMatch[1] : 'Berlin'; // fallback
    const agentTask = seededToolPatternForAgent.replace(`{${dynamicLocation}}`, 'Tokyo');
    
    console.log(`🎯 Agent task via SEEDED NLP (TS): "${agentTask}"`);
    const agentResult = await testAgent.run(agentTask);

    console.log('📊 Agent Run Result (Seeded NLP, TS):', JSON.stringify(agentResult, null, 0).substring(0, 500) + "...");
    assert.ok(agentResult.success, `Agent task failed (TS): ${agentResult.error}`);
    assert.ok(agentResult.result?.toolsExecuted?.length > 0, `Agent no tool exec (TS): "${agentTask}".`);
    const toolExec = agentResult.result.toolsExecuted.find((t: any) => t.name === seededToolNameForAgent);
    assert.ok(toolExec, `Agent did not execute '${seededToolNameForAgent}' (TS).`);
    assert.ok(toolExec.parameters?.location, `Tool param 'location' missing (TS). Params: ${JSON.stringify(toolExec.parameters)}`);
    console.log(`✅ Agent invoked '${seededToolNameForAgent}' via seeded NLP (TS). Params:`, toolExec.parameters);

    console.log('\n🎉🎉🎉 ALL TS NLP, CACHE, MEMORY & INIT TESTS PASSED! 🎉🎉🎉');
    process.exitCode = 0;
    
  } catch (error: any) {
    console.error('\n❌ TS TEST SUITE FAILED:', error.message);
    if (error.stack) console.error('Stack:', error.stack);
    process.exitCode = 1; 
  } finally {
    clearTimeout(testTimeoutId);
    console.log("--- TS Test Script Finalizing ---");
    try {
      if (await fs.stat(NLP_SEED_FILE).catch(() => null)) {
        await fs.unlink(NLP_SEED_FILE);
        console.log('🧹 Cleaned up dummy TS NLP seed file.');
      }
    } catch (e: any) { console.warn("Warning: Could not clean up NLP seed file (TS).", e.message) }
    
    if (testTimedOut) {
        console.error("🔚 Test exited due to TIMEOUT (TS).");
    } else if (process.exitCode === 0) {
        console.log('🔚 TS Test script finished successfully. Exiting with code 0.');
        setTimeout(() => process.exit(0), 500); 
    } else {
        console.error(`🔚 TS Test script finished with errors. Exiting with code ${process.exitCode || 1}.`);
        setTimeout(() => process.exit(process.exitCode || 1), 500); 
    }
  }
}

function handleExit(signal: string) {
  console.log(`\n🛑 TS Test received ${signal}. Exiting...`);
  if ((global as any).testTimeoutId) clearTimeout((global as any).testTimeoutId); 
  process.exit(signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1); 
}

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));

process.on('uncaughtException', (error: Error, origin: string) => {
  console.error('🚨🚨🚨 TS UNCAUGHT EXCEPTION! 🚨🚨🚨');
  console.error('Origin:', origin);
  console.error('Error:', error);
  if ((global as any).testTimeoutId) clearTimeout((global as any).testTimeoutId); 
  process.exitCode = 1;
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('🚨🚨🚨 TS UNHANDLED PROMISE REJECTION! 🚨🚨🚨');
  console.error('Reason:', reason);
  if ((global as any).testTimeoutId) clearTimeout((global as any).testTimeoutId);
  process.exitCode = 1;
  process.exit(1);
});

testNlpCacheMemory(); 