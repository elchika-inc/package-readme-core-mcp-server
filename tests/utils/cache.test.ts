import { expect, test, describe, beforeEach, afterEach, vi } from "vitest";
import { 
  MemoryCache, 
  DetectionCache, 
  ResponseCache, 
  ConnectionStatusCache,
  CacheManager,
  cacheManager,
  detectionCache,
  responseCache,
  connectionStatusCache
} from "../../src/utils/cache.js";

describe('MemoryCache', () => {
  let cache: MemoryCache<string>;

  beforeEach(() => {
    cache = new MemoryCache<string>(3, 1000); // Small size and short TTL for testing
  });

  describe('basic operations', () => {
    test('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    test('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    test('should delete keys', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.delete('nonexistent')).toBe(false);
    });

    test('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('TTL functionality', () => {
    test('should expire entries after TTL', async () => {
      const shortTtlCache = new MemoryCache<string>(10, 50); // 50ms TTL
      shortTtlCache.set('key1', 'value1');
      
      expect(shortTtlCache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(shortTtlCache.get('key1')).toBeUndefined();
    });

    test('should respect custom TTL', async () => {
      cache.set('key1', 'value1', 50); // 50ms TTL
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(cache.get('key1')).toBeUndefined();
    });

    test('should not find expired entries with has()', async () => {
      const shortTtlCache = new MemoryCache<string>(10, 50);
      shortTtlCache.set('key1', 'value1');
      
      expect(shortTtlCache.has('key1')).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(shortTtlCache.has('key1')).toBe(false);
    });
  });

  describe('LRU functionality', () => {
    test('should remove least recently used entries when max size exceeded', () => {
      // Cache with max size 2
      const lruCache = new MemoryCache<string>(2, 60000);
      
      lruCache.set('key1', 'value1');
      lruCache.set('key2', 'value2');
      
      // The cache should now have 2 entries
      expect(lruCache.get('key1')).toBe('value1');
      expect(lruCache.get('key2')).toBe('value2');
      
      // Adding a third entry should trigger cleanup and remove one entry
      lruCache.set('key3', 'value3');
      
      // Should still work with the remaining entries
      expect(lruCache.get('key3')).toBe('value3');
      
      // At least one of the original keys should be gone due to size limit
      const key1Exists = lruCache.get('key1') !== undefined;
      const key2Exists = lruCache.get('key2') !== undefined;
      expect(key1Exists && key2Exists).toBe(false); // Both can't exist due to size limit
    });

    test('should handle LRU eviction correctly', () => {
      const lruCache = new MemoryCache<string>(2, 60000);
      
      lruCache.set('key1', 'value1');
      lruCache.set('key2', 'value2');
      
      // Access key1 to update its timestamp (making it more recently used)
      lruCache.get('key1');
      
      // Wait a small amount to ensure timestamp difference
      const delay = 10;
      return new Promise(resolve => {
        setTimeout(() => {
          // Add key3, which should evict the least recently used entry
          lruCache.set('key3', 'value3');
          
          // key3 should exist
          expect(lruCache.get('key3')).toBe('value3');
          
          // The cache should not exceed its max size
          const stats = lruCache.getStats();
          expect(stats.total_entries).toBeLessThanOrEqual(2);
          
          resolve(undefined);
        }, delay);
      });
    });
  });

  describe('statistics', () => {
    test('should track cache hits and misses', () => {
      cache.set('key1', 'value1');
      
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('nonexistent'); // miss
      
      const stats = cache.getStats();
      expect(stats.cache_hits).toBe(2);
      expect(stats.cache_misses).toBe(1);
      expect(stats.hit_rate).toBe(2/3);
    });

    test('should count total entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      expect(stats.total_entries).toBe(2);
    });

    test('should estimate memory usage', () => {
      cache.set('key1', 'value1');
      
      const stats = cache.getStats();
      expect(stats.memory_usage).toBeGreaterThan(0);
    });

    test('should reset stats on clear', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('nonexistent');
      
      cache.clear();
      
      const stats = cache.getStats();
      expect(stats.cache_hits).toBe(0);
      expect(stats.cache_misses).toBe(0);
      expect(stats.total_entries).toBe(0);
    });
  });

  describe('getOrCompute method', () => {
    test('should compute and cache value on cache miss', async () => {
      const computeFn = vi.fn().mockResolvedValue('computed_value');
      
      const result = await cache.getOrCompute(['arg1', 'arg2'], computeFn);
      
      expect(result).toBe('computed_value');
      expect(computeFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(computeFn).toHaveBeenCalledTimes(1);
    });

    test('should return cached value on cache hit', async () => {
      const computeFn = vi.fn().mockResolvedValue('computed_value');
      
      // First call - should compute
      await cache.getOrCompute(['arg1', 'arg2'], computeFn);
      
      // Second call - should use cache
      const result = await cache.getOrCompute(['arg1', 'arg2'], computeFn);
      
      expect(result).toBe('computed_value');
      expect(computeFn).toHaveBeenCalledTimes(1); // Should not be called again
    });

    test('should use different cache keys for different arguments', async () => {
      const computeFn = vi.fn()
        .mockResolvedValueOnce('value1')
        .mockResolvedValueOnce('value2');
      
      const result1 = await cache.getOrCompute(['arg1'], computeFn);
      const result2 = await cache.getOrCompute(['arg2'], computeFn);
      
      expect(result1).toBe('value1');
      expect(result2).toBe('value2');
      expect(computeFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidatePattern method', () => {
    test('should invalidate entries matching pattern', () => {
      cache.set('user:123', 'data1');
      cache.set('user:456', 'data2');
      cache.set('product:789', 'data3');
      
      const deletedCount = cache.invalidatePattern(/^user:/);
      
      expect(deletedCount).toBe(2);
      expect(cache.get('user:123')).toBeUndefined();
      expect(cache.get('user:456')).toBeUndefined();
      expect(cache.get('product:789')).toBe('data3');
    });

    test('should return 0 when no entries match pattern', () => {
      cache.set('key1', 'value1');
      
      const deletedCount = cache.invalidatePattern(/^nonexistent:/);
      
      expect(deletedCount).toBe(0);
      expect(cache.get('key1')).toBe('value1');
    });
  });
});

describe('DetectionCache', () => {
  let detCache: DetectionCache;

  beforeEach(() => {
    detCache = new DetectionCache();
    detCache.clear();
  });

  test('should cache and retrieve detection results', () => {
    const packageName = 'lodash';
    const contextHints = ['package.json', 'npm'];
    const result = { managers: ['npm'], confidence: 0.9 };
    
    detCache.cacheDetectionResult(packageName, contextHints, result);
    
    const cached = detCache.getDetectionResult(packageName, contextHints);
    expect(cached).toEqual(result);
  });

  test('should create different keys for different context hints', () => {
    const packageName = 'lodash';
    const result1 = { managers: ['npm'] };
    const result2 = { managers: ['pip'] };
    
    detCache.cacheDetectionResult(packageName, ['package.json'], result1);
    detCache.cacheDetectionResult(packageName, ['requirements.txt'], result2);
    
    expect(detCache.getDetectionResult(packageName, ['package.json'])).toEqual(result1);
    expect(detCache.getDetectionResult(packageName, ['requirements.txt'])).toEqual(result2);
  });

  test('should handle empty context hints', () => {
    const packageName = 'test';
    const result = { managers: ['npm'] };
    
    detCache.cacheDetectionResult(packageName, [], result);
    
    const cached = detCache.getDetectionResult(packageName, []);
    expect(cached).toEqual(result);
  });
});

describe('ResponseCache', () => {
  let respCache: ResponseCache;

  beforeEach(() => {
    respCache = new ResponseCache();
    respCache.clear();
  });

  test('should cache and retrieve tool responses', () => {
    const manager = 'npm';
    const toolName = 'get_package_info';
    const params = { package_name: 'lodash' };
    const response = { name: 'lodash', version: '4.17.21' };
    
    respCache.cacheToolResponse(manager, toolName, params, response);
    
    const cached = respCache.getToolResponse(manager, toolName, params);
    expect(cached).toEqual(response);
  });

  test('should create different keys for different parameters', () => {
    const manager = 'npm';
    const toolName = 'get_package_info';
    const response1 = { name: 'lodash' };
    const response2 = { name: 'express' };
    
    respCache.cacheToolResponse(manager, toolName, { package_name: 'lodash' }, response1);
    respCache.cacheToolResponse(manager, toolName, { package_name: 'express' }, response2);
    
    expect(respCache.getToolResponse(manager, toolName, { package_name: 'lodash' })).toEqual(response1);
    expect(respCache.getToolResponse(manager, toolName, { package_name: 'express' })).toEqual(response2);
  });

  test('should invalidate cache by manager', () => {
    respCache.cacheToolResponse('npm', 'tool1', { param: 'value1' }, 'response1');
    respCache.cacheToolResponse('npm', 'tool2', { param: 'value2' }, 'response2');
    respCache.cacheToolResponse('pip', 'tool1', { param: 'value3' }, 'response3');
    
    const deletedCount = respCache.invalidateManagerCache('npm');
    
    expect(deletedCount).toBe(2);
    expect(respCache.getToolResponse('npm', 'tool1', { param: 'value1' })).toBeUndefined();
    expect(respCache.getToolResponse('npm', 'tool2', { param: 'value2' })).toBeUndefined();
    expect(respCache.getToolResponse('pip', 'tool1', { param: 'value3' })).toBe('response3');
  });
});

describe('ConnectionStatusCache', () => {
  let connCache: ConnectionStatusCache;

  beforeEach(() => {
    connCache = new ConnectionStatusCache();
    connCache.clear();
  });

  test('should cache and retrieve connection status', () => {
    connCache.cacheConnectionStatus('npm', true);
    connCache.cacheConnectionStatus('pip', false);
    
    expect(connCache.getConnectionStatus('npm')).toBe(true);
    expect(connCache.getConnectionStatus('pip')).toBe(false);
    expect(connCache.getConnectionStatus('maven')).toBeUndefined();
  });

  test('should handle boolean values correctly', () => {
    connCache.cacheConnectionStatus('manager1', true);
    connCache.cacheConnectionStatus('manager2', false);
    
    expect(connCache.getConnectionStatus('manager1')).toBe(true);
    expect(connCache.getConnectionStatus('manager2')).toBe(false);
  });
});

describe('CacheManager', () => {
  let manager: CacheManager;

  beforeEach(() => {
    manager = new CacheManager();
    // Clear all caches
    detectionCache.clear();
    responseCache.clear();
    connectionStatusCache.clear();
  });

  afterEach(() => {
    manager.stopPeriodicCleanup();
  });

  test('should get overall statistics', () => {
    // Add some data to caches
    detectionCache.cacheDetectionResult('test', [], { result: 'test' });
    responseCache.cacheToolResponse('npm', 'tool', {}, { data: 'test' });
    connectionStatusCache.cacheConnectionStatus('npm', true);
    
    const stats = manager.getOverallStats();
    
    expect(stats.total_caches).toBe(3);
    expect(stats.combined_stats.total_entries).toBe(3);
    expect(stats.individual_stats).toHaveLength(3);
    
    const detectionStats = stats.individual_stats.find(s => s.name === 'detection');
    expect(detectionStats?.stats.total_entries).toBe(1);
  });

  test('should clear all caches', () => {
    detectionCache.cacheDetectionResult('test', [], { result: 'test' });
    responseCache.cacheToolResponse('npm', 'tool', {}, { data: 'test' });
    
    manager.clearAllCaches();
    
    expect(detectionCache.getDetectionResult('test', [])).toBeUndefined();
    expect(responseCache.getToolResponse('npm', 'tool', {})).toBeUndefined();
  });

  test('should start and stop periodic cleanup', () => {
    const interval = manager.startPeriodicCleanup(100); // 100ms for testing
    expect(interval).toBeDefined();
    
    manager.stopPeriodicCleanup();
    // No assertion needed, just ensuring no errors are thrown
  });

  test('should shutdown gracefully', () => {
    detectionCache.cacheDetectionResult('test', [], { result: 'test' });
    manager.startPeriodicCleanup(100);
    
    manager.shutdown();
    
    expect(detectionCache.getDetectionResult('test', [])).toBeUndefined();
    // Cleanup interval should be stopped (no direct way to test this without implementation details)
  });

  test('should calculate combined hit rate correctly', () => {
    // Generate some hits and misses
    detectionCache.cacheDetectionResult('test1', [], { result: 'test1' });
    detectionCache.getDetectionResult('test1', []); // hit
    detectionCache.getDetectionResult('nonexistent', []); // miss
    
    responseCache.cacheToolResponse('npm', 'tool', {}, { data: 'test' });
    responseCache.getToolResponse('npm', 'tool', {}); // hit
    responseCache.getToolResponse('npm', 'nonexistent', {}); // miss
    
    const stats = manager.getOverallStats();
    
    expect(stats.combined_stats.cache_hits).toBe(2);
    expect(stats.combined_stats.cache_misses).toBe(2);
    expect(stats.combined_stats.hit_rate).toBe(0.5);
  });

  test('should handle zero hits and misses', () => {
    const stats = manager.getOverallStats();
    
    expect(stats.combined_stats.hit_rate).toBe(0);
  });
});

describe('Global cache instances', () => {
  test('should provide working global cache instances', () => {
    expect(detectionCache).toBeInstanceOf(DetectionCache);
    expect(responseCache).toBeInstanceOf(ResponseCache);
    expect(connectionStatusCache).toBeInstanceOf(ConnectionStatusCache);
    expect(cacheManager).toBeInstanceOf(CacheManager);
  });

  test('should allow cacheManager to work with global instances', () => {
    detectionCache.clear();
    responseCache.clear();
    connectionStatusCache.clear();
    
    detectionCache.cacheDetectionResult('test', [], { result: 'test' });
    
    const stats = cacheManager.getOverallStats();
    expect(stats.combined_stats.total_entries).toBe(1);
    
    cacheManager.clearAllCaches();
    expect(detectionCache.getDetectionResult('test', [])).toBeUndefined();
  });
});