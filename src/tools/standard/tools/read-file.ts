import { ToolConfig, ToolResult } from '../../../types/sdk';
import fs from 'fs/promises';

export const readFileTool: ToolConfig = {
    name: 'readFileTool',
    description: 'Read content from a file',
    type: 'filesystem',
    nlp: 'read file * OR read the contents of * OR open file * OR get file contents from *',
    config: {
        inputs: ['path'],
        outputs: ['content', 'metadata'],
    },
    handler: async (params: any): Promise<ToolResult<any>> => {
        try {
            const { path } = params;
            if (!path) {
                throw new Error('Path parameter is required');
            }

            const content = await fs.readFile(path, 'utf-8');
            const stats = await fs.stat(path);

            return {
                success: true,
                result: {
                    content,
                    metadata: {
                        format: params.format || path.split('.').pop()?.toLowerCase() || '',
                        size: stats.size,
                        path,
                        type: 'file'
                    }
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}; 