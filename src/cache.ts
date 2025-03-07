interface CacheEntry<T> {
    value: T;
    expiresAt?: number;
}

interface Cache {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    has(key: string): Promise<boolean>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
    cleanup(): Promise<void>;
}

class MemoryCache implements Cache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private maxSize: number;
    private cleanupInterval: NodeJS.Timeout;

    constructor(options: { maxSize?: number; cleanupInterval?: number } = {}) {
        this.maxSize = options.maxSize || 1000;
        this.cleanupInterval = setInterval(() => {
            this.cleanup().catch(console.error);
        }, options.cleanupInterval || 60000); // Default cleanup every minute
    }

    async get<T>(key: string): Promise<T | null> {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.value as T;
    }

    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        // Enforce cache size limit with LRU-like eviction
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(key, {
            value,
            expiresAt: ttl ? Date.now() + ttl * 1000 : undefined
        });
    }

    async has(key: string): Promise<boolean> {
        const entry = this.cache.get(key);
        if (!entry) return false;

        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    async delete(key: string): Promise<void> {
        this.cache.delete(key);
    }

    async clear(): Promise<void> {
        this.cache.clear();
    }

    async cleanup(): Promise<void> {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt && now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    destroy(): void {
        clearInterval(this.cleanupInterval);
    }
}

// Global cache instance with default configuration
const globalCache = new MemoryCache({
    maxSize: 1000,
    cleanupInterval: 60000
});

export const getCache = (): Cache => globalCache; 