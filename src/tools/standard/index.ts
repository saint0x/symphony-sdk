import { ToolConfig, ToolResult } from '../../types/sdk';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import { getCache } from '../../cache';
import { validateSchema } from '../../utils/validation';

// Standard tool configurations
export const standardTools: ToolConfig[] = [{
    name: 'readFileTool',
    description: 'Read content from a file',
    inputs: ['path'],
    outputs: ['content', 'metadata'],
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
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }
}, {
    name: 'writeFileTool',
    description: 'Write content to a file',
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
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }
}, {
    name: 'webSearchTool',
    description: 'Search the web using Serper.dev',
    inputs: ['query', 'type?'],
    handler: async (params: any): Promise<ToolResult<any>> => {
        const cache = getCache();
        
        try {
            validateSchema(params, {
                query: { type: 'string', required: true },
                type: { type: 'string', enum: ['search', 'news', 'images'] }
            });

            const cacheKey = `search:${params.query}:${params.type || 'search'}`;
            const cached = await cache.get(cacheKey);
            if (cached) {
                return {
                    success: true,
                    result: { results: cached }
                };
            }

            const response = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': process.env.SERPER_API_KEY || ''
                },
                body: JSON.stringify({ 
                    q: params.query, 
                    type: params.type || 'search' 
                })
            });

            const results = await response.json();
            await cache.set(cacheKey, results);

            return {
                success: true,
                result: { results }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    },
    cache: {
        enabled: true,
        ttl: 3600,
        maxSize: 1000
    },
    retry: {
        enabled: true,
        maxAttempts: 3,
        delay: 1000,
        retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED']
    }
}]; 