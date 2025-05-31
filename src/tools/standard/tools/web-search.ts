import { ToolConfig, ToolResult } from '../../../types/sdk';
import fetch from 'node-fetch';
import { getCache } from '../../../cache';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../src/.env') });

export const webSearchTool: ToolConfig = {
    name: 'webSearchTool',
    description: 'Search the web for information',
    type: 'web',
    nlp: 'search the web for * OR find information about * OR look up * on the internet',
    config: {
        inputs: ['query', 'num_results'],
        outputs: ['results', 'summary'],
    },
    handler: async (params: any): Promise<ToolResult<any>> => {
        const { query, type = 'search' } = params;
        if (!query) {
            return {
                success: false,
                error: 'Query parameter is required'
            };
        }

        const apiKey = process.env.SERPER_API_KEY;
        if (!apiKey) {
            return {
                success: false,
                error: 'SERPER_API_KEY environment variable is not set'
            };
        }

        try {
            // Use a cache to avoid repeated requests
            const cache = getCache();
            const cacheKey = `websearch:${type}:${query}`;
            const cached = await cache.get(cacheKey);
            if (cached) {
                console.log('[WEBSEARCH] Using cached results');
                return {
                    success: true,
                    result: cached
                };
            }

            console.log('[WEBSEARCH] Making API request with Serper API key');
            // Make the actual web request to Serper API
            const response = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey
                },
                body: JSON.stringify({
                    q: query,
                    type: type
                })
            });

            if (!response.ok) {
                return {
                    success: false,
                    error: `Search request failed with status ${response.status}: ${response.statusText}`
                };
            }

            const data = await response.json();
            await cache.set(cacheKey, data);

            return {
                success: true,
                result: data
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}; 