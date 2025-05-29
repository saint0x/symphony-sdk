/**
 * Symphony SDK Custom Tools Practice
 * Testing the newly published symphonic package!
 */

import { Symphony } from './src/symphony';

async function practiceCustomTools() {
    console.log('🎼 Symphony SDK Custom Tools Practice\n');
    
    // Initialize Symphony with proper configuration
    const symphony = new Symphony({
        llm: {
            model: 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
        },
        db: {
            enabled: true,
            adapter: 'sqlite',
            path: './practice.db'
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
    console.log('✅ Symphony initialized!\n');
    
    // 🔧 Custom Tool 1: Weather Checker
    console.log('🌤️ Creating Weather Checker Tool...');
    const weatherTool = await symphony.tool.create({
        name: 'weatherChecker',
        description: 'Check weather conditions for any city',
        inputs: ['city'],
        handler: async (params: any) => {
            const { city = 'New York' } = params;
            // Simulated weather API call
            const conditions = ['Sunny', 'Cloudy', 'Rainy', 'Snowy', 'Foggy'];
            const temps = [65, 72, 58, 45, 68];
            const randomIndex = Math.floor(Math.random() * conditions.length);
            
            return {
                success: true,
                result: {
                    city,
                    condition: conditions[randomIndex],
                    temperature: temps[randomIndex],
                    humidity: Math.floor(Math.random() * 40) + 40
                }
            };
        }
    });
    
    // 🔧 Custom Tool 2: Code Formatter
    console.log('📝 Creating Code Formatter Tool...');
    const codeFormatterTool = await symphony.tool.create({
        name: 'codeFormatter',
        description: 'Format and beautify code snippets',
        inputs: ['code', 'language'],
        handler: async (params: any) => {
            const { code, language = 'javascript' } = params;
            if (!code) {
                return { 
                    success: false, 
                    error: new Error('No code provided')
                };
            }
            
            // Simple formatting simulation
            const formatted = code
                .split('\n')
                .map((line: string) => line.trim())
                .filter((line: string) => line.length > 0)
                .map((line: string, index: number) => {
                    const indent = line.startsWith('}') || line.startsWith(')') ? '' : '  ';
                    return `${indent}${line}`;
                })
                .join('\n');
            
            return {
                success: true,
                result: {
                    original: code,
                    formatted,
                    language,
                    lines: formatted.split('\n').length
                }
            };
        }
    });
    
    // 🔧 Custom Tool 3: Data Validator
    console.log('✅ Creating Data Validator Tool...');
    const validatorTool = await symphony.tool.create({
        name: 'dataValidator',
        description: 'Validate data structures and formats',
        inputs: ['data', 'schema'],
        handler: async (params: any) => {
            const { data } = params;
            
            if (!data) {
                return { 
                    success: false, 
                    error: new Error('No data provided')
                };
            }
            
            // Simple validation simulation
            const validationResults = {
                isValid: true,
                errors: [] as string[],
                warnings: [] as string[],
                fieldCount: 0
            };
            
            if (typeof data === 'object') {
                validationResults.fieldCount = Object.keys(data).length;
                
                // Check for common issues
                if (validationResults.fieldCount === 0) {
                    validationResults.isValid = false;
                    validationResults.errors.push('Empty object');
                }
                
                // Check for null values
                Object.entries(data).forEach(([key, value]) => {
                    if (value === null || value === undefined) {
                        validationResults.warnings.push(`Field '${key}' is null/undefined`);
                    }
                });
            }
            
            return {
                success: true,
                result: validationResults
            };
        }
    });
    
    console.log('\n🤖 Creating Specialized Agent with Custom Tools...');
    
    // Create an agent with our custom tools
    const toolAgent = await symphony.agent.create({
        name: 'CustomToolAgent',
        description: 'An agent specialized in using custom utility tools',
        task: 'Help users with weather, code formatting, and data validation',
        tools: ['weatherChecker', 'codeFormatter', 'dataValidator'],
        llm: {
            model: 'gpt-4o-mini',
            temperature: 0.7
        }
    });
    
    console.log('✅ Agent created with custom tools!\n');
    
    // 🧪 Test the custom tools
    console.log('🧪 Testing Custom Tools:\n');
    
    // Test Weather Tool
    console.log('1️⃣ Testing Weather Checker...');
    const weatherResult = await weatherTool.run({ city: 'San Francisco' });
    if (weatherResult.success) {
        console.log('   Weather Result:', JSON.stringify(weatherResult.result, null, 2));
    } else {
        console.log('   Weather Error:', weatherResult.error?.message);
    }
    
    // Test Code Formatter
    console.log('\n2️⃣ Testing Code Formatter...');
    const messyCode = `function hello(){console.log("hello world");return true;}`;
    const codeResult = await codeFormatterTool.run({ code: messyCode, language: 'javascript' });
    if (codeResult.success) {
        console.log('   Formatted Code:');
        console.log(`   ${codeResult.result.formatted.split('\n').join('\n   ')}`);
    } else {
        console.log('   Code Formatter Error:', codeResult.error?.message);
    }
    
    // Test Data Validator
    console.log('\n3️⃣ Testing Data Validator...');
    const testData = { name: 'John', age: 30, email: null };
    const validationResult = await validatorTool.run({ data: testData });
    if (validationResult.success) {
        console.log('   Validation Result:', JSON.stringify(validationResult.result, null, 2));
    } else {
        console.log('   Validation Error:', validationResult.error?.message);
    }
    
    // Test Agent with multiple tools
    console.log('\n🤖 Testing Agent with Custom Tools...');
    try {
        const agentResult = await toolAgent.run(
            'Check the weather in Tokyo and validate this data: {"temperature": 25, "humidity": null}'
        );
        if (agentResult.success) {
            console.log('   Agent Result:', agentResult.result);
        } else {
            console.log('   Agent Error:', agentResult.error?.message);
        }
    } catch (error) {
        console.log('   Agent Execution Error:', error instanceof Error ? error.message : String(error));
    }
    
    console.log('\n🎉 Custom Tools Practice Complete!');
}

// Run the practice session
if (require.main === module) {
    practiceCustomTools().catch(console.error);
}

export { practiceCustomTools };