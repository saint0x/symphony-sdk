import { Tool, ToolResult } from '../interfaces/types';
import { Symphony } from '../core/symphony';
import { logger, LogCategory } from '../../utils/logger';
import { globalMetrics } from '../../utils/metrics';
import { validateConfig } from '../../utils/validation';
import { readFile, writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import path from 'path';
import {
    InferParamsFromInputs,
    InferHandlerReturnType,
    EnsureToolResult,
    ExtractResultType
} from '../utils/type-inference';

export class ToolService {
    constructor(private symphony: Symphony) {}

    create<
        TInputs extends readonly string[],
        THandler extends (params: InferParamsFromInputs<TInputs>) => Promise<ToolResult<any>>
    >(config: {
        name: string;
        description: string;
        inputs: TInputs;
        handler: THandler;
    }): Tool<InferParamsFromInputs<TInputs>, ExtractResultType<InferHandlerReturnType<THandler>>> {
        type TParams = InferParamsFromInputs<TInputs>;
        type TResult = ExtractResultType<InferHandlerReturnType<THandler>>;

        return {
            name: config.name,
            description: config.description,
            run: async (params: TParams): Promise<ToolResult<TResult>> => {
                try {
                    const result = await config.handler(params);
                    return result as ToolResult<TResult>;
                } catch (error) {
                    return {
                        success: false,
                        error: error instanceof Error ? error : new Error(String(error))
                    };
                }
            }
        };
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