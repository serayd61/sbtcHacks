/**
 * In-flight request deduplication + TTL cache.
 *
 * Solves two problems:
 * 1. Multiple components calling getVaultInfo() simultaneously → only 1 HTTP request
 * 2. Rapid refreshKey changes → don't re-fetch if data is still fresh (within TTL)
 */

const dataCache = new Map<string, { data: unknown; timestamp: number }>();
const inflightRequests = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 10_000; // 10 seconds

/**
 * Deduplicate and cache async function calls.
 *
 * - If a cached result exists within the TTL, returns it immediately.
 * - If an identical request is already in-flight, returns the same promise.
 * - Otherwise, executes the function and caches the result.
 */
export function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  // 1. Check TTL cache
  const entry = dataCache.get(key);
  if (entry && Date.now() - entry.timestamp < ttlMs) {
    return Promise.resolve(entry.data as T);
  }

  // 2. Check in-flight deduplication
  const existing = inflightRequests.get(key);
  if (existing) return existing as Promise<T>;

  // 3. Execute, cache, and deduplicate
  const promise = fn()
    .then((data) => {
      dataCache.set(key, { data, timestamp: Date.now() });
      inflightRequests.delete(key);
      return data;
    })
    .catch((err) => {
      inflightRequests.delete(key);
      throw err;
    });

  inflightRequests.set(key, promise);
  return promise;
}

/**
 * Invalidate cache entries.
 * Without a prefix, clears the entire cache.
 * With a prefix, clears only matching entries.
 */
export function invalidateCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    dataCache.clear();
    return;
  }
  for (const key of dataCache.keys()) {
    if (key.startsWith(keyPrefix)) dataCache.delete(key);
  }
}
