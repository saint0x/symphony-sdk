// testOpenAIJsonMode.ts
import { AgentExecutor } from './src/agents/executor';
import { AgentConfig, LogLevel } from './src/types/sdk';
import { Logger } from './src/utils/logger';

// Ensure OPENAI_API_KEY is set in your environment (e.g., in a .env file or exported in your shell)
// Example: export OPENAI_API_KEY='your_api_key_here'

async function runOpenAIJsonTest() {
    // Configure the logger for both SDK and test script
    const testLogger = Logger.getInstance('OpenAIJsonTestScript');
    // Valid levels for LogLevel enum: DEBUG, INFO, WARN, ERROR, NONE (assuming these exist based on typical logger patterns)
    // Adjusting to use the imported LogLevel enum
    testLogger.setMinLevel(LogLevel.INFO); 

    testLogger.info('-------------------------------------------------------');
    testLogger.info('Starting Symphony SDK OpenAI JSON Mode Test');
    testLogger.info('-------------------------------------------------------');
    testLogger.info('This test will verify if the AgentExecutor correctly instructs the LLM to output JSON.');
    testLogger.info('Ensure your OPENAI_API_KEY environment variable is set.');

    const agentConfig: AgentConfig = {
        name: 'JSONOutputTestAgent',
        role: 'Data Formatter',
        goal: 'To output structured data in JSON format based on a task.',
        llm: { 
            provider: 'openai',
            model: 'gpt-3.5-turbo', // Or your preferred OpenAI model that supports JSON mode well
            useFunctionCalling: true, // CRITICAL: This enables JSON mode in AgentExecutor's logic
            temperature: 0.3, // Lower temperature for more predictable JSON structure
        },
        tools: [], // No external tools needed for this direct JSON output test
        maxLoops: 1, // Agent should respond in one go for this task
        systemPrompt: "You are a precise assistant. When asked for JSON, you will provide ONLY the JSON object as your response.", // Base system prompt
    };

    testLogger.info('Agent Configuration:', JSON.stringify(agentConfig, null, 2));

    const executor = new AgentExecutor(agentConfig);
    testLogger.info('AgentExecutor instance created.');

    const taskDescription = "Generate a JSON object representing a book with three properties: 'title' (string), 'author' (string), and 'publishedYear' (number). For example, a book named 'The Great Test' by 'AI Tester' published in 2024.";
    testLogger.info(`Executing task: "${taskDescription}"`);

    try {
        const result = await executor.executeTask(taskDescription);
        
        testLogger.info('Task execution completed by AgentExecutor.');
        console.log('\n📋 --- Full Task Result --- 📋');
        console.log(JSON.stringify(result, null, 2));

        if (result.success && result.result && typeof result.result.response === 'string') {
            testLogger.info('Task reported success and response is a string. Attempting to parse as JSON...');
            const llmResponseContent = result.result.response;
            
            try {
                const parsedJson = JSON.parse(llmResponseContent);
                testLogger.info('Successfully parsed the LLM response as JSON.');
                console.log('\n🤖 --- Parsed LLM JSON Response --- 🤖');
                console.log(JSON.stringify(parsedJson, null, 2));

                // Basic validation of the JSON structure
                if (parsedJson && typeof parsedJson.title === 'string' && typeof parsedJson.author === 'string' && typeof parsedJson.publishedYear === 'number') {
                    testLogger.info('JSON response contains the expected keys and types (title, author, publishedYear).');
                    console.log('\n✅ --- TEST PASSED --- ✅');
                    console.log('The LLM successfully returned a JSON object with the expected structure.');
                } else {
                    testLogger.warn('JSON response parsed, but does not match the expected structure (title, author, publishedYear).');
                    console.log('\n⚠️ --- TEST PASSED WITH WARNINGS --- ⚠️');
                    console.log('The LLM returned JSON, but its structure needs review.');
                }
            } catch (e) {
                testLogger.error('Failed to parse the LLM response string as JSON.', { 
                    errorMessage: (e instanceof Error) ? e.message : String(e),
                    responseContent: llmResponseContent 
                });
                console.error('\n❌ --- TEST FAILED --- ❌');
                console.error('The LLM response was expected to be a JSON string, but parsing failed.');
                console.log('   Raw LLM Response Content:', llmResponseContent);
            }
        } else {
            testLogger.error('Task execution was not successful or the response format was unexpected.', { 
                success: result.success, 
                responseType: typeof result.result?.response,
                error: result.error 
            });
            console.error('\n❌ --- TEST FAILED --- ❌');
            console.error('Task execution failed or the response was not a string as expected.');
        }
    } catch (error) {
        testLogger.error('An unexpected critical error occurred during task execution.', { 
            errorMessage: (error instanceof Error) ? error.message : String(error),
            stack: (error instanceof Error) ? (error as Error).stack : undefined
        });
        console.error('\n❌ --- TEST FAILED (CRITICAL ERROR) --- ❌');
        console.error('An unexpected error occurred while the AgentExecutor was processing the task.');
    } finally {
        testLogger.info('-------------------------------------------------------');
        testLogger.info('OpenAI JSON Mode Test Finished');
        testLogger.info('-------------------------------------------------------');
    }
}

runOpenAIJsonTest().catch(criticalError => {
    // Fallback for errors not caught within runOpenAIJsonTest's try/catch
    console.error("\n💥 --- UNHANDLED CRITICAL ERROR IN TEST SCRIPT --- 💥");
    console.error((criticalError instanceof Error) ? criticalError.message : String(criticalError));
    if (criticalError instanceof Error && criticalError.stack) {
        console.error(criticalError.stack);
    }
}); 