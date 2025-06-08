/**
 * Symphony SDK: Code Review Agent Test
 *
 * This test focuses on an agent's ability to perform a task that requires
 * reasoning and then acting on that reasoning by writing to a file.
 * It's designed to expose and solve the gap between an agent's plan
 * and its final execution of file-writing tasks.
 */

import { Symphony } from './src/symphony';
import { AgentConfig } from './src/types/sdk';
import fs from 'fs/promises';
import path from 'path';

// The buggy Rust code snippet for the agent to review.
const buggyRustCode = `
fn main() {
    let x = 5;
    let y = 10;
    let sum = x + z; // z is not defined
    println!("The sum is: {}", sum)
}
`;

// Configuration for our new CodeReviewAgent
const codeReviewAgentConfig: AgentConfig = {
  name: 'CodeReviewer',
  description: 'An AI agent that analyzes code, identifies issues, and writes a formal review.',
  task: 'Review the provided code snippet for errors, logic issues, and style. Write your findings to a file named code-review.md.',
  tools: ['ponder', 'writeFile'],
  llm: {
    model: 'gpt-4o-mini',
    provider: 'openai',
    temperature: 0.2,
  },
  systemPrompt: `You are an expert code reviewer. Your goal is to analyze code, identify bugs, and provide clear, constructive feedback.
  
  WORKFLOW:
  1.  **Analyze:** Use the 'ponder' tool to carefully analyze the provided code snippet.
  2.  **Synthesize:** Formulate a clear and concise code review based on your analysis.
  3.  **Write:** Use the 'writeFile' tool to save your complete review to a file named 'code-review.md'.`,
  maxCalls: 5,
  log: {
    inputs: true,
    outputs: true,
    llmCalls: true,
    toolCalls: true,
  },
};

async function runCodeReviewTest() {
  console.log('🚀 Starting Code Review Agent Test');
  console.log('======================================\n');

  const reviewFilePath = path.join(process.cwd(), 'code-review.md');

  try {
    // Clean up any previous review file
    await fs.rm(reviewFilePath, { force: true });

    // Initialize Symphony
    const symphony = new Symphony({
      llm: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
      },
      db: { enabled: false },
      runtime: {
        enhancedRuntime: true,
        planningThreshold: 'complex',
        reflectionEnabled: false, // Keep reflection off for this targeted test
      },
    });

    await symphony.initialize();
    console.log('✅ Symphony SDK initialized successfully\n');

    // Create the agent
    const agent = await symphony.agent.create(codeReviewAgentConfig);
    console.log(`✅ ${agent.name} agent created\n`);

    // Define the task for the agent
    const reviewTask = `
      Please review the following Rust code snippet and write your findings into a file named "code-review.md".
      
      \`\`\`rust
      ${buggyRustCode}
      \`\`\`
    `;

    console.log('🎯 Starting code review task...\n');
    const result = await agent.run(reviewTask);

    if (result.success) {
      console.log('✅ AGENT EXECUTION SUCCEEDED');
    } else {
      console.error('❌ AGENT EXECUTION FAILED');
      console.error(`   Error: ${result.error}`);
    }

    console.log('\n🔍 Verifying review file...');

    // Verify that the review file was created
    try {
      const reviewContent = await fs.readFile(reviewFilePath, 'utf-8');
      console.log('✅ Review file created successfully.');
      console.log('--- REVIEW CONTENT ---');
      console.log(reviewContent);
      console.log('----------------------');
      const lowerCaseContent = reviewContent.toLowerCase();
      if (!lowerCaseContent.includes('z') || !lowerCaseContent.includes('not defined')) {
          throw new Error('Review content did not mention that variable z was not defined.');
      }
      console.log('✅ Review content is valid.');
    } catch (error) {
      console.error('❌ Review file verification failed.', error);
      throw error; // Propagate error to fail the test
    }

  } catch (error: any) {
    console.error('\n💥 Test execution failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    // Clean up the created file
    await fs.rm(reviewFilePath, { force: true });
    console.log('\n🧹 Cleaned up review file.');
  }
}

// Execute the test
runCodeReviewTest()
  .then(() => {
    console.log('\n✨ Code Review Agent test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Code Review Agent test failed:', error);
    process.exit(1);
  }); 