import { ToolResult } from './index';

export interface DataTransformParams {
    data: any;
    transformations: Array<{
        type: 'filter' | 'map' | 'reduce' | 'sort';
        config: any;
    }>;
}

export async function transformData(params: DataTransformParams): Promise<ToolResult<any>> {
    try {
        let result = params.data;

        for (const transform of params.transformations) {
            switch (transform.type) {
                case 'filter':
                    result = Array.isArray(result) 
                        ? result.filter(transform.config.predicate)
                        : result;
                    break;
                case 'map':
                    result = Array.isArray(result)
                        ? result.map(transform.config.mapper)
                        : result;
                    break;
                case 'reduce':
                    result = Array.isArray(result)
                        ? result.reduce(transform.config.reducer, transform.config.initial)
                        : result;
                    break;
                case 'sort':
                    result = Array.isArray(result)
                        ? result.sort(transform.config.comparator)
                        : result;
                    break;
            }
        }

        return {
            success: true,
            result
        };
    } catch (error) {
        return {
            success: false,
            result: null,
            error: error as Error
        };
    }
} 