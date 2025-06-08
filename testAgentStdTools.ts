/**
 * Symphony SDK: Standard Tools Stress Test
 *
 * This test is designed to be a comprehensive stress test for an agent's ability
 * to use and chain all the standard tools available in the Symphony SDK.
 *
 * It will force the agent to perform a complex, multi-step task that requires:
 * - Web searching for information (`webSearch`)
 * - Writing initial findings to a file (`writeFile`)
 * - Reading that file back (`readFile`)
 * - Parsing the document to extract key information (`parseDocument`)
 * - Generating new code based on the parsed info (`writeCode`)
 * - Saving the final code to a new file (`writeFile`)
 */

import { Symphony } from './src/symphony';
import { AgentConfig } from './src/types/sdk';
import fs from 'fs/promises';
import path from 'path';

// Agent Configuration for the Standard Tools Stress Test
const stdToolsAgentConfig: AgentConfig = {
  name: 'StdToolAgent',
  description: 'An AI agent equipped with all standard tools to perform complex, multi-step tasks.',
  task: 'Analyze information from the web, process it through files, and generate code based on the findings.',
  tools: ['webSearch', 'readFile', 'writeFile', 'parseDocument', 'ponder', 'writeCode', 'createPlan'],
  llm: {
    model: 'gpt-4o-mini',
    provider: 'openai',
    temperature: 0.2,
  },
  systemPrompt: `You are a powerful, multi-tool AI agent. Your goal is to solve complex tasks by creating and executing a plan that uses your available tools in a logical sequence.
  
  **Core Workflow:**
  1.  **Understand & Plan:** Use the 'createPlan' tool to break down the user's request into a sequence of concrete tool calls.
  2.  **Gather Information:** Use 'webSearch', 'readFile', etc., to get the necessary information.
  3.  **Process & Reason:** Use 'parseDocument' and 'ponder' to understand and synthesize the information.
  4.  **Create & Act:** Use 'writeCode' and 'writeFile' to produce the final output.
  5.  **Data Flow:** You MUST pass the output from one step as the input to the next logical step.`,
  maxCalls: 15,
  log: {
    inputs: true,
    outputs: true,
    llmCalls: true,
    toolCalls: true,
  },
};

async function runStdToolsStressTest() {
  console.log('🚀 Starting Standard Tools Stress Test');
  console.log('=========================================\n');

  const tempFilePath = path.join(process.cwd(), 'temp-research-notes.md');
  const finalCodePath = path.join(process.cwd(), 'builder-pattern-example.rs');

  try {
    // Clean up any artifacts from previous runs
    await fs.rm(tempFilePath, { force: true });
    await fs.rm(finalCodePath, { force: true });

    // Initialize Symphony
    const symphony = new Symphony({
      llm: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY || '',
      },
      db: { enabled: false },
      runtime: {
        enhancedRuntime: true,
        planningThreshold: 'complex',
        reflectionEnabled: false, // Keep reflection off for this test
      },
    });

    await symphony.initialize();
    console.log('✅ Symphony SDK initialized successfully\n');

    // Create the agent
    const agent = await symphony.agent.create(stdToolsAgentConfig);
    console.log(`✅ ${agent.name} agent created\n`);

    // Define the complex, multi-step task for the agent
    const stressTestTask = `
      Follow these steps precisely:
      1.  First, perform a web search to find a clear explanation of the "Builder Pattern" in the Rust programming language.
      2.  Second, write the key concepts of the Builder Pattern you found into a file named "${tempFilePath}".
      3.  Third, read the content of the file "${tempFilePath}".
      4.  Fourth, parse the content of that file to extract the core principles of the Builder Pattern.
      5.  Finally, using the parsed principles as your primary specification, write a new, simple, and complete Rust code example that implements the Builder Pattern for a 'Computer' struct with fields for 'cpu' (String) and 'ram_gb' (u32). Save this code into a file named "${finalCodePath}".
    `;

    console.log('🎯 Starting tool chain stress test task...\n');
    const result = await agent.run(stressTestTask);

    if (result.success) {
      console.log('✅ AGENT EXECUTION SUCCEEDED');
    } else {
      console.error('❌ AGENT EXECUTION FAILED');
      console.error(`   Error: ${result.error}`);
    }

    console.log('\n🔍 Verifying final output file...');

    // Verify that the final code file was created and has valid content
    try {
      const finalCode = await fs.readFile(finalCodePath, 'utf-8');
      console.log('✅ Final code file created successfully.');
      console.log('--- FINAL CODE ---');
      console.log(finalCode);
      console.log('------------------');

      const lowerCaseCode = finalCode.toLowerCase();
      if (
        !lowerCaseCode.includes('struct computer') ||
        !lowerCaseCode.includes('struct computerbuilder') ||
        !lowerCaseCode.includes('cpu: string') ||
        !lowerCaseCode.includes('ram_gb: u32') ||
        !lowerCaseCode.includes('impl computerbuilder')
      ) {
        throw new Error('The generated Rust code does not seem to implement the Builder Pattern for a Computer correctly.');
      }
      console.log('✅ Final code content is valid.');
    } catch (error) {
      console.error('❌ Final code file verification failed.', error);
      throw error;
    }

  } catch (error: any) {
    console.error('\n💥 Test execution failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    // Clean up the created files
    await fs.rm(tempFilePath, { force: true });
    await fs.rm(finalCodePath, { force: true });
    console.log('\n🧹 Cleaned up temporary files.');
  }
}

// Execute the test
runStdToolsStressTest()
  .then(() => {
    console.log('\n✨ Standard Tools Stress Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Standard Tools Stress Test failed:', error);
    process.exit(1);
  }); 