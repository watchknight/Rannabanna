/**
 * Redis-style in-memory caching service with Time-To-Live (TTL) support.
 * Used to cache identical ingredient searches and custom recipe outputs.
 */

class CacheService {
  constructor(maxSize = 500) {
    this.store = new Map();
    this.maxSize = maxSize;

    // Periodic cleanup of expired entries every 5 minutes
    this._cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store) {
        if (now > entry.expiresAt) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000);

    // Allow Node to exit cleanly despite the timer
    if (this._cleanupTimer.unref) {
      this._cleanupTimer.unref();
    }
  }

  /**
   * Generates a deterministic cache key from selected ingredients and filters.
   * Sorts object keys to ensure identical objects produce identical keys.
   * @param {string[]} ingredientIds 
   * @param {object} filters 
   * @returns {string} Hashed key string
   */
  generateKey(ingredientIds = [], filters = {}) {
    const sortedIds = [...ingredientIds].sort().join(',');
    // Deep-sort filter values to ensure arrays like dietary=['vegan','dairy-free'] produce consistent keys
    const normalizedFilters = {};
    for (const key of Object.keys(filters).sort()) {
      const val = filters[key];
      normalizedFilters[key] = Array.isArray(val) ? [...val].sort() : val;
    }
    const sortedFilters = JSON.stringify(normalizedFilters);
    return `match:${sortedIds}:${sortedFilters}`;
  }

  /**
   * Fetches an entry from the cache.
   * @param {string} key 
   * @returns {any|null} The cached data or null if missing/expired
   */
  get(key) {
    if (!this.store.has(key)) {
      return null;
    }

    const entry = this.store.get(key);

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Refresh LRU order: delete and re-insert at tail
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.value;
  }

  /**
   * Sets a cache entry with a specific TTL.
   * Evicts least recently used (LRU) entry if the cache exceeds max size.
   * @param {string} key 
   * @param {any} value 
   * @param {number} ttlMs Defaults to 10 minutes (600,000ms)
   */
  set(key, value, ttlMs = 10 * 60 * 1000) {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      // Evict least recently used (head of map iteration)
      const lruKey = this.store.keys().next().value;
      if (lruKey !== undefined) {
        this.store.delete(lruKey);
      }
    }
    const expiresAt = Date.now() + ttlMs;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Evicts a key from the cache.
   * @param {string} key 
   */
  delete(key) {
    this.store.delete(key);
  }

  /**
   * Completely clears the cache.
   */
  clear() {
    this.store.clear();
  }
}

export const cacheService = new CacheService();
