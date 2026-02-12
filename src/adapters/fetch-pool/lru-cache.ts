/**
 * LRU cache with TTL and conditional request support (ETag/Last-Modified).
 * Evicts oldest 10% of entries when capacity is reached.
 */

/** Cached scrape result with validation headers. */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  etag?: string;
  lastModified?: string;
}

/**
 * Simple LRU cache backed by a Map (insertion order).
 * Uses the same eviction strategy as UndiciScraperAdapter.
 */
export class LruCache<T> {
  private entries = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = 500, ttl = 30 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /** Get a non-expired entry, or undefined. */
  get(key: string): CacheEntry<T> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  /** Get entry even if expired (for conditional requests). */
  getStale(key: string): CacheEntry<T> | undefined {
    return this.entries.get(key);
  }

  /** Store an entry, evicting oldest 10% if at capacity. */
  set(key: string, entry: CacheEntry<T>): void {
    if (this.entries.size >= this.maxSize) {
      this.evict();
    }
    this.entries.set(key, entry);
  }

  /** Remove all entries. */
  clear(): void {
    this.entries.clear();
  }

  /** Evict oldest 10% by timestamp. */
  private evict(): void {
    const sorted = [...this.entries.entries()].sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    );
    const count = Math.max(1, Math.floor(this.maxSize * 0.1));
    for (let i = 0; i < count; i++) {
      this.entries.delete(sorted[i]![0]);
    }
  }
}
