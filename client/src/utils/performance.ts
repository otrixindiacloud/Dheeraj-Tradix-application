/**
 * Performance monitoring utilities
 * Helps track and optimize application performance
 */

interface PerformanceMetrics {
  queryTime: number;
  renderTime: number;
  cacheHitRate: number;
  memoryUsage: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private queryTimes: Map<string, number[]> = new Map();
  private cacheHits: Map<string, number> = new Map();
  private cacheMisses: Map<string, number> = new Map();

  // Track query performance
  trackQuery(queryKey: string, startTime: number, fromCache: boolean = false) {
    const endTime = performance.now();
    const queryTime = endTime - startTime;
    
    // Store query time
    if (!this.queryTimes.has(queryKey)) {
      this.queryTimes.set(queryKey, []);
    }
    this.queryTimes.get(queryKey)!.push(queryTime);
    
    // Track cache performance
    if (fromCache) {
      this.cacheHits.set(queryKey, (this.cacheHits.get(queryKey) || 0) + 1);
    } else {
      this.cacheMisses.set(queryKey, (this.cacheMisses.get(queryKey) || 0) + 1);
    }
  }

  // Get performance summary
  getPerformanceSummary() {
    const totalQueries = Array.from(this.queryTimes.values()).flat().length;
    const totalCacheHits = Array.from(this.cacheHits.values()).reduce((a, b) => a + b, 0);
    const totalCacheMisses = Array.from(this.cacheMisses.values()).reduce((a, b) => a + b, 0);
    
    const averageQueryTime = Array.from(this.queryTimes.values())
      .flat()
      .reduce((a, b) => a + b, 0) / totalQueries || 0;
    
    const cacheHitRate = totalCacheHits / (totalCacheHits + totalCacheMisses) || 0;
    
    return {
      totalQueries,
      averageQueryTime: Math.round(averageQueryTime * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      memoryUsage: this.getMemoryUsage(),
    };
  }

  // Get memory usage (if available)
  private getMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024), // MB
      };
    }
    return null;
  }

  // Clear old metrics to prevent memory leaks
  clearOldMetrics() {
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
    
    // Clear old query times (keep last 50 per query)
    this.queryTimes.forEach((times, key) => {
      if (times.length > 50) {
        this.queryTimes.set(key, times.slice(-50));
      }
    });
  }

  // Log performance summary to console
  logPerformanceSummary() {
    const summary = this.getPerformanceSummary();
    console.group('🚀 Performance Summary');
    console.log(`Total Queries: ${summary.totalQueries}`);
    console.log(`Average Query Time: ${summary.averageQueryTime}ms`);
    console.log(`Cache Hit Rate: ${summary.cacheHitRate * 100}%`);
    if (summary.memoryUsage) {
      console.log(`Memory Usage: ${summary.memoryUsage.used}MB / ${summary.memoryUsage.total}MB`);
    }
    console.groupEnd();
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Utility function to wrap queries with performance tracking
export function withPerformanceTracking<T>(
  queryKey: string,
  queryFn: () => Promise<T>,
  fromCache: boolean = false
): Promise<T> {
  const startTime = performance.now();
  
  return queryFn().finally(() => {
    performanceMonitor.trackQuery(queryKey, startTime, fromCache);
  });
}

// Utility to log performance every 30 seconds in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    performanceMonitor.logPerformanceSummary();
    performanceMonitor.clearOldMetrics();
  }, 30000);
}
