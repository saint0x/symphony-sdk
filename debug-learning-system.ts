import { symphony } from './src';

async function debugLearningSystem() {
    console.log('🔍 DEBUGGING LEARNING SYSTEM');
    
    try {
        symphony.updateConfig({
            db: { enabled: true, path: './symphony.db', adapter: 'sqlite' }
        });
        await symphony.initialize();
        
        console.log('✅ Symphony initialized');
        
        // Test the learning system directly
        console.log('🧪 Testing updateLearningContext directly...');
        
        const result = await symphony.tool.execute('updateLearningContext', {
            toolName: 'testTool',
            parameters: { test: 'value' },
            result: { success: true },
            success: true,
            userFeedback: 'positive'
        });
        
        console.log('📊 Learning context result:', result);
        console.log('🔍 Success:', result.success);
        console.log('🔍 Error:', result.error);
        
        // Test database record directly
        console.log('\n🧪 Testing database record directly...');
        
        await symphony.db.recordToolExecution({
            execution_id: 'test_debug_' + Date.now(),
            tool_name: 'debugTest',
            success: true,
            execution_time_ms: 100,
            input_parameters: { test: 'value' },
            output_result: { success: true }
        });
        
        console.log('✅ Direct database record succeeded');
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
        if (error instanceof Error) {
            console.error('📋 Stack trace:', error.stack);
        }
    }
}

debugLearningSystem().catch(console.error); 