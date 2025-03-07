import { ToolConfig } from '../../types/sdk';
import { Symphony } from '../core/symphony';
import { logger, LogCategory } from '../../utils/logger';
import { globalMetrics } from '../../utils/metrics';
import { validateConfig } from '../../utils/validation';
import { readFile, writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import path from 'path';

export class ToolService {
    constructor(private symphony: Symphony) {}

    async create(config: ToolConfig): Promise<any> {
        // Validate tool config
        const validation = validateConfig(config, {
            name: { type: 'string', required: true },
            description: { type: 'string', required: true },
            inputs: { type: 'object', required: true },
            handler: { type: 'function', required: true }
        });

        if (!validation.isValid) {
            throw new Error(`Invalid tool configuration: ${validation.errors.join(', ')}`);
        }

        this.validateChaining(config);

        // Start tool creation metrics
        const metricId = `tool_create_${config.name}`;
        globalMetrics.start(metricId, { toolName: config.name });

        try {
            const registry = await this.symphony.getRegistry();
            const tool = await registry.createTool(config);
            
            globalMetrics.end(metricId, { success: true });
            return tool;
        } catch (error) {
            globalMetrics.end(metricId, { success: false, error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    private validateChaining(config: ToolConfig) {
        if (config.chained) {
            // Type 1: Initial tools (1)
            // Type 2: Intermediary tools (2.x)
            // Type 3: Final tools (3)
            if (![1, 3].includes(config.chained) && 
                !/^2\.\d+$/.test(String(config.chained))) {
                throw new Error('Invalid chaining number. Must be 1, 2.x, or 3');
            }
        }
    }

    async initializeStandardTools(): Promise<void> {
        try {
            // File System Tools
            await this.create({
                name: 'readFile',
                description: 'Read file contents',
                inputs: ['path'],
                handler: async ({ path: filePath }) => {
                    try {
                        const content = await readFile(filePath, 'utf-8');
                        return { success: true, result: { content } };
                    } catch (error) {
                        return { 
                            success: false, 
                            result: null, 
                            error: error instanceof Error ? error : new Error(String(error))
                        };
                    }
                }
            });

            await this.create({
                name: 'writeFile',
                description: 'Write content to file',
                inputs: ['path', 'content'],
                handler: async ({ path: filePath, content }) => {
                    try {
                        await writeFile(filePath, content);
                        return { success: true, result: { written: true } };
                    } catch (error) {
                        return { 
                            success: false, 
                            result: null, 
                            error: error instanceof Error ? error : new Error(String(error))
                        };
                    }
                }
            });

            // Search Tools
            await this.create({
                name: 'webSearch',
                description: 'Search the web using Serper.dev',
                inputs: ['query', 'type?'],
                handler: async ({ query, type = 'search' }) => {
                    try {
                        const response = await fetch('https://google.serper.dev/search', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-KEY': process.env.SERPER_API_KEY || ''
                            },
                            body: JSON.stringify({ q: query, type })
                        });
                        const results = await response.json();
                        return { success: true, result: { results } };
                    } catch (error) {
                        return { 
                            success: false, 
                            result: null, 
                            error: error instanceof Error ? error : new Error(String(error))
                        };
                    }
                }
            });

            // Document Tools
            await this.create({
                name: 'parseDocument',
                description: 'Parse document content',
                inputs: ['path', 'format?'],
                handler: async ({ path: filePath, format }) => {
                    try {
                        const content = await readFile(filePath, 'utf-8');
                        const ext = path.extname(filePath).toLowerCase();
                        const metadata = {
                            format: format || ext,
                            size: content.length,
                            path: filePath
                        };
                        return { 
                            success: true, 
                            result: { content, metadata } 
                        };
                    } catch (error) {
                        return { 
                            success: false, 
                            result: null, 
                            error: error instanceof Error ? error : new Error(String(error))
                        };
                    }
                }
            });

            logger.info(LogCategory.SYSTEM, 'Standard tools initialized');
        } catch (error) {
            logger.error(LogCategory.SYSTEM, 'Failed to initialize standard tools', {
                error
            });
            throw error;
        }
    }
} 