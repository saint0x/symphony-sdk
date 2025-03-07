import { symphony } from '../../src';
import { logger } from '../../src/utils/logger';

// Create the tools exactly as shown in EXAMPLE.md
const fetchTool = await symphony.tools.create({
    name: "fetch",
    description: "fetches raw data from source",
    inputs: ["source"],
    chained: 1,
    target: "clean",
    handler: async (params) => {
        const { source } = params;
        logger.debug('Fetch tool executing', { 
            metadata: { source } 
        });
        // Simulate fetching data
        const rawData = `Sample data from ${source}`;
        return { result: rawData, success: true };
    }
});

const cleanTool = await symphony.tools.create({
    name: "clean",
    description: "cleans raw data",
    inputs: ["data"],
    chained: 2.1,
    target: "validate",
    handler: async (params) => {
        const { data } = params;
        logger.debug('Clean tool executing', { 
            metadata: { dataLength: data.length } 
        });
        // Simulate cleaning data
        const cleanData = data.replace(/[^a-zA-Z0-9\s]/g, '');
        return { result: cleanData, success: true };
    }
});

const validateTool = await symphony.tools.create({
    name: "validate",
    description: "validates cleaned data",
    inputs: ["data"],
    chained: 2.2,
    target: "transform",
    handler: async (params) => {
        const { data } = params;
        logger.debug('Validate tool executing', { 
            metadata: { dataLength: data.length } 
        });
        // Simulate validation
        const isValid = data.length > 0;
        if (!isValid) {
            logger.warn('Validation failed - empty data');
        }
        return { 
            result: isValid ? data : null, 
            success: isValid 
        };
    }
});

const transformTool = await symphony.tools.create({
    name: "transform",
    description: "transforms valid data",
    inputs: ["data"],
    chained: 2.3,
    target: "format",
    handler: async (params) => {
        const { data } = params;
        logger.debug('Transform tool executing', { 
            metadata: { dataLength: data.length } 
        });
        // Simulate transformation
        const transformed = data.toUpperCase();
        return { result: transformed, success: true };
    }
});

const formatTool = await symphony.tools.create({
    name: "format",
    description: "formats final output",
    inputs: ["data"],
    chained: 3,
    handler: async (params) => {
        const { data } = params;
        logger.debug('Format tool executing', { 
            metadata: { dataLength: data.length } 
        });
        // Simulate formatting
        const formatted = {
            content: data,
            timestamp: new Date().toISOString(),
            metadata: {
                length: data.length,
                type: 'text'
            }
        };
        return { result: formatted, success: true };
    }
});

// Test harness
export class ExampleTester {
    private initialized: Promise<void>;

    constructor() {
        logger.debug('ExampleTester constructor called');
        this.initialized = this.initialize();
    }

    private async initialize() {
        logger.info('Initializing test tools');
        // Register all tools
        await fetchTool.register();
        await cleanTool.register();
        await validateTool.register();
        await transformTool.register();
        await formatTool.register();
        logger.info('All test tools registered successfully');
    }

    async testDataPipeline() {
        logger.info('Starting data pipeline test');
        
        // Wait for initialization to complete
        await this.initialized;
        logger.debug('Initialization completed, starting pipeline execution');

        // Test fetch
        logger.debug('Testing fetch tool');
        const fetchResult = await fetchTool.run({ source: "test.csv" });
        logger.info('Fetch completed', { 
            metadata: { success: fetchResult.success } 
        });

        // Test clean
        logger.debug('Testing clean tool');
        const cleanResult = await cleanTool.run({ data: fetchResult.result });
        logger.info('Clean completed', { 
            metadata: { success: cleanResult.success } 
        });

        // Test validate
        logger.debug('Testing validate tool');
        const validateResult = await validateTool.run({ data: cleanResult.result });
        logger.info('Validate completed', { 
            metadata: { success: validateResult.success } 
        });

        // Test transform
        logger.debug('Testing transform tool');
        const transformResult = await transformTool.run({ data: validateResult.result });
        logger.info('Transform completed', { 
            metadata: { success: transformResult.success } 
        });

        // Test format
        logger.debug('Testing format tool');
        const formatResult = await formatTool.run({ data: transformResult.result });
        logger.info('Format completed', { 
            metadata: { success: formatResult.success } 
        });

        return formatResult;
    }
} 