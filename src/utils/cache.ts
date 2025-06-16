import { createHash } from 'crypto';
import { logger } from './logger.js';

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface CacheStats {
  total_entries: number;
  cache_hits: number;
  cache_misses: number;
  hit_rate: number;
  memory_usage: number;
}

export class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTtl: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = 1000, defaultTtl: number = 3600000) { // 1 hour default TTL
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
  }

  private generateKey(...args: any[]): string {
    const combined = JSON.stringify(args);
    return createHash('md5').update(combined).digest('hex');
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    // If still over max size, remove least recently used entries
    if (this.cache.size > this.maxSize) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

      const entriesToRemove = sortedEntries.slice(0, this.cache.size - this.maxSize);
      for (const [key] of entriesToRemove) {
        this.cache.delete(key);
      }
    }
  }

  set(key: string, value: T, ttl?: number): void {
    const actualTtl = ttl || this.defaultTtl;
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: actualTtl,
      hits: 0
    });

    this.cleanup();
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    entry.hits++;
    entry.timestamp = Date.now(); // Update for LRU
    this.hits++;
    
    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): CacheStats {
    return {
      total_entries: this.cache.size,
      cache_hits: this.hits,
      cache_misses: this.misses,
      hit_rate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      memory_usage: this.estimateMemoryUsage()
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let size = 0;
    for (const [key, entry] of this.cache.entries()) {
      size += key.length * 2; // String overhead
      size += JSON.stringify(entry.value).length * 2;
      size += 64; // Entry metadata overhead
    }
    return size;
  }

  // Method to cache async operations
  async getOrCompute<K extends any[]>(
    keyArgs: K,
    computeFn: (...args: K) => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const key = this.generateKey(...keyArgs);
    const cached = this.get(key);
    
    if (cached !== undefined) {
      logger.debug('Cache hit', { key, args: keyArgs });
      return cached;
    }

    logger.debug('Cache miss, computing value', { key, args: keyArgs });
    const value = await computeFn(...keyArgs);
    this.set(key, value, ttl);
    
    return value;
  }

  // Method to invalidate entries by pattern
  invalidatePattern(pattern: RegExp): number {
    let deletedCount = 0;
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      deletedCount++;
    }

    return deletedCount;
  }
}

// Specialized cache classes for different data types
export class DetectionCache extends MemoryCache<any> {
  constructor() {
    super(500, 3600000); // 500 entries, 1 hour TTL
  }

  cacheDetectionResult(packageName: string, contextHints: string[], result: any): void {
    const key = this.createDetectionKey(packageName, contextHints);
    this.set(key, result, 3600000); // 1 hour
    logger.debug('Detection result cached', { package_name: packageName, key });
  }

  getDetectionResult(packageName: string, contextHints: string[]): any {
    const key = this.createDetectionKey(packageName, contextHints);
    const result = this.get(key);
    
    if (result) {
      logger.debug('Detection result cache hit', { package_name: packageName, key });
    }
    
    return result;
  }

  private createDetectionKey(packageName: string, contextHints: string[]): string {
    const hintsHash = createHash('md5')
      .update(JSON.stringify(contextHints || []))
      .digest('hex');
    return `detection:${packageName}:${hintsHash}`;
  }
}

export class ResponseCache extends MemoryCache<any> {
  constructor() {
    super(1000, 1800000); // 1000 entries, 30 minutes TTL
  }

  cacheToolResponse(manager: string, toolName: string, params: any, response: any): void {
    const key = this.createResponseKey(manager, toolName, params);
    this.set(key, response, 1800000); // 30 minutes
    logger.debug('Tool response cached', { manager, tool: toolName, key });
  }

  getToolResponse(manager: string, toolName: string, params: any): any {
    const key = this.createResponseKey(manager, toolName, params);
    const result = this.get(key);
    
    if (result) {
      logger.debug('Tool response cache hit', { manager, tool: toolName, key });
    }
    
    return result;
  }

  private createResponseKey(manager: string, toolName: string, params: any): string {
    const paramsHash = createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex');
    return `response:${manager}:${toolName}:${paramsHash}`;
  }

  invalidateManagerCache(manager: string): number {
    const pattern = new RegExp(`^response:${manager}:`);
    const deleted = this.invalidatePattern(pattern);
    logger.info(`Invalidated ${deleted} cache entries for manager: ${manager}`);
    return deleted;
  }
}

export class ConnectionStatusCache extends MemoryCache<boolean> {
  constructor() {
    super(100, 300000); // 100 entries, 5 minutes TTL
  }

  cacheConnectionStatus(manager: string, status: boolean): void {
    const key = `connection:${manager}`;
    this.set(key, status, 300000); // 5 minutes
  }

  getConnectionStatus(manager: string): boolean | undefined {
    const key = `connection:${manager}`;
    return this.get(key);
  }
}

// Global cache instances
export const detectionCache = new DetectionCache();
export const responseCache = new ResponseCache();
export const connectionStatusCache = new ConnectionStatusCache();

// Cache management utilities
export class CacheManager {
  private caches: MemoryCache<any>[] = [
    detectionCache,
    responseCache,
    connectionStatusCache
  ];

  getOverallStats(): {
    total_caches: number;
    combined_stats: CacheStats;
    individual_stats: { name: string; stats: CacheStats }[];
  } {
    const individualStats = [
      { name: 'detection', stats: detectionCache.getStats() },
      { name: 'response', stats: responseCache.getStats() },
      { name: 'connection', stats: connectionStatusCache.getStats() }
    ];

    const combinedStats: CacheStats = {
      total_entries: individualStats.reduce((sum, cache) => sum + cache.stats.total_entries, 0),
      cache_hits: individualStats.reduce((sum, cache) => sum + cache.stats.cache_hits, 0),
      cache_misses: individualStats.reduce((sum, cache) => sum + cache.stats.cache_misses, 0),
      hit_rate: 0,
      memory_usage: individualStats.reduce((sum, cache) => sum + cache.stats.memory_usage, 0)
    };

    combinedStats.hit_rate = combinedStats.cache_hits + combinedStats.cache_misses > 0
      ? combinedStats.cache_hits / (combinedStats.cache_hits + combinedStats.cache_misses)
      : 0;

    return {
      total_caches: this.caches.length,
      combined_stats: combinedStats,
      individual_stats: individualStats
    };
  }

  clearAllCaches(): void {
    for (const cache of this.caches) {
      cache.clear();
    }
    logger.info('All caches cleared');
  }

  logCacheStats(): void {
    const stats = this.getOverallStats();
    logger.info('Cache statistics', stats);
  }

  private cleanupInterval?: NodeJS.Timeout;

  // Periodic cleanup
  startPeriodicCleanup(intervalMs: number = 300000): NodeJS.Timeout { // 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.logCacheStats();
      // Force cleanup on all caches by triggering internal cleanup
      for (const cache of this.caches) {
        // Trigger cleanup by doing a dummy operation
        cache.has('dummy_cleanup_key');
      }
    }, intervalMs);
    return this.cleanupInterval;
  }

  stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  // Graceful shutdown - clear all caches and stop cleanup
  shutdown(): void {
    this.stopPeriodicCleanup();
    this.clearAllCaches();
    logger.info('Cache manager shutdown completed');
  }
}

export const cacheManager = new CacheManager();