import { Symphony } from './src/symphony';
import { SymphonyConfig } from './src/types/symphony';
import { Logger } from './src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = Logger.getInstance('DatabaseConfigTest');

async function testDatabaseDisabledMode() {
    logger.info('DatabaseConfigTest', '🚫 === TESTING DATABASE DISABLED MODE === 🚫');
    
    // Test 1: Explicit disabled
    logger.info('DatabaseConfigTest', 'Test 1: Explicit enabled: false');
    const config1: SymphonyConfig = {
        db: { enabled: false },
        serviceRegistry: { enabled: false, maxRetries: 0, retryDelay: 0 },
        metrics: { enabled: false, detailed: false }
    };
    
    const symphony1 = new Symphony(config1);
    await symphony1.initialize();
    
    const dbService1 = await symphony1.getService('database');
    const health1 = await dbService1.health();
    
    console.assert(health1.adapter === 'mock', 'Should use mock adapter when disabled');
    console.assert(health1.connected === true, 'Mock adapter should report connected');
    console.assert(health1.storage.tableCount === 0, 'Mock adapter should have no tables');
    
    logger.info('DatabaseConfigTest', '✅ Test 1 passed: Explicit disabled mode works');
    
    // Test 2: No database config provided
    logger.info('DatabaseConfigTest', 'Test 2: No database config provided');
    const config2: SymphonyConfig = {
        serviceRegistry: { enabled: false, maxRetries: 0, retryDelay: 0 },
        metrics: { enabled: false, detailed: false }
    };
    
    const symphony2 = new Symphony(config2);
    await symphony2.initialize();
    
    const dbService2 = await symphony2.getService('database');
    const health2 = await dbService2.health();
    
    console.assert(health2.adapter === 'mock', 'Should use mock adapter when no config');
    console.assert(health2.connected === true, 'Mock adapter should report connected');
    
    logger.info('DatabaseConfigTest', '✅ Test 2 passed: No config defaults to disabled mode');
    
    // Test 3: Empty database config
    logger.info('DatabaseConfigTest', 'Test 3: Empty database config object');
    const config3: SymphonyConfig = {
        db: {},
        serviceRegistry: { enabled: false, maxRetries: 0, retryDelay: 0 },
        metrics: { enabled: false, detailed: false }
    };
    
    const symphony3 = new Symphony(config3);
    await symphony3.initialize();
    
    const dbService3 = await symphony3.getService('database');
    const health3 = await dbService3.health();
    
    console.assert(health3.adapter === 'mock', 'Should use mock adapter for empty config');
    
    logger.info('DatabaseConfigTest', '✅ Test 3 passed: Empty config defaults to disabled mode');
    
    // Test tool execution in disabled mode
    logger.info('DatabaseConfigTest', 'Test 4: Tool execution in disabled mode');
    const result = await symphony1.tool.execute('ponder', {
        topic: 'test disabled mode',
        steps: 'quick test',
        consciousness_level: 'low'
    });
    
    console.assert(result.success === true, 'Tools should work in disabled mode');
    
    logger.info('DatabaseConfigTest', '✅ Test 4 passed: Tools work in disabled mode');
    
    logger.info('DatabaseConfigTest', '🎉 All disabled mode tests passed!');
}

async function testDatabaseEnabledMode() {
    logger.info('DatabaseConfigTest', '💾 === TESTING DATABASE ENABLED MODE === 💾');
    
    // Clean up any existing test database
    const testDbPath = './test-symphony.db';
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
        logger.info('DatabaseConfigTest', 'Cleaned up existing test database');
    }
    
    // Test 1: Explicit enabled with custom path
    logger.info('DatabaseConfigTest', 'Test 1: Explicit enabled with custom path');
    const config1: SymphonyConfig = {
        db: {
            enabled: true,
            adapter: 'sqlite',
            path: testDbPath
        },
        serviceRegistry: { enabled: false, maxRetries: 0, retryDelay: 0 },
        metrics: { enabled: false, detailed: false }
    };
    
    const symphony1 = new Symphony(config1);
    await symphony1.initialize();
    
    // Verify database file was created
    console.assert(fs.existsSync(testDbPath), 'Database file should be created');
    
    const dbService1 = await symphony1.getService('database');
    const health1 = await dbService1.health();
    
    console.assert(health1.adapter === 'sqlite', 'Should use SQLite adapter');
    console.assert(health1.connected === true, 'SQLite should be connected');
    console.assert(health1.storage.tableCount >= 3, 'Should have created required tables');
    
    logger.info('DatabaseConfigTest', '✅ Test 1 passed: Explicit enabled mode works');
    
    // Test 2: Verify required tables exist
    logger.info('DatabaseConfigTest', 'Test 2: Verify required tables exist');
    const requiredTables = ['tool_executions', 'patterns', 'context_sessions'];
    
    for (const tableName of requiredTables) {
        const exists = await dbService1.schema.exists(tableName);
        console.assert(exists, `Table '${tableName}' should exist`);
        
        const count = await dbService1.table(tableName).count();
        console.assert(typeof count === 'number', `Should be able to count records in '${tableName}'`);
        
        logger.info('DatabaseConfigTest', `✅ Table '${tableName}' exists with ${count} records`);
    }
    
    logger.info('DatabaseConfigTest', '✅ Test 2 passed: All required tables exist');
    
    // Test 3: Test database operations
    logger.info('DatabaseConfigTest', 'Test 3: Test database operations');
    
    // Test tool execution recording
    const toolResult = await symphony1.tool.execute('ponder', {
        topic: 'test database operations',
        steps: 'analyze, verify, confirm',
        consciousness_level: 'medium'
    });
    
    console.assert(toolResult.success === true, 'Tool execution should succeed');
    
    // Wait a moment for database recording
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if execution was recorded
    const executions = await dbService1.table('tool_executions').find();
    console.assert(executions.length > 0, 'Tool execution should be recorded in database');
    
    logger.info('DatabaseConfigTest', `✅ Test 3 passed: Found ${executions.length} recorded executions`);
    
    // Test 4: Configuration with just path (should auto-enable)
    logger.info('DatabaseConfigTest', 'Test 4: Config with just path (should auto-enable)');
    
    const testDbPath2 = './test-symphony-2.db';
    if (fs.existsSync(testDbPath2)) {
        fs.unlinkSync(testDbPath2);
    }
    
    const config4: SymphonyConfig = {
        db: {
            path: testDbPath2
        },
        serviceRegistry: { enabled: false, maxRetries: 0, retryDelay: 0 },
        metrics: { enabled: false, detailed: false }
    };
    
    const symphony4 = new Symphony(config4);
    await symphony4.initialize();
    
    console.assert(fs.existsSync(testDbPath2), 'Database file should be created with just path config');
    
    const dbService4 = await symphony4.getService('database');
    const health4 = await dbService4.health();
    
    console.assert(health4.adapter === 'sqlite', 'Should auto-enable SQLite with path config');
    console.assert(health4.connected === true, 'Should be connected');
    
    logger.info('DatabaseConfigTest', '✅ Test 4 passed: Path-only config auto-enables database');
    
    // Test 5: Default configuration (should use ./symphony.db)
    logger.info('DatabaseConfigTest', 'Test 5: Default enabled configuration');
    
    const defaultDbPath = './symphony.db';
    const backupPath = './symphony.db.backup';
    
    // Backup existing symphony.db if it exists
    if (fs.existsSync(defaultDbPath)) {
        fs.copyFileSync(defaultDbPath, backupPath);
        fs.unlinkSync(defaultDbPath);
    }
    
    const config5: SymphonyConfig = {
        db: { enabled: true },
        serviceRegistry: { enabled: false, maxRetries: 0, retryDelay: 0 },
        metrics: { enabled: false, detailed: false }
    };
    
    const symphony5 = new Symphony(config5);
    await symphony5.initialize();
    
    console.assert(fs.existsSync(defaultDbPath), 'Default symphony.db should be created');
    
    const dbService5 = await symphony5.getService('database');
    const health5 = await dbService5.health();
    
    console.assert(health5.adapter === 'sqlite', 'Should use SQLite by default');
    console.assert(health5.connected === true, 'Should be connected');
    
    logger.info('DatabaseConfigTest', '✅ Test 5 passed: Default enabled config works');
    
    // Cleanup
    [testDbPath, testDbPath2, defaultDbPath].forEach(dbPath => {
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
            logger.info('DatabaseConfigTest', `Cleaned up ${dbPath}`);
        }
    });
    
    // Restore backup if it existed
    if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, defaultDbPath);
        fs.unlinkSync(backupPath);
        logger.info('DatabaseConfigTest', 'Restored original symphony.db');
    }
    
    logger.info('DatabaseConfigTest', '🎉 All enabled mode tests passed!');
}

async function testCacheServiceCompatibility() {
    logger.info('DatabaseConfigTest', '🔄 === TESTING CACHE SERVICE COMPATIBILITY === 🔄');
    
    // Test that cache service works with both database modes
    
    // Test 1: Cache with disabled database
    logger.info('DatabaseConfigTest', 'Test 1: Cache service with disabled database');
    const config1: SymphonyConfig = {
        db: { enabled: false },
        serviceRegistry: { enabled: false, maxRetries: 0, retryDelay: 0 },
        metrics: { enabled: false, detailed: false }
    };
    
    const symphony1 = new Symphony(config1);
    await symphony1.initialize();
    
    const cacheService1 = await symphony1.getService('cache');
    const healthCheck1 = await cacheService1.healthCheck();
    
    console.assert(healthCheck1.status === 'healthy', 'Cache should be healthy with disabled database');
    
    logger.info('DatabaseConfigTest', '✅ Test 1 passed: Cache works with disabled database');
    
    // Test 2: Cache with enabled database
    logger.info('DatabaseConfigTest', 'Test 2: Cache service with enabled database');
    const testDbPath = './test-cache-db.db';
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
    
    const config2: SymphonyConfig = {
        db: {
            enabled: true,
            path: testDbPath
        },
        serviceRegistry: { enabled: false, maxRetries: 0, retryDelay: 0 },
        metrics: { enabled: false, detailed: false }
    };
    
    const symphony2 = new Symphony(config2);
    await symphony2.initialize();
    
    const cacheService2 = await symphony2.getService('cache');
    const healthCheck2 = await cacheService2.healthCheck();
    
    console.assert(healthCheck2.status === 'healthy', 'Cache should be healthy with enabled database');
    
    // Test cache intelligence
    const intelligence = await cacheService2.getIntelligence('test query for cache');
    console.assert(intelligence.recommendation !== undefined, 'Cache should provide intelligence recommendations');
    
    logger.info('DatabaseConfigTest', '✅ Test 2 passed: Cache works with enabled database');
    
    // Cleanup
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
    
    logger.info('DatabaseConfigTest', '🎉 Cache service compatibility tests passed!');
}

async function testAgentAndTeamServices() {
    logger.info('DatabaseConfigTest', '🤖 === TESTING AGENT AND TEAM SERVICES === 🤖');
    
    // Test that agent and team services work regardless of database mode
    
    const config: SymphonyConfig = {
        db: { enabled: false }, // Use disabled mode for faster testing
        serviceRegistry: { enabled: false, maxRetries: 0, retryDelay: 0 },
        metrics: { enabled: false, detailed: false }
    };
    
    const symphony = new Symphony(config);
    await symphony.initialize();
    
    // Test agent creation and execution
    logger.info('DatabaseConfigTest', 'Test 1: Agent creation and execution');
    const agent = await symphony.agent.create({
        name: 'TestAgent',
        description: 'Test agent for database config',
        tools: ['ponder'],
        llm: { 
            provider: 'mock',
            model: 'test-model',
            apiKey: 'test-key',
            temperature: 0.7
        }
    });
    
    console.assert(agent.name === 'TestAgent', 'Agent should be created successfully');
    
    logger.info('DatabaseConfigTest', '✅ Test 1 passed: Agent creation works');
    
    // Test team creation
    logger.info('DatabaseConfigTest', 'Test 2: Team creation');
    const team = await symphony.team.create({
        name: 'TestTeam',
        description: 'Test team for database config',
        agents: [
            {
                name: 'Agent1',
                description: 'First test agent',
                tools: ['ponder'],
                llm: { 
                    provider: 'mock',
                    model: 'test-model',
                    apiKey: 'test-key',
                    temperature: 0.7
                }
            }
        ],
        strategy: {
            name: 'SEQUENTIAL',
            description: 'Sequential execution'
        }
    });
    
    console.assert(team.config.name === 'TestTeam', 'Team should be created successfully');
    
    logger.info('DatabaseConfigTest', '✅ Test 2 passed: Team creation works');
    
    logger.info('DatabaseConfigTest', '🎉 Agent and team services tests passed!');
}

async function runAllTests() {
    logger.info('DatabaseConfigTest', '🚀 === STARTING DATABASE CONFIGURATION TESTS === 🚀');
    
    try {
        await testDatabaseDisabledMode();
        await testDatabaseEnabledMode();
        await testCacheServiceCompatibility();
        await testAgentAndTeamServices();
        
        logger.info('DatabaseConfigTest', '\n🎉🎉🎉 ALL DATABASE CONFIGURATION TESTS PASSED! 🎉🎉🎉');
        logger.info('DatabaseConfigTest', '✅ Database disabled mode: Working correctly');
        logger.info('DatabaseConfigTest', '✅ Database enabled mode: Working correctly');
        logger.info('DatabaseConfigTest', '✅ SQLite file creation: Working correctly');
        logger.info('DatabaseConfigTest', '✅ Table schema verification: Working correctly');
        logger.info('DatabaseConfigTest', '✅ Cache service compatibility: Working correctly');
        logger.info('DatabaseConfigTest', '✅ Agent and team services: Working correctly');
        
        logger.info('DatabaseConfigTest', '\n📋 CONFIGURATION SUMMARY:');
        logger.info('DatabaseConfigTest', '• { enabled: false } → Uses in-memory mock services');
        logger.info('DatabaseConfigTest', '• No db config → Uses in-memory mock services');
        logger.info('DatabaseConfigTest', '• { enabled: true } → Creates ./symphony.db with SQLite');
        logger.info('DatabaseConfigTest', '• { path: "custom.db" } → Creates custom.db with SQLite');
        logger.info('DatabaseConfigTest', '• Required tables: tool_executions, patterns, context_sessions');
        
        process.exitCode = 0;
    } catch (error) {
        logger.error('DatabaseConfigTest', 'DATABASE CONFIGURATION TESTS FAILED:', { 
            message: (error as Error).message, 
            stack: (error as Error).stack 
        });
        process.exitCode = 1;
    }
}

runAllTests().finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 2000);
}); 