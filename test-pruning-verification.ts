/**
 * SIMPLE PRUNING VERIFICATION TEST
 * 
 * This test directly verifies the age-based pruning logic with our exact database data
 */

import { symphony } from './src';

async function testPruningVerification() {
    console.log('🔍 PRUNING VERIFICATION TEST');
    console.log('=' .repeat(50));
    
    try {
        // Initialize Symphony
        symphony.updateConfig({
            db: { enabled: true, path: './symphony.db', adapter: 'sqlite' }
        });
        await symphony.initialize();
        
        // Check current database state
        const allRecords = await symphony.db.table('tool_executions').find();
        console.log(`📊 Total records in database: ${allRecords.length}`);
        
        // Find old records that should be pruned
        const cutoffTime = Date.now() - 5000; // 5 seconds ago
        const oldRecords = allRecords.filter((record: any) => {
            const recordAge = Date.now() - new Date(record.created_at).getTime();
            return recordAge > 5000; // Older than 5 seconds
        });
        
        console.log(`⏰ Records older than 5 seconds: ${oldRecords.length}`);
        
        if (oldRecords.length > 0) {
            console.log('📋 Sample old records:');
            oldRecords.slice(0, 3).forEach((record: any) => {
                const age = Math.round((Date.now() - new Date(record.created_at).getTime()) / 1000);
                console.log(`   • ${record.execution_id}: ${record.tool_name} (${age}s old)`);
            });
        }
        
        // Execute aggressive pruning
        console.log('\\n🧹 Executing aggressive pruning (maxAge: 5000ms)...');
        const pruningResult = await symphony.tool.execute('executeContextPruning', {
            maxAge: 5000, // 5 seconds - should remove many old records
            minConfidence: 0.1, // Very low threshold
            keepRecentCount: 10 // Keep only 10 recent records per tool
        });
        
        console.log('✅ Pruning result:', pruningResult);
        
        // Check database state after pruning
        const remainingRecords = await symphony.db.table('tool_executions').find();
        console.log(`📊 Records after pruning: ${remainingRecords.length}`);
        console.log(`🗑️  Records removed: ${allRecords.length - remainingRecords.length}`);
        
        // Verify our manually inserted old records
        const oldTestRecords = await symphony.db.table('tool_executions')
            .where({ tool_name: 'obsoleteTool' })
            .find();
            
        console.log(`🔍 Obsolete tool records remaining: ${oldTestRecords.length}`);
        
        if (pruningResult.success && pruningResult.result?.prunedEntries > 0) {
            console.log('🎉 SUCCESS: Age-based pruning is working!');
        } else {
            console.log('❌ ISSUE: Age-based pruning did not remove old records');
            console.log('   Debug info:', {
                pruningSuccess: pruningResult.success,
                entriesPruned: pruningResult.result?.prunedEntries || 0,
                oldRecordsFound: oldRecords.length
            });
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testPruningVerification().catch(console.error); 