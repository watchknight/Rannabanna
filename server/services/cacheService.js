/**
 * Redis-style in-memory caching service with Time-To-Live (TTL) support.
 * Used to cache identical ingredient searches and custom recipe outputs.
 */

class CacheService {
  constructor() {
    this.store = new Map();
  }

  /**
   * Generates a deterministic cache key from selected ingredients and filters.
   * @param {string[]} ingredientIds 
   * @param {object} filters 
   * @returns {string} Hashed key string
   */
  generateKey(ingredientIds = [], filters = {}) {
    const sortedIds = [...ingredientIds].sort().join(',');
    const serializedFilters = JSON.stringify(filters);
    return `match:${sortedIds}:${serializedFilters}`;
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

    const { value, expiresAt } = this.store.get(key);

    if (Date.now() > expiresAt) {
      this.store.delete(key);
      return null;
    }

    return value;
  }

  /**
   * Sets a cache entry with a specific TTL.
   * @param {string} key 
   * @param {any} value 
   * @param {number} ttlMs Defaults to 10 minutes (600,000ms)
   */
  set(key, value, ttlMs = 10 * 60 * 1000) {
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
