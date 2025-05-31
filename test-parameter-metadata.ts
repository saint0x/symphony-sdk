import { Symphony } from './src/symphony';
import { Logger } from './src/utils/logger';

const testLogger = Logger.getInstance('ParameterMetadataTest');

async function testParameterMetadata() {
    testLogger.info('Test', 'Starting parameter metadata test');
    
    try {
        // Initialize Symphony
        const symphony = new Symphony({
            llm: {
                provider: 'openai',
                model: 'gpt-3.5-turbo'
            }
        });
        
        await symphony.initialize();
        
        // Get tool registry from symphony
        const toolRegistry = (symphony.tool as any).registry;
        
        // Test 1: Get metadata for a specific tool
        testLogger.info('Test', '=== Test 1: Get metadata for writeFile ===');
        const writeFileMetadata = toolRegistry.getToolMetadata('writeFile');
        console.log('WriteFile Metadata:', JSON.stringify(writeFileMetadata, null, 2));
        
        // Test 2: Get all tools metadata
        testLogger.info('Test', '\n=== Test 2: Get all tools metadata ===');
        const allToolsMetadata = toolRegistry.getToolMetadata();
        console.log('Total tools with metadata:', Object.keys(allToolsMetadata).length);
        console.log('\nSample tools:');
        Object.entries(allToolsMetadata).slice(0, 3).forEach(([name, metadata]: [string, any]) => {
            console.log(`\n${name}:`, {
                description: metadata.description,
                parameters: metadata.parameters
            });
        });
        
        // Test 3: Get enhanced tool list
        testLogger.info('Test', '\n=== Test 3: Get enhanced tool list ===');
        const enhancedList = toolRegistry.getEnhancedToolList();
        console.log('Enhanced tool count:', enhancedList.length);
        console.log('\nFirst tool with parameters:', {
            name: enhancedList[0].name,
            parameters: enhancedList[0].parameters
        });
        
        // Test 4: Test agent system prompt with parameter info
        testLogger.info('Test', '\n=== Test 4: Test agent system prompt generation ===');
        const agent = await symphony.agent.create({
            name: 'test-agent',
            description: 'Test agent for parameter metadata',
            task: 'demonstrate parameter awareness',
            tools: ['writeFile', 'readFile', 'webSearch'],
            llm: 'gpt-3.5-turbo'
        });
        
        // Access the system prompt service through the executor
        const systemPromptService = (agent.executor as any).systemPromptService;
        const systemPrompt = systemPromptService.generateSystemPrompt({
            name: 'test-agent',
            description: 'Test agent',
            task: 'test task',
            tools: ['writeFile', 'readFile'],
            llm: 'gpt-3.5-turbo'
        });
        
        // Check if system prompt contains parameter information
        const hasParameterInfo = systemPrompt.includes('Parameters:') || 
                                systemPrompt.includes('path') || 
                                systemPrompt.includes('content');
        
        console.log('\nSystem prompt contains parameter info:', hasParameterInfo);
        console.log('\nTool registry section from prompt:');
        const toolRegistryMatch = systemPrompt.match(/Available tools:([^<]+)/);
        if (toolRegistryMatch) {
            console.log(toolRegistryMatch[1].trim());
        }
        
        testLogger.info('Test', '\n=== All tests completed successfully ===');
        
    } catch (error) {
        testLogger.error('Test', 'Test failed', { error });
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testParameterMetadata().catch(console.error); 