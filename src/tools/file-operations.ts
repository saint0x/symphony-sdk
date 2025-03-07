import { readFile, writeFile } from 'fs/promises';
import { ToolResult } from './index';

export interface FileReadParams {
    path: string;
    encoding?: BufferEncoding;
}

export interface FileWriteParams {
    path: string;
    content: string;
    encoding?: BufferEncoding;
}

export async function readFileContent(params: FileReadParams): Promise<ToolResult<string>> {
    try {
        const content = await readFile(params.path, params.encoding || 'utf-8');
        return {
            success: true,
            result: content.toString()
        };
    } catch (error) {
        return {
            success: false,
            result: '',
            error: error as Error
        };
    }
}

export async function writeFileContent(params: FileWriteParams): Promise<ToolResult<boolean>> {
    try {
        await writeFile(params.path, params.content, params.encoding || 'utf-8');
        return {
            success: true,
            result: true
        };
    } catch (error) {
        return {
            success: false,
            result: false,
            error: error as Error
        };
    }
} 