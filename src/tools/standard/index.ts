import { ToolConfig, ToolResult } from '../../types/sdk';
import { readFileTool } from './tools/read-file';
import { writeFileTool } from './tools/write-file';
import { webSearchTool } from './tools/web-search';
import { parseDocumentTool } from './tools/parse-document';
import { writeCodeTool } from './tools/write-code';
import { createPlanTool } from './tools/create-plan';
import { ponderTool } from './tools/ponder';

// Standard tool configurations
export const standardTools: ToolConfig[] = [
    // File System Tools
    readFileTool,
    writeFileTool,
    
    // Search Tools
    webSearchTool,
    
    // Document Tools
    parseDocumentTool,
    
    // Code Tools
    writeCodeTool,
    
    // Planning Tools
    createPlanTool,
    
    // Cognitive Tools
    ponderTool
];

// Export individual tools
export {
    // File System Tools
    readFileTool,
    writeFileTool,
    
    // Search Tools
    webSearchTool,
    
    // Document Tools
    parseDocumentTool,
    
    // Code Tools
    writeCodeTool,
    
    // Planning Tools
    createPlanTool,
    
    // Cognitive Tools
    ponderTool
};

export async function handleError(error: Error): Promise<ToolResult<any>> {
    return {
        success: false,
        error: error.message,
        metrics: {
            duration: 0,
            startTime: Date.now(),
            endTime: Date.now()
        }
    };
} 