import { ToolConfig, ToolResult } from '../../../types/sdk';
import fs from 'fs/promises';
import path from 'path';
import { ValidationError } from '../../../errors/index';

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
            const { path: legacyPath, filePath: newPath, content, encoding = 'utf-8' } = params;
            const filePath = newPath || legacyPath;
            
            if (!filePath || content === undefined) {
                throw new ValidationError(
                    'Path (or filePath) and content parameters are required',
                    { provided: params, required: ['path', 'content'] },
                    { component: 'WriteFileTool', operation: 'execute' }
                );
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