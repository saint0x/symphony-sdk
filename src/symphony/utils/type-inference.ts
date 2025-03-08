/**
 * Infers parameter types from an array of input names
 */
export type InferParamsFromInputs<T extends readonly string[]> = {
    [K in T[number]]: unknown;
};

/**
 * Infers the return type from a handler function
 */
export type InferHandlerReturnType<T> = T extends (params: any) => Promise<infer R> ? R : never;

/**
 * Infers the parameter type from a handler function
 */
export type InferHandlerParamsType<T> = T extends (params: infer P) => Promise<any> ? P : never;

/**
 * Type guard to ensure handler return type matches our ToolResult interface
 */
export type EnsureToolResult<T> = T extends { success: boolean; result?: any; error?: Error } ? T : never;

/**
 * Creates a strongly-typed tool configuration
 */
export type InferToolConfig<
    TInputs extends readonly string[],
    THandler extends (params: InferParamsFromInputs<TInputs>) => Promise<any>
> = {
    name: string;
    description: string;
    inputs: TInputs;
    handler: THandler;
};

/**
 * Helper type to extract the result type from a ToolResult
 */
export type ExtractResultType<T> = T extends { success: true; result: infer R } ? R : never; 