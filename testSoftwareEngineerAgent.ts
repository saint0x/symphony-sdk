/**
 * Symphony SDK: Software Engineer Agent Test
 * 
 * This test demonstrates a sophisticated software engineer agent that:
 * - Uses deep reflection (ponder) before making decisions
 * - Leverages custom code formatting tools for project structure
 * - Creates production-grade Rust applications
 * - Follows best practices and industry standards
 * - Demonstrates the full capability of Symphony's agent system
 */

import { Symphony } from './src/symphony';
import { ToolConfig, ToolResult, AgentConfig } from './src/types/sdk';
import path from 'path';
import fs from 'fs/promises';

// Custom Code Format Tool for Project Structure
const codeFormatTool: ToolConfig = {
  name: 'codeFormat',
  description: 'Analyzes project requirements and generates a structured project layout with best practices',
  type: 'code_structure',
  nlp: 'analyze project structure and format code layout',
  timeout: 30000,
  config: {
    inputSchema: {
      type: 'object',
      properties: {
        projectType: { type: 'string', description: 'Type of project (rust-cli, rust-cron, web-app, etc.)' },
        projectName: { type: 'string', description: 'Name of the project' },
        requirements: { type: 'array', items: { type: 'string' }, description: 'Project requirements' },
        targetDirectory: { type: 'string', description: 'Target directory for the project' }
      },
      required: ['projectType', 'projectName', 'requirements', 'targetDirectory']
    }
  },
  handler: async (params): Promise<ToolResult> => {
    const startTime = Date.now();
    try {
      const { projectType, projectName, requirements, targetDirectory } = params;
      
      console.log(`🏗️  Analyzing project structure for ${projectType}: ${projectName}`);
      
      // Generate project structure based on type and requirements
      let projectStructure: any = {};
      
      if (projectType === 'rust-cron') {
        projectStructure = {
          projectName,
          rootDirectory: targetDirectory,
          structure: {
            'Cargo.toml': {
              type: 'config',
              purpose: 'Rust package configuration with dependencies',
              priority: 1,
              dependencies: ['tokio', 'serde', 'clap', 'tracing', 'anyhow', 'config']
            },
            'src/': {
              type: 'directory',
              purpose: 'Source code directory',
              children: {
                'main.rs': {
                  type: 'entry',
                  purpose: 'Application entry point with CLI and cron scheduling',
                  priority: 2
                },
                'lib.rs': {
                  type: 'library',
                  purpose: 'Library exports and module definitions',
                  priority: 3
                },
                'scheduler/': {
                  type: 'directory',
                  purpose: 'Cron job scheduling logic',
                  children: {
                    'mod.rs': { type: 'module', purpose: 'Scheduler module exports' },
                    'cron.rs': { type: 'core', purpose: 'Cron expression parsing and execution' },
                    'job.rs': { type: 'core', purpose: 'Job definition and execution traits' }
                  }
                },
                'jobs/': {
                  type: 'directory',
                  purpose: 'Individual job implementations',
                  children: {
                    'mod.rs': { type: 'module', purpose: 'Jobs module exports' },
                    'example_job.rs': { type: 'example', purpose: 'Example job implementation' }
                  }
                },
                'config/': {
                  type: 'directory',
                  purpose: 'Configuration management',
                  children: {
                    'mod.rs': { type: 'module', purpose: 'Config module exports' },
                    'settings.rs': { type: 'core', purpose: 'Configuration structure and loading' }
                  }
                },
                'error.rs': {
                  type: 'core',
                  purpose: 'Custom error types and handling',
                  priority: 4
                }
              }
            },
            'config/': {
              type: 'directory',
              purpose: 'Configuration files',
              children: {
                'default.toml': { type: 'config', purpose: 'Default configuration' },
                'production.toml': { type: 'config', purpose: 'Production configuration' }
              }
            },
            'tests/': {
              type: 'directory',
              purpose: 'Integration and unit tests',
              children: {
                'integration_test.rs': { type: 'test', purpose: 'Integration tests for cron functionality' }
              }
            },
            'scripts/': {
              type: 'directory',
              purpose: 'Build and deployment scripts',
              children: {
                'install.sh': { type: 'script', purpose: 'Installation script for production' },
                'setup-systemd.sh': { type: 'script', purpose: 'SystemD service setup' }
              }
            },
            'README.md': {
              type: 'documentation',
              purpose: 'Project documentation and usage instructions',
              priority: 5
            },
            '.gitignore': {
              type: 'config',
              purpose: 'Git ignore patterns for Rust projects',
              priority: 6
            },
            'Dockerfile': {
              type: 'container',
              purpose: 'Docker container configuration for deployment',
              priority: 7
            },
            'docker-compose.yml': {
              type: 'container',
              purpose: 'Docker Compose for development environment',
              priority: 8
            }
          },
          buildOrder: [
            'Cargo.toml',
            'src/main.rs',
            'src/lib.rs',
            'src/error.rs',
            'src/config/',
            'src/scheduler/',
            'src/jobs/',
            'config/',
            'tests/',
            'scripts/',
            'README.md',
            '.gitignore',
            'Dockerfile',
            'docker-compose.yml'
          ],
          productionConsiderations: [
            'Error handling with anyhow and custom error types',
            'Structured logging with tracing',
            'Configuration management with environment-specific configs',
            'Graceful shutdown handling',
            'Signal handling for process management',
            'Resource cleanup and memory management',
            'Comprehensive testing strategy',
            'Docker containerization for deployment',
            'SystemD service integration',
            'Monitoring and health checks',
            'Security considerations (user permissions, input validation)',
            'Performance optimization and resource limits'
          ]
        };
      }
      
      return {
        success: true,
        result: {
          projectStructure,
          recommendations: {
            architecture: `Well-structured ${projectType} with clear separation of concerns`,
            testingStrategy: 'Comprehensive unit and integration tests',
            deployment: 'Containerized deployment with SystemD integration',
            monitoring: 'Structured logging and health checks'
          }
        },
        metrics: {
          duration: Date.now() - startTime,
          startTime,
          endTime: Date.now()
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Code format analysis failed: ${error.message}`,
        metrics: {
          duration: Date.now() - startTime,
          startTime,
          endTime: Date.now()
        }
      };
    }
  }
};

// Software Engineer Agent Configuration
const softwareEngineerConfig: AgentConfig = {
  name: 'ProductionEngineer',
  description: 'Senior software engineer specializing in production-grade systems with deep architectural thinking',
  task: 'Create robust, scalable, and maintainable software systems with comprehensive testing and deployment strategies',
  tools: ['createPlan', 'codeFormat', 'ponder', 'writeCode', 'writeFile', 'readFile'],
  llm: {
    model: 'gpt-4o-mini',
    provider: 'openai',
    temperature: 0.7,
    maxTokens: 4000
  },
  systemPrompt: `You are a senior software engineer with 10+ years of experience building production systems.

CORE PRINCIPLES:
- Always think deeply before writing code
- Consider scalability, maintainability, and reliability
- Follow industry best practices and standards
- Write comprehensive tests and documentation
- Plan for deployment and operations

WORKFLOW:
1. DEEP ANALYSIS: Use 'ponder' tool to analyze requirements thoroughly
2. ARCHITECTURE: Use 'codeFormat' tool to design project structure
3. IMPLEMENTATION: Use 'writeCode' and 'writeFile' to implement solutions
4. VALIDATION: Review and refine the implementation

Focus on production-grade quality in everything you create.

- Use the ponder tool extensively for deep thinking before implementation.
- After designing a project structure with 'codeFormat', you MUST use the 'writeFile' or 'writeCode' tools to create every file and directory specified in that structure. Do not stop after the design phase.
- Always consider error handling, logging, and monitoring.
- Structure code for maintainability and testing.
- Include comprehensive documentation.
- Plan for deployment and operations from the start.
- Consider security implications in all design decisions.
`,
  
  capabilities: ['rust', 'system-design', 'production-deployment', 'testing', 'architecture'],
  maxCalls: 15,
  timeout: 600000, // 10 minutes for complex projects
  enableCache: true,
  enableStreaming: true,
  
  streamOptions: {
    updateInterval: 2000,
    includeIntermediateSteps: true
  },
  
  log: {
    inputs: true,
    outputs: true,
    llmCalls: true,
    toolCalls: true
  }
};

async function runSoftwareEngineerTest() {
  console.log('🚀 Starting Software Engineer Agent Test');
  console.log('=============================================\n');

  try {
    // Initialize Symphony
    const symphony = new Symphony({
      llm: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey: process.env.OPENAI_API_KEY || ''
      },
      db: { enabled: false }, // Use in-memory for testing
      runtime: {
        enhancedRuntime: true,
        planningThreshold: 'complex',
        reflectionEnabled: true,
        maxStepsPerPlan: 10
      },
      streaming: {
        enableRealTimeUpdates: true,
        progressUpdateInterval: 1000
      },
      serviceRegistry: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000
      },
      metrics: {
        enabled: true,
        detailed: true
      }
    });

    await symphony.initialize();
    console.log('✅ Symphony SDK initialized successfully\n');

    // Register custom code format tool
    await symphony.tool.create(codeFormatTool);
    console.log('✅ Custom codeFormat tool registered\n');

    // Create the software engineer agent
    const agent = await symphony.agent.create(softwareEngineerConfig);
    console.log('✅ Software Engineer agent created\n');

    // Ensure target directory exists
    const targetDir = './cron-job';
    try {
      await fs.access(targetDir);
      console.log('📁 Target directory exists, cleaning up...');
      await fs.rmdir(targetDir, { recursive: true });
    } catch (error) {
      // Directory doesn't exist, which is fine
    }

    console.log('🎯 Starting project creation task...\n');

    // Set up progress tracking
    const startTime = Date.now();
    let stepCount = 0;

    // Create comprehensive task for the agent
    const projectTask = `
Create a production-grade Rust cron job application in the './cron-job' directory with the following requirements:

PROJECT REQUIREMENTS:
1. A robust cron job scheduler that can execute multiple jobs
2. Configuration-driven job definitions (TOML configuration files)
3. Comprehensive error handling and logging
4. Graceful shutdown handling with signal management
5. Docker containerization for deployment
6. SystemD service integration
7. Health check endpoints
8. Comprehensive testing suite
9. Production deployment scripts

TECHNICAL REQUIREMENTS:
- Use Tokio for async runtime
- Implement proper error handling with custom error types
- Use structured logging with tracing
- Support for different cron expression formats
- Job isolation and resource management
- Configuration hot-reloading
- Metrics and monitoring capabilities

QUALITY REQUIREMENTS:
- Production-grade code quality
- Comprehensive documentation
- Full test coverage
- Security best practices
- Performance optimization
- Operational excellence

PROCESS:
1. First, use the 'ponder' tool to deeply analyze the requirements and plan the architecture
2. Use the 'codeFormat' tool to design the project structure
3. Implement each component with careful consideration
4. Create comprehensive tests and documentation
5. Ensure production readiness

Take your time and think deeply about each decision. This should be a reference implementation for production cron job systems.
`;

    // Execute the task with progress tracking
    const result = await agent.run(projectTask);

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n🎉 Project creation completed in ${totalTime} seconds!`);
    console.log('=================================================\n');

    if (result.success) {
      console.log('✅ AGENT EXECUTION SUCCESSFUL');
      console.log('\n📋 Execution Summary:');
      console.log(`   • Response: ${result.result?.response?.substring(0, 200)}...`);
      console.log(`   • Tools Used: ${result.result?.toolsExecuted?.length || 0}`);
      
      if (result.result?.toolsExecuted) {
        console.log('\n🔧 Tools Executed:');
        result.result.toolsExecuted.forEach((tool: any, index: number) => {
          console.log(`   ${index + 1}. ${tool.toolName} - ${tool.success ? '✅' : '❌'}`);
          if (!tool.success) {
            console.log(`      Error: ${tool.error}`);
          }
        });
      }

      // Verify project structure was created
      try {
        const projectStats = await fs.stat(targetDir);
        if (projectStats.isDirectory()) {
          console.log('\n📁 Project Directory Created Successfully');
          
          // List created files
          const listFiles = async (dir: string, prefix = ''): Promise<void> => {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
              if (item.isDirectory()) {
                console.log(`${prefix}📂 ${item.name}/`);
                await listFiles(path.join(dir, item.name), prefix + '  ');
              } else {
                const stats = await fs.stat(path.join(dir, item.name));
                const size = stats.size;
                console.log(`${prefix}📄 ${item.name} (${size} bytes)`);
              }
            }
          };
          
          await listFiles(targetDir, '   ');
        }
      } catch (error) {
        console.log('⚠️  Project directory verification failed:', error);
      }

    } else {
      console.log('❌ AGENT EXECUTION FAILED');
      console.log(`   Error: ${result.error}`);
      if (result.result?.toolsExecuted) {
        console.log('\n🔧 Tools Attempted:');
        result.result.toolsExecuted.forEach((tool: any, index: number) => {
          console.log(`   ${index + 1}. ${tool.toolName} - ${tool.success ? '✅' : '❌'}`);
          if (!tool.success) {
            console.log(`      Error: ${tool.error}`);
          }
        });
      }
    }

    // Performance metrics
    if (result.metrics) {
      console.log('\n📊 Performance Metrics:');
      console.log(`   • Total Duration: ${result.metrics.totalDuration}ms`);
      console.log(`   • LLM Calls: ${result.metrics.llmCalls || 0}`);
      console.log(`   • Tool Calls: ${result.metrics.toolCalls || 0}`);
      const successRate = (result.metrics.totalOperations > 0) 
        ? ((result.metrics.successfulOperations / result.metrics.totalOperations) * 100).toFixed(1) 
        : '100.0';
      console.log(`   • Success Rate: ${successRate}%`);
    }

    console.log('\n🎯 Test completed successfully!');
    
  } catch (error: any) {
    console.error('\n💥 Test execution failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Execute the test
console.log('🧪 Symphony SDK: Software Engineer Agent Test');
console.log('Testing sophisticated agent capabilities with custom tooling\n');

runSoftwareEngineerTest()
  .then(() => {
    console.log('\n✨ Software Engineer Agent test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Software Engineer Agent test failed:', error);
    process.exit(1);
  }); 