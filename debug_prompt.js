const { SystemPromptService } = require('./dist/agents/sysprompt');

const config = {
    name: 'testAgent',
    description: 'Test agent',
    task: 'Test task',
    tools: ['ponder', 'writeCode'],
    llm: { model: 'gpt-3.5-turbo' }
};

const service = new SystemPromptService();
const prompt = service.generateSystemPrompt(config, true);
console.log("=== SYSTEM PROMPT ===");
console.log(prompt);
console.log("=== END SYSTEM PROMPT ==="); 