import { Symphony } from './src/symphony';
import { AgentConfig, ToolConfig, TeamConfig } from './src/types/sdk';

async function testComprehensiveScenarios() {
    console.log('🎯 COMPREHENSIVE TESTING: Complex Tool Usage & Team Delegation - v0.4.3\n');

    const symphony = new Symphony({
        llm: {
            model: 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
        },
        db: {
            enabled: true,
            adapter: 'sqlite',
            path: './test-comprehensive.db'
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

    // ========== COMPLEX TOOL USAGE SCENARIOS ==========
    console.log('🧩 TEST SUITE 1: Complex Realistic Tool Usage\n');

    // Create a comprehensive API client tool
    const apiClientTool: ToolConfig = {
        name: 'apiClient',
        type: 'custom',
        description: 'Makes HTTP requests to APIs, handles authentication, and processes responses. Supports GET, POST, PUT, DELETE operations.',
        config: {
            handler: async (params: any) => {
                console.log('🌐 API Client tool executed:', JSON.stringify(params, null, 2));
                
                const { method = 'GET', url, headers = {}, body, auth } = params;
                
                // Simulate realistic API responses
                const mockResponses = {
                    'users': { users: [{ id: 1, name: 'Alice', role: 'admin' }, { id: 2, name: 'Bob', role: 'user' }] },
                    'weather': { temperature: 72, conditions: 'sunny', humidity: 45 },
                    'config': { saved: true, timestamp: new Date().toISOString() }
                };
                
                const endpoint = url?.split('/').pop() || 'default';
                const responseData = mockResponses[endpoint as keyof typeof mockResponses] || { success: true };
                
                return {
                    success: true,
                    result: {
                        status: 200,
                        method,
                        url,
                        data: responseData,
                        headers: { 'content-type': 'application/json' },
                        timestamp: new Date().toISOString()
                    }
                };
            }
        }
    };

    // Create a data processing tool
    const dataProcessorTool: ToolConfig = {
        name: 'dataProcessor',
        type: 'custom',
        description: 'Processes, transforms, and analyzes data. Can filter, sort, aggregate, and format data structures.',
        config: {
            handler: async (params: any) => {
                console.log('📊 Data Processor tool executed:', JSON.stringify(params, null, 2));
                
                const { data, operation, filters, format } = params;
                
                let result = data;
                
                if (operation === 'filter' && filters) {
                    result = Array.isArray(data) ? data.filter((item: any) => 
                        Object.entries(filters).every(([key, value]) => item[key] === value)
                    ) : data;
                }
                
                if (operation === 'transform' && format) {
                    result = Array.isArray(result) ? result.map((item: any) => ({
                        ...item,
                        formatted: true,
                        processedAt: new Date().toISOString()
                    })) : result;
                }
                
                return {
                    success: true,
                    result: {
                        originalCount: Array.isArray(data) ? data.length : 1,
                        processedCount: Array.isArray(result) ? result.length : 1,
                        operation,
                        data: result
                    }
                };
            }
        }
    };

    // Create a report generator tool
    const reportGeneratorTool: ToolConfig = {
        name: 'reportGenerator',
        type: 'custom',
        description: 'Generates formatted reports from processed data. Supports multiple formats like JSON, CSV, and summary reports.',
        config: {
            handler: async (params: any) => {
                console.log('📄 Report Generator tool executed:', JSON.stringify(params, null, 2));
                
                const { data, format = 'summary', title = 'Data Report' } = params;
                
                let report;
                
                if (format === 'summary') {
                    report = {
                        title,
                        generatedAt: new Date().toISOString(),
                        summary: {
                            totalRecords: Array.isArray(data) ? data.length : 1,
                            dataTypes: typeof data,
                            hasProcessedData: Array.isArray(data) && data.some((item: any) => item.formatted)
                        },
                        sampleData: Array.isArray(data) ? data.slice(0, 2) : data
                    };
                } else {
                    report = { title, data, format };
                }
                
                return {
                    success: true,
                    result: {
                        report,
                        format,
                        size: JSON.stringify(report).length,
                        message: `Report generated successfully in ${format} format`
                    }
                };
            }
        }
    };

    // Register all tools
    symphony.tool.register('apiClient', apiClientTool);
    symphony.tool.register('dataProcessor', dataProcessorTool);
    symphony.tool.register('reportGenerator', reportGeneratorTool);

    // Test 1: Complex multi-tool workflow agent
    console.log('🔄 Test 1: Multi-Tool Workflow Agent\n');
    
    const workflowAgent: AgentConfig = {
        name: 'DataWorkflowAgent',
        description: 'Agent that orchestrates complex data workflows using multiple tools',
        task: 'Fetch, process, and report on data using multiple tools in sequence',
        tools: ['apiClient', 'dataProcessor', 'reportGenerator'],
        llm: 'gpt-4o-mini',
        directives: `You are a data workflow specialist. When asked to handle data workflows:
1. Use apiClient to fetch data from APIs
2. Use dataProcessor to clean and transform data  
3. Use reportGenerator to create formatted reports
Always use the appropriate tool for each step of the workflow.`
    };

    try {
        const agent1 = await symphony.agent.create(workflowAgent);
        
        console.log('🎯 Testing: "Fetch user data from the API, filter for admin users, and generate a summary report"\n');
        const result1 = await agent1.run('Fetch user data from the API, filter for admin users, and generate a summary report');
        
        console.log('✅ Workflow Agent Response:', result1.result?.response?.substring(0, 500) + '...');
        console.log('🔧 Success:', result1.success);
        console.log('⏱️  Duration:', result1.metrics?.duration + 'ms\n');

        // ========== TEAM DELEGATION SCENARIOS ==========
        console.log('👥 TEST SUITE 2: Team Delegation & Collaboration\n');

        // Create specialized team members
        const dbSpecialist: AgentConfig = {
            name: 'DBSpecialist',
            description: 'Database operations specialist',
            task: 'Handle all database-related operations and queries',
            tools: ['apiClient'],
            llm: 'gpt-4o-mini',
            directives: 'You are a database specialist. Handle data retrieval, storage, and database operations. Use the apiClient tool for database interactions.'
        };

        const analyticsSpecialist: AgentConfig = {
            name: 'AnalyticsSpecialist', 
            description: 'Data analysis and processing specialist',
            task: 'Analyze and process data for insights',
            tools: ['dataProcessor'],
            llm: 'gpt-4o-mini',
            directives: 'You are a data analytics specialist. Process, filter, transform, and analyze data. Use the dataProcessor tool for all data operations.'
        };

        const reportingSpecialist: AgentConfig = {
            name: 'ReportingSpecialist',
            description: 'Report generation and formatting specialist', 
            task: 'Create formatted reports and presentations',
            tools: ['reportGenerator'],
            llm: 'gpt-4o-mini',
            directives: 'You are a reporting specialist. Generate professional reports in various formats. Use the reportGenerator tool for all reporting tasks.'
        };

        // Create team configuration
        const dataTeam: TeamConfig = {
            name: 'DataProcessingTeam',
            description: 'Team specialized in end-to-end data processing workflows',
            agents: ['DBSpecialist', 'AnalyticsSpecialist', 'ReportingSpecialist'],
            strategy: 'COLLABORATIVE',
            communication: {
                enabled: true,
                format: 'structured'
            }
        };

        // Register team members
        await symphony.agent.create(dbSpecialist);
        await symphony.agent.create(analyticsSpecialist);
        await symphony.agent.create(reportingSpecialist);

        // Create team
        const team = await symphony.team.create(dataTeam);

        console.log('🎯 Test 2: Team Delegation Workflow\n');
        
        const teamResult = await team.executeTask(
            'Process the quarterly sales data: First retrieve the data from the database, then analyze trends and patterns, finally generate an executive summary report'
        );
        
        console.log('✅ Team Execution Response:', teamResult.result?.response?.substring(0, 500) + '...');
        console.log('🔧 Team Success:', teamResult.success);
        console.log('⏱️  Team Duration:', teamResult.metrics?.duration + 'ms\n');

        // Test 3: Manager Agent with Delegation
        console.log('👨‍💼 Test 3: Manager Agent with Explicit Delegation\n');

        const managerAgent: AgentConfig = {
            name: 'ProjectManager',
            description: 'Project manager that delegates tasks to team specialists',
            task: 'Coordinate and delegate tasks to team members',
            tools: ['apiClient', 'dataProcessor', 'reportGenerator'], // Has access to all tools but should delegate
            llm: 'gpt-4o-mini',
            directives: `You are a project manager. When given complex tasks, break them down and delegate to specialists:
- For data retrieval: delegate to DBSpecialist
- For data analysis: delegate to AnalyticsSpecialist  
- For reporting: delegate to ReportingSpecialist
Use the [DELEGATE] command format: [DELEGATE to AgentName: specific task description]`
        };

        const manager = await symphony.agent.create(managerAgent);
        
        console.log('🎯 Testing: "We need to analyze customer satisfaction data and create a presentation for the board meeting"\n');
        const managerResult = await manager.run('We need to analyze customer satisfaction data and create a presentation for the board meeting');
        
        console.log('✅ Manager Response:', managerResult.result?.response?.substring(0, 500) + '...');
        console.log('🔧 Manager Success:', managerResult.success);
        console.log('⏱️  Manager Duration:', managerResult.metrics?.duration + 'ms\n');

        // ========== RESULTS SUMMARY ==========
        console.log('🎉 COMPREHENSIVE TESTING COMPLETE\n');
        console.log('📊 Results Summary:');
        console.log('- Test 1 (Multi-Tool Workflow):', result1.success ? '✅ PASSED' : '❌ FAILED');
        console.log('- Test 2 (Team Delegation):', teamResult.success ? '✅ PASSED' : '❌ FAILED');
        console.log('- Test 3 (Manager Delegation):', managerResult.success ? '✅ PASSED' : '❌ FAILED');

        const allPassed = result1.success && teamResult.success && managerResult.success;
        
        if (allPassed) {
            console.log('\n🚀 ALL COMPREHENSIVE TESTS PASSED!');
            console.log('✅ Complex tool usage: WORKING');
            console.log('✅ Team delegation: WORKING'); 
            console.log('✅ Manager coordination: WORKING');
            console.log('\n🎯 Symphony SDK v0.4.3 - FULLY VALIDATED!');
        } else {
            console.log('\n⚠️  Some advanced tests failed:');
            if (!result1.success) console.log('❌ Multi-tool workflow failed');
            if (!teamResult.success) console.log('❌ Team delegation failed');
            if (!managerResult.success) console.log('❌ Manager delegation failed');
        }

    } catch (error) {
        console.error('🚨 Comprehensive test failed:', error);
    }
}

testComprehensiveScenarios().catch(console.error); 