class cacheService {
    constructor(ttl = 60 * 60 * 1000) {
        this.cache = new Map();
        this.ttl = ttl;
    }

    set(key, value) {
        this.cache.set(key, { value, expiry: Date.now() + this.ttl });
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        // if (Date.now() > entry.expiry) {
        //     this.cache.delete(key);
        //     return null;
        // }
        return entry.value;
    }

    invalidate(key) {
        this.cache.delete(key);
    }
}

module.exports = cacheService;