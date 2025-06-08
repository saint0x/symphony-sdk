import { ToolConfig, ToolResult } from '../../../types/sdk';
import fs from 'fs/promises';
import path from 'path';

export const writeFileTool: ToolConfig = {
    name: 'writeFileTool',
    description: 'Write content to a file, creating directories if needed',
    type: 'filesystem',
    config: {
        inputs: ['path', 'content', 'encoding'],
        outputs: ['success', 'error', 'path', 'size'],
    },
    handler: async (params: any): Promise<ToolResult<any>> => {
        try {
            const { path: filePath, content, encoding = 'utf-8' } = params;
            
            if (!filePath || content === undefined) {
                throw new Error('Path and content parameters are required');
            }

            // Ensure directory exists
            const dirPath = path.dirname(filePath);
            await fs.mkdir(dirPath, { recursive: true });

            // Write file
            await fs.writeFile(filePath, content, encoding);
            const stats = await fs.stat(filePath);

            console.log(`[WRITEFILE] Successfully wrote ${stats.size} bytes to ${filePath}`);

            return {
                success: true,
                result: {
                    path: filePath,
                    size: stats.size,
                    encoding,
                    message: `File written successfully to ${filePath}`
                }
            };
        } catch (error) {
            console.error(`[WRITEFILE] Failed to write file:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}; 