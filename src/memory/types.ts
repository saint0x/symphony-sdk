export interface Memory {
    add(key: string, value: any): Promise<void>;
    get(key: string): Promise<any>;
    search(query: string): Promise<any[]>;
    clear(): Promise<void>;
}

export interface MemoryEntry {
    value: any;
    timestamp: number;
    type: string;
    metadata?: Record<string, any>;
} 