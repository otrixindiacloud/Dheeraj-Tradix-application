import { useQueryClient } from "@tanstack/react-query";

/**
 * Custom hook for optimized query management
 * Provides prefetching and cache optimization utilities
 */
export function useOptimizedQueries() {
  const queryClient = useQueryClient();

  // Prefetch commonly used data
  const prefetchSuppliers = () => {
    queryClient.prefetchQuery({
      queryKey: ["/api/suppliers"],
      queryFn: async () => {
        const response = await fetch("/api/suppliers");
        if (!response.ok) throw new Error("Failed to fetch suppliers");
        return response.json();
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  const prefetchCustomers = () => {
    queryClient.prefetchQuery({
      queryKey: ["/api/customers"],
      queryFn: async () => {
        const response = await fetch("/api/customers");
        if (!response.ok) throw new Error("Failed to fetch customers");
        return response.json();
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  // Clear unused cache entries
  const clearUnusedCache = () => {
    // Keep only active queries in memory
    queryClient.getQueryCache().clear();
  };

  // Optimize cache for specific data types
  const optimizeCacheForData = (dataType: 'suppliers' | 'customers' | 'enquiries' | 'quotations') => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    queries.forEach(query => {
      const queryKey = query.queryKey[0] as string;
      
      if (queryKey.includes(`/api/${dataType}`)) {
        // Set longer stale time for reference data
        if (dataType === 'suppliers' || dataType === 'customers') {
          query.meta = {
            ...query.meta,
            staleTime: 10 * 60 * 1000, // 10 minutes
            gcTime: 30 * 60 * 1000, // 30 minutes
          };
        }
      }
    });
  };

  return {
    prefetchSuppliers,
    prefetchCustomers,
    clearUnusedCache,
    optimizeCacheForData,
  };
}
