import { ToolConfig, ToolResult } from '../../../types/sdk';
import fs from 'fs/promises';
import { ValidationError } from '../../../errors/index';

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
            const { path: legacyPath, filePath: newPath } = params;
            const filePath = newPath || legacyPath;
            
            if (!filePath) {
                throw new ValidationError(
                    'Path (or filePath) parameter is required',
                    { provided: params, required: ['path'] },
                    { component: 'ReadFileTool', operation: 'execute' }
                );
            }

            const content = await fs.readFile(filePath, 'utf-8');
            const stats = await fs.stat(filePath);

            return {
                success: true,
                result: {
                    content,
                    metadata: {
                        format: params.format || filePath.split('.').pop()?.toLowerCase() || '',
                        size: stats.size,
                        path: filePath,
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