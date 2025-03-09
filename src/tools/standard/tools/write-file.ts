import { ToolConfig, ToolResult } from '../../../types/sdk';
import fs from 'fs/promises';

export const writeFileTool: ToolConfig = {
    name: 'writeFileTool',
    description: 'Write content to a file',
    type: 'filesystem',
    config: {
        inputs: ['path', 'content'],
        outputs: ['success', 'error'],
        handler: async (params: any): Promise<ToolResult<any>> => {
            try {
                const { path, content } = params;
                if (!path || !content) {
                    throw new Error('Path and content parameters are required');
                }

                await fs.writeFile(path, content, 'utf-8');
                const stats = await fs.stat(path);

                return {
                    success: true,
                    result: {
                        path,
                        size: stats.size
                    }
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
    }
}; 