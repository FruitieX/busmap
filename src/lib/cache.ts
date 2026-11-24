import type { CachedValue } from './api';

const LOCAL_STORAGE_CACHE_SIZE_LIMIT = 2_500_000;

const getLocalStorageItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setLocalStorageItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors
  }
};

const removeLocalStorageItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
};

const removeLocalStorageItemsByPrefix = (prefix: string): void => {
  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors
  }
};

const parseJson = (value: string): unknown | null => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const stringifyJson = (value: unknown): string | null => {
  try {
    return JSON.stringify(value) ?? null;
  } catch {
    return null;
  }
};

const writeLocalStorageSerialized = (key: string, serialized: string): void => {
  if (serialized.length > LOCAL_STORAGE_CACHE_SIZE_LIMIT) {
    removeLocalStorageItem(key);
    return;
  }

  setLocalStorageItem(key, serialized);
};

const getCacheStorageRequest = (key: string): Request | null => {
  if (typeof window === 'undefined') return null;

  return new Request(`${window.location.origin}/__busmap-api-cache/${encodeURIComponent(key)}`);
};

const readCacheStorageItem = async (key: string): Promise<unknown | null> => {
  if (typeof window === 'undefined' || !window.caches) return null;

  const request = getCacheStorageRequest(key);
  if (!request) return null;

  try {
    const cache = await window.caches.open('busmap-static-api-cache');
    const response = await cache.match(request);
    if (!response) return null;

    return await response.json();
  } catch {
    return null;
  }
};

const writeCacheStorageItem = async (key: string, serialized: string): Promise<void> => {
  if (typeof window === 'undefined' || !window.caches) return;

  const request = getCacheStorageRequest(key);
  if (!request) return;

  try {
    const cache = await window.caches.open('busmap-static-api-cache');
    await cache.put(request, new Response(serialized, {
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch {
    // Ignore storage errors
  }
};

const removeCacheStorageItem = async (key: string): Promise<void> => {
  if (typeof window === 'undefined' || !window.caches) return;

  const request = getCacheStorageRequest(key);
  if (!request) return;

  try {
    const cache = await window.caches.open('busmap-static-api-cache');
    await cache.delete(request);
  } catch {
    // Ignore storage errors
  }
};

const deleteCacheStorage = async (cacheName: string): Promise<void> => {
  if (typeof window === 'undefined' || !window.caches) return;

  try {
    await window.caches.delete(cacheName);
  } catch {
    // Ignore storage errors
  }
};

const normalizeTimedCachePayload = <T>(
  payload: unknown,
  field: string,
  normalizeValue: (value: unknown) => T | null,
  ttlMs: number,
): CachedValue<T> | null => {
  if (!isRecord(payload) || typeof payload.timestamp !== 'number') return null;

  if (Date.now() - payload.timestamp > ttlMs) return null;

  const value = normalizeValue(payload[field]);
  if (!value) return null;

  return { value, timestamp: payload.timestamp };
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const createCache = () => {
  const TTL = 24 * 60 * 60 * 1000;

  const readTimedCacheValue = <T>(
    key: string,
    field: string,
    normalizeValue: (value: unknown) => T | null
  ): CachedValue<T> | null => {
    const cached = getLocalStorageItem(key);
    if (!cached) return null;

    const parsed = parseJson(cached);
    const cacheValue = normalizeTimedCachePayload(parsed, field, normalizeValue, TTL);
    if (!cacheValue) {
      removeLocalStorageItem(key);
      return null;
    }

    return cacheValue;
  };

  const readPersistentTimedCacheValue = async <T>(
    key: string,
    field: string,
    normalizeValue: (value: unknown) => T | null
  ): Promise<CachedValue<T> | null> => {
    const cachedPayload = await readCacheStorageItem(key);
    const cachedValue = normalizeTimedCachePayload(cachedPayload, field, normalizeValue, TTL);
    if (cachedValue) return cachedValue;

    if (cachedPayload !== null) {
      await removeCacheStorageItem(key);
    }

    const localValue = readTimedCacheValue(key, field, normalizeValue);
    if (!localValue) return null;

    const serialized = stringifyJson({ [field]: localValue.value, timestamp: localValue.timestamp });
    if (serialized) {
      await writeCacheStorageItem(key, serialized);
    }

    return localValue;
  };

  const writePersistentTimedCacheValue = async (key: string, field: string, value: unknown): Promise<void> => {
    const serialized = stringifyJson({ [field]: value, timestamp: Date.now() });
    if (!serialized) return;

    writeLocalStorageSerialized(key, serialized);
    await writeCacheStorageItem(key, serialized);
  };

  return {
    readTimedCacheValue,
    readPersistentTimedCacheValue,
    writePersistentTimedCacheValue,
    removeLocalStorageItem,
    removeLocalStorageItemsByPrefix,
    deleteCacheStorage,
  };
};
