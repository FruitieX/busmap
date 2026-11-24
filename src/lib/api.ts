import type {
  Route, RoutePattern, Stop, StopRoute, StopDeparture, VehicleTrip,
  TransportMode,
} from '@/types';
// Register built-in providers (HSL, Vietnam) before any getProvider() call.
import '@/lib/providers';
import { getProvider } from '@/lib/provider';
import { createCache } from '@/lib/cache';

export interface StopTimetableResult {
  departures: StopDeparture[];
  directions: Record<string, number[]>;
}

// Re-export provider-level helpers
export { getProvider, routeIdWithPrefix, routeIdWithoutPrefix, listProviders } from '@/lib/provider';
export type { TransitProvider, ParsedVehicle } from '@/lib/provider';

export interface CachedValue<T> {
  value: T;
  timestamp: number;
}

const providerCache = new Map<string, ReturnType<typeof createCache>>();

const getProviderCache = (): ReturnType<typeof createCache> => {
  const provider = getProvider();
  if (!providerCache.has(provider.id)) {
    providerCache.set(provider.id, createCache());
  }
  return providerCache.get(provider.id)!;
};

const cache = () => getProviderCache();

// Re-export normalizeMode from the active provider
export const normalizeMode = (mode?: string, gtfsId?: string): TransportMode => (
  getProvider().normalizeMode(mode, gtfsId)
);

export const isApiKeyConfigured = (): boolean => getProvider().isApiKeyConfigured();

// --- Routes ---

export const fetchAllRoutes = async (): Promise<Route[]> => (
  getProvider().fetchAllRoutes()
);

export const fetchRoutesByIds = (routeIds: string[]): Promise<Route[]> => (
  getProvider().fetchRoutesByIds(routeIds)
);

export const fetchRoutePatterns = (routeIds: string[]): Promise<Map<string, RoutePattern[]>> => (
  getProvider().fetchRoutePatterns(routeIds)
);

// --- Stops ---

export const fetchAllStops = async (): Promise<Stop[]> => (
  getProvider().fetchAllStops()
);

export const fetchStopRoutes = (stopId: string): Promise<StopRoute[]> => (
  getProvider().fetchStopRoutes(stopId)
);

// --- Timetables / trips ---

export const fetchStopTimetable = (stopId: string): Promise<StopTimetableResult> => (
  getProvider().fetchStopTimetable(stopId)
);

export const fetchVehicleTrip = (
  routeId: string,
  direction: 1 | 2,
  operatingDay: string,
  startTime: string,
): Promise<VehicleTrip | null> => (
  getProvider().fetchVehicleTrip(routeId, direction, operatingDay, startTime)
);

// --- Caching (provider-aware) ---

const ROUTES_CACHE_KEY = 'routes';
const STOPS_CACHE_KEY = 'stops';
const ROUTE_PATTERNS_CACHE_KEY = 'route-patterns';

const normalizeCachedRoutes = (value: unknown): Route[] | null => {
  if (!Array.isArray(value)) return null;
  const routes = value.filter((r): r is Route => typeof r.gtfsId === 'string');
  return routes.length > 0 ? routes : null;
};

const normalizeCachedStops = (value: unknown): Stop[] | null => {
  if (!Array.isArray(value)) return null;
  const stops = value.filter((s): s is Stop => typeof s.gtfsId === 'string' && typeof s.lat === 'number');
  return stops.length > 0 ? stops : null;
};

const isRoutePattern = (value: unknown): value is RoutePattern => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const p = value as RoutePattern;
  return typeof p.gtfsId === 'string'
    && typeof p.name === 'string'
    && Array.isArray(p.geometry)
    && p.geometry.every((g): g is { lat: number; lon: number } =>
      typeof g.lat === 'number' && typeof g.lon === 'number');
};

const normalizeCachedRoutePatterns = (value: unknown): RoutePattern[] | null => {
  if (!Array.isArray(value) || !value.every(isRoutePattern)) return null;
  return value;
};

export const STATIC_API_CACHE_TTL = 24 * 60 * 60 * 1000;

export const getCachedRoutesSnapshot = (): CachedValue<Route[]> | null => (
  cache().readTimedCacheValue(ROUTES_CACHE_KEY, 'routes', normalizeCachedRoutes)
);

export const getCachedRoutes = async (): Promise<Route[] | null> => (
  (await cache().readPersistentTimedCacheValue(ROUTES_CACHE_KEY, 'routes', normalizeCachedRoutes))?.value ?? null
);

export const setCachedRoutes = async (routes: Route[]): Promise<void> => {
  await cache().writePersistentTimedCacheValue(ROUTES_CACHE_KEY, 'routes', routes);
};

export const getCachedStopsSnapshot = (): CachedValue<Stop[]> | null => (
  cache().readTimedCacheValue(STOPS_CACHE_KEY, 'stops', normalizeCachedStops)
);

export const getCachedStops = async (): Promise<Stop[] | null> => (
  (await cache().readPersistentTimedCacheValue(STOPS_CACHE_KEY, 'stops', normalizeCachedStops))?.value ?? null
);

export const setCachedStops = async (stops: Stop[]): Promise<void> => {
  await cache().writePersistentTimedCacheValue(STOPS_CACHE_KEY, 'stops', stops);
};

export const getCachedRoutePatterns = async (routeIds: string[]): Promise<Map<string, RoutePattern[]>> => {
  const patternsByRouteId = new Map<string, RoutePattern[]>();
  await Promise.all(routeIds.map(async (routeId) => {
    const key = `${ROUTE_PATTERNS_CACHE_KEY}:${routeId}`;
    const cached = cache().readTimedCacheValue(key, 'patterns', normalizeCachedRoutePatterns);
    if (cached) patternsByRouteId.set(routeId, cached.value);
  }));
  return patternsByRouteId;
};

export const setCachedRoutePatterns = async (patternsByRouteId: Map<string, RoutePattern[]>): Promise<void> => {
  if (patternsByRouteId.size === 0) return;
  const timestamp = Date.now();
  await Promise.all(Array.from(patternsByRouteId, async ([routeId, patterns]) => {
    const key = `${ROUTE_PATTERNS_CACHE_KEY}:${routeId}`;
    await cache().writePersistentTimedCacheValue(key, 'patterns', { patterns, timestamp });
  }));
};

export const clearStaticApiCache = async (): Promise<void> => {
  const c = cache();
  c.removeLocalStorageItem(ROUTES_CACHE_KEY);
  c.removeLocalStorageItem(STOPS_CACHE_KEY);
  c.removeLocalStorageItemsByPrefix(`${ROUTE_PATTERNS_CACHE_KEY}:`);
  await c.deleteCacheStorage('busmap-static-api-cache');
};
