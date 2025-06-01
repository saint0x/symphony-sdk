import { ToolConfig as CoreToolConfig, ToolResult } from "../types/tool.types"; // Use CoreToolConfig
import { ToolRegistry } from "./standard/registry"; // Assuming ToolRegistry path

export interface IToolService {
    create(config: CoreToolConfig): Promise<any>; // Use CoreToolConfig
    execute(toolName: string, params: any): Promise<ToolResult | any>; // Return type can be ToolResult or any as per previous implication
    getAvailable(): string[];
    getInfo(toolName: string): CoreToolConfig | null; // Return CoreToolConfig or null
    register(name: string, tool: CoreToolConfig): void; // Use CoreToolConfig
    readonly registry: ToolRegistry;
    // initialize(): Promise<void>; // initialize is part of IService
} 