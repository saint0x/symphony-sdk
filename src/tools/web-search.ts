import { ToolResult } from './index';

export interface WebSearchParams {
    query: string;
    type?: 'search' | 'news' | 'images';
}

export interface WebSearchResult {
    title: string;
    link: string;
    snippet: string;
    source?: string;
    published_date?: string;
}

export async function webSearch(params: WebSearchParams): Promise<ToolResult<WebSearchResult[]>> {
    try {
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

        const data = await response.json();
        return {
            success: true,
            result: data.organic || []
        };
    } catch (error) {
        return {
            success: false,
            result: [],
            error: error as Error
        };
    }
} 