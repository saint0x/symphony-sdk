import { readFile, writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import { ToolConfig } from '../../types/sdk';
import { createMetricsTracker } from '../../utils/metrics';
import { validateSchema } from '../../utils/validation';
import { getCache } from '../../cache';

// File System Tools
export const readFileTool: ToolConfig = {
    name: 'readFile',
    description: 'Read file contents',
    inputs: ['path'],
    handler: async (params) => {
        const metrics = createMetricsTracker();
        
        try {
            validateSchema(params, {
                path: { type: 'string', required: true }
            });

            const content = await readFile(params.path, 'utf-8');
            
            return {
                success: true,
                result: { content },
                metrics: metrics.end()
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                metrics: metrics.end()
            };
        }
    }
};

export const writeFileTool: ToolConfig = {
    name: 'writeFile',
    description: 'Write content to file',
    inputs: ['path', 'content'],
    handler: async (params) => {
        const metrics = createMetricsTracker();
        
        try {
            validateSchema(params, {
                path: { type: 'string', required: true },
                content: { type: 'string', required: true }
            });

            await writeFile(params.path, params.content);
            
            return {
                success: true,
                result: { written: true },
                metrics: metrics.end()
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                metrics: metrics.end()
            };
        }
    }
};

// Search Tools
export const webSearchTool: ToolConfig = {
    name: 'webSearch',
    description: 'Search the web using Serper.dev',
    inputs: ['query', 'type?'],
    handler: async (params) => {
        const metrics = createMetricsTracker();
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
                    result: { results: cached },
                    metrics: { ...metrics.end(), cacheHit: true }
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
                result: { results },
                metrics: metrics.end()
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                metrics: metrics.end()
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
};

// Document Tools
export const parseDocumentTool: ToolConfig = {
    name: 'parseDocument',
    description: 'Parse document content',
    inputs: ['path', 'format?'],
    handler: async (params) => {
        const metrics = createMetricsTracker();
        
        try {
            validateSchema(params, {
                path: { type: 'string', required: true },
                format: { type: 'string' }
            });

            const content = await readFile(params.path, 'utf-8');
            const ext = params.path.split('.').pop()?.toLowerCase() || '';
            
            let parsedContent;
            const metadata = {
                format: params.format || ext,
                size: content.length,
                path: params.path,
                type: ext.slice(1) || 'text'
            };

            switch (ext) {
                case 'json':
                    parsedContent = JSON.parse(content);
                    metadata.type = 'json';
                    break;
                case 'yaml':
                case 'yml':
                    // Add yaml parsing
                    break;
                case 'md':
                    // Add markdown parsing
                    break;
                default:
                    parsedContent = content;
                    metadata.type = 'text';
            }

            return {
                success: true,
                result: { content: parsedContent, metadata },
                metrics: metrics.end()
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                metrics: metrics.end()
            };
        }
    }
};

// Export all standard tools
export const standardTools: { [key: string]: ToolConfig } = {
    readFile: readFileTool,
    writeFile: writeFileTool,
    webSearch: webSearchTool,
    parseDocument: parseDocumentTool
};

export default standardTools; 