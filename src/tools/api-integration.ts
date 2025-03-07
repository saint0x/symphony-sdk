import { ToolResult } from './index';

export interface APIRequestParams {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
}

export async function makeAPIRequest(params: APIRequestParams): Promise<ToolResult<any>> {
    try {
        const controller = new AbortController();
        const timeoutId = params.timeout 
            ? setTimeout(() => controller.abort(), params.timeout)
            : null;

        const response = await fetch(params.url, {
            method: params.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...params.headers
            },
            body: params.body ? JSON.stringify(params.body) : undefined,
            signal: controller.signal
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            success: true,
            result: data
        };
    } catch (error) {
        return {
            success: false,
            result: null,
            error: error as Error
        };
    }
} 