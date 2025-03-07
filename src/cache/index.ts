interface CacheEntry {
    value: any;
    expiry: number;
}

interface CacheConfig {
    maxSize?: number;
    defaultTTL?: number;
}

class Cache {
    private static instance: Cache;
    private store: Map<string, CacheEntry>;
    private maxSize: number;
    private defaultTTL: number;

    private constructor(config: CacheConfig = {}) {
        this.store = new Map();
        this.maxSize = config.maxSize || 1000;
        this.defaultTTL = config.defaultTTL || 3600; // 1 hour default
        this.startCleanupInterval();
    }

    static getInstance(config?: CacheConfig): Cache {
        if (!Cache.instance) {
            Cache.instance = new Cache(config);
        }
        return Cache.instance;
    }

    private startCleanupInterval() {
        setInterval(() => {
            this.cleanup();
        }, 60000); // Clean up every minute
    }

    private cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (entry.expiry <= now) {
                this.store.delete(key);
            }
        }
    }

    private enforceMaxSize() {
        if (this.store.size > this.maxSize) {
            // Remove oldest entries
            const entriesToRemove = this.store.size - this.maxSize;
            const entries = Array.from(this.store.entries());
            entries
                .sort((a, b) => a[1].expiry - b[1].expiry)
                .slice(0, entriesToRemove)
                .forEach(([key]) => this.store.delete(key));
        }
    }

    async get(key: string): Promise<any | null> {
        const entry = this.store.get(key);
        if (!entry) return null;

        if (entry.expiry <= Date.now()) {
            this.store.delete(key);
            return null;
        }

        return entry.value;
    }

    async set(key: string, value: any, ttl?: number): Promise<void> {
        const expiry = Date.now() + (ttl || this.defaultTTL) * 1000;
        this.store.set(key, { value, expiry });
        this.enforceMaxSize();
    }

    async delete(key: string): Promise<boolean> {
        return this.store.delete(key);
    }

    async clear(): Promise<void> {
        this.store.clear();
    }

    async has(key: string): Promise<boolean> {
        const entry = this.store.get(key);
        if (!entry) return false;
        if (entry.expiry <= Date.now()) {
            this.store.delete(key);
            return false;
        }
        return true;
    }

    async size(): Promise<number> {
        return this.store.size;
    }

    async keys(): Promise<string[]> {
        return Array.from(this.store.keys());
    }

    async ttl(key: string): Promise<number | null> {
        const entry = this.store.get(key);
        if (!entry) return null;
        const ttl = entry.expiry - Date.now();
        return ttl > 0 ? Math.floor(ttl / 1000) : null;
    }
}

let cacheInstance: Cache | null = null;

export function getCache(config?: CacheConfig): Cache {
    if (!cacheInstance) {
        cacheInstance = Cache.getInstance(config);
    }
    return cacheInstance;
}

export function clearCache(): void {
    if (cacheInstance) {
        cacheInstance.clear();
    }
}

export default {
    getCache,
    clearCache
}; 