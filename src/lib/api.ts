import type { Route, RoutePattern, TransportMode, Stop, StopRoute, StopDeparture } from '@/types';

const API_ENDPOINT = 'https://api.digitransit.fi/routing/v2/hsl/gtfs/v1';

const getApiKey = (): string | undefined => {
  return import.meta.env.VITE_DIGITRANSIT_API_KEY;
};

const graphqlFetch = async <T>(query: string): Promise<T> => {
  const apiKey = getApiKey();

  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('Digitransit API key not configured. See .env.example for setup instructions.');
  }

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/graphql',
      'digitransit-subscription-key': apiKey,
    },
    body: query,
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid API key. Please check your Digitransit subscription key.');
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'GraphQL error');
  }

  return data.data;
};

// Infer transport mode from route ID or normalize mode string
export const normalizeMode = (mode?: string, gtfsId?: string): TransportMode => {
  if (mode) {
    const m = mode.toLowerCase();
    if (m === 'subway') return 'metro';
    if (m === 'rail') return 'train';
    if (m === 'bus') return 'bus';
    if (m === 'tram') return 'tram';
    if (m === 'metro') return 'metro';
    if (m === 'train') return 'train';
    if (m === 'ferry') return 'ferry';
    if (m === 'ubus') return 'ubus';
    if (m === 'robot') return 'robot';
  }

  if (!gtfsId) return 'bus';

  const id = gtfsId.replace('HSL:', '');

  // Common patterns:
  // 1xxx, 2xxx, 4xxx-9xxx = bus (most routes)
  // 10xx = tram
  // 31xx = metro
  // 30xx = train
  // 19xx = ferry (Suomenlinna)

  if (/^10\d{2}/.test(id)) return 'tram';
  if (/^31\d{2}/.test(id)) return 'metro';
  if (/^300\d/.test(id) || /^900\d/.test(id)) return 'train';
  if (/^19\d{2}/.test(id)) return 'ferry';

  return 'bus';
};

interface RoutesResponse {
  routes: Array<RawRoute | null>;
}

interface RawRoute {
  gtfsId?: string | null;
  shortName?: string | null;
  longName?: string | null;
  mode?: string | null;
  color?: string | null;
}

interface RawStopRoute {
  gtfsId?: string | null;
  shortName?: string | null;
  longName?: string | null;
  mode?: string | null;
}

interface RawStop {
  gtfsId?: string | null;
  name?: string | null;
  code?: string | null;
  lat?: number | null;
  lon?: number | null;
  vehicleMode?: string | null;
  routes?: RawStopRoute[] | null;
  patterns?: Array<{
    headsign?: string | null;
    directionId?: number | null;
    route?: {
      gtfsId?: string | null;
    } | null;
  } | null> | null;
}

type SearchableRawRoute = RawRoute & {
  gtfsId: string;
  shortName: string;
  longName: string;
};

const isSearchableRoute = (route: RawRoute | null): route is SearchableRawRoute => (
  typeof route?.gtfsId === 'string' && route.gtfsId.length > 0
  && typeof route.shortName === 'string' && route.shortName.length > 0
  && typeof route.longName === 'string'
);

const normalizeRoute = (route: SearchableRawRoute): Route => ({
  gtfsId: route.gtfsId,
  shortName: route.shortName,
  longName: route.longName,
  mode: normalizeMode(route.mode ?? undefined, route.gtfsId),
  color: route.color ?? undefined,
});

const isSearchableStop = (stop: RawStop | null): stop is RawStop & {
  gtfsId: string;
  name: string;
  lat: number;
  lon: number;
} => (
  typeof stop?.gtfsId === 'string' && stop.gtfsId.length > 0
  && typeof stop.name === 'string' && stop.name.length > 0
  && typeof stop.lat === 'number'
  && typeof stop.lon === 'number'
);

const isSearchableStopRoute = (route: RawStopRoute | null): route is RawStopRoute & {
  gtfsId: string;
  shortName: string;
  longName: string;
} => (
  typeof route?.gtfsId === 'string' && route.gtfsId.length > 0
  && typeof route.shortName === 'string' && route.shortName.length > 0
  && typeof route.longName === 'string'
);

const getStopPatternMetadata = (stop: RawStop) => {
  const headsigns = new Set<string>();
  const routeDirections: Record<string, number[]> = {};

  for (const pattern of stop.patterns ?? []) {
    if (!pattern) continue;

    if (pattern.headsign) {
      headsigns.add(pattern.headsign);
    }

    const routeId = pattern.route?.gtfsId;
    if (!routeId || typeof pattern.directionId !== 'number') continue;

    if (!(routeId in routeDirections)) {
      routeDirections[routeId] = [];
    }
    if (!routeDirections[routeId].includes(pattern.directionId)) {
      routeDirections[routeId].push(pattern.directionId);
    }
  }

  return {
    headsigns: Array.from(headsigns),
    routeDirections,
  };
};

const normalizeStop = (stop: RawStop & {
  gtfsId: string;
  name: string;
  lat: number;
  lon: number;
}): Stop => {
  const { headsigns, routeDirections } = getStopPatternMetadata(stop);

  return {
    gtfsId: stop.gtfsId,
    name: stop.name,
    code: stop.code ?? '',
    lat: stop.lat,
    lon: stop.lon,
    vehicleMode: normalizeMode(stop.vehicleMode ?? undefined),
    routes: (stop.routes ?? [])
      .filter(isSearchableStopRoute)
      .map((route) => ({
        gtfsId: route.gtfsId,
        shortName: route.shortName,
        longName: route.longName,
        mode: normalizeMode(route.mode ?? undefined, route.gtfsId),
      })),
    headsigns,
    routeDirections,
  };
};

export const fetchAllRoutes = async (): Promise<Route[]> => {
  const query = `{
    routes {
      gtfsId
      shortName
      longName
      mode
    }
  }`;

  const data = await graphqlFetch<RoutesResponse>(query);

  // Deduplicate routes by shortName (API sometimes returns duplicates)
  const seen = new Set<string>();
  const routes: Route[] = [];

  for (const route of data.routes) {
    if (!isSearchableRoute(route)) continue;
    if (!seen.has(route.shortName)) {
      seen.add(route.shortName);
      routes.push(normalizeRoute(route));
    }
  }

  // Sort by route number (numeric sort)
  routes.sort((a, b) => {
    const aNum = parseInt(a.shortName, 10);
    const bNum = parseInt(b.shortName, 10);

    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return a.shortName.localeCompare(b.shortName);
  });

  return routes;
};

interface RoutePatternResponse {
  routes: Array<{
    gtfsId: string;
    shortName: string;
    patterns: Array<{
      name: string;
      geometry: Array<{ lat: number; lon: number }>;
    }>;
  }>;
}

export const fetchRoutesByIds = async (routeIds: string[]): Promise<Route[]> => {
  if (routeIds.length === 0) return [];

  const idsString = routeIds.map((id) => `"${id}"`).join(', ');

  const query = `{
    routes(ids: [${idsString}]) {
      gtfsId
      shortName
      longName
      mode
    }
  }`;

  const data = await graphqlFetch<RoutesResponse>(query);

  return data.routes
    .filter(isSearchableRoute)
    .map(normalizeRoute);
};

export const fetchRoutePatterns = async (routeIds: string[]): Promise<Map<string, RoutePattern[]>> => {
  if (routeIds.length === 0) {
    return new Map();
  }

  const idsString = routeIds.map((id) => `"${id}"`).join(', ');

  const query = `{
    routes(ids: [${idsString}]) {
      gtfsId
      shortName
      patterns {
        name
        geometry {
          lat
          lon
        }
      }
    }
  }`;

  const data = await graphqlFetch<RoutePatternResponse>(query);

  const result = new Map<string, RoutePattern[]>();

  for (const route of data.routes) {
    const patterns: RoutePattern[] = route.patterns.map((p) => ({
      gtfsId: route.gtfsId,
      name: p.name,
      geometry: p.geometry,
    }));
    result.set(route.gtfsId, patterns);
  }

  return result;
};

// Check if the API key is configured
export const isApiKeyConfigured = (): boolean => {
  const key = getApiKey();
  return !!key && key !== 'your_api_key_here';
};

// Cache routes in localStorage
const ROUTES_CACHE_KEY = 'busmap-routes-cache';
const ROUTES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface RoutesCache {
  routes: RawRoute[];
  timestamp: number;
}

export const getCachedRoutes = (): Route[] | null => {
  try {
    const cached = localStorage.getItem(ROUTES_CACHE_KEY);
    if (!cached) return null;

    const data: RoutesCache = JSON.parse(cached);
    if (Date.now() - data.timestamp > ROUTES_CACHE_TTL) {
      localStorage.removeItem(ROUTES_CACHE_KEY);
      return null;
    }

    const routes = data.routes.filter(isSearchableRoute).map(normalizeRoute);
    if (routes.length === 0) {
      localStorage.removeItem(ROUTES_CACHE_KEY);
      return null;
    }

    setCachedRoutes(routes);
    return routes;
  } catch {
    return null;
  }
};

export const setCachedRoutes = (routes: Route[]): void => {
  try {
    const data: RoutesCache = {
      routes,
      timestamp: Date.now(),
    };
    localStorage.setItem(ROUTES_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
};

// Cache stops in localStorage
const STOPS_CACHE_KEY = 'busmap-stops-cache';
const STOPS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface StopsCache {
  stops: Stop[];
  timestamp: number;
}

const isCachedStop = (stop: Stop | null): stop is Stop => (
  typeof stop?.gtfsId === 'string' && stop.gtfsId.length > 0
  && typeof stop.name === 'string' && stop.name.length > 0
  && typeof stop.lat === 'number'
  && typeof stop.lon === 'number'
  && Array.isArray(stop.routes)
);

export const getCachedStops = (): Stop[] | null => {
  try {
    const cached = localStorage.getItem(STOPS_CACHE_KEY);
    if (!cached) return null;

    const data: StopsCache = JSON.parse(cached);
    if (Date.now() - data.timestamp > STOPS_CACHE_TTL) {
      localStorage.removeItem(STOPS_CACHE_KEY);
      return null;
    }

    const stops = data.stops.filter(isCachedStop);
    if (stops.length === 0) {
      localStorage.removeItem(STOPS_CACHE_KEY);
      return null;
    }

    return stops;
  } catch {
    return null;
  }
};

export const setCachedStops = (stops: Stop[]): void => {
  try {
    const data: StopsCache = {
      stops,
      timestamp: Date.now(),
    };
    localStorage.setItem(STOPS_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
};

interface StopsResponse {
  stops: Array<RawStop | null>;
}

export const fetchAllStops = async (): Promise<Stop[]> => {
  const query = `{
    stops {
      gtfsId
      name
      code
      lat
      lon
      vehicleMode
      routes {
        gtfsId
        shortName
        longName
        mode
      }
      patterns {
        headsign
        directionId
        route {
          gtfsId
        }
      }
    }
  }`;

  const data = await graphqlFetch<StopsResponse>(query);

  return data.stops
    .filter(isSearchableStop)
    .map(normalizeStop)
    .sort((a, b) => {
      const codeCompare = a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
      if (codeCompare !== 0) return codeCompare;
      return a.name.localeCompare(b.name);
    });
};

// Fetch stop timetable with upcoming departures and direction info
export interface StopTimetableResult {
  departures: StopDeparture[];
  directions: Record<string, number[]>; // routeGtfsId -> allowed MQTT direction values (1 or 2)
}

interface StopTimetableResponse {
  stop: {
    stoptimesWithoutPatterns: Array<{
      scheduledDeparture: number;
      realtimeDeparture: number;
      departureDelay: number;
      realtime: boolean;
      realtimeState: string;
      headsign: string;
      serviceDay: number;
      trip: {
        directionId: string;
        departureStoptime: {
          scheduledDeparture: number; // seconds from midnight at first stop
        };
        route: {
          gtfsId: string;
          shortName: string;
          longName: string;
          mode: string;
        };
      };
    }>;
  };
}

export const fetchStopTimetable = async (stopId: string): Promise<StopTimetableResult> => {
  const query = `{
    stop(id: "${stopId}") {
      stoptimesWithoutPatterns(numberOfDepartures: 20) {
        scheduledDeparture
        realtimeDeparture
        departureDelay
        realtime
        realtimeState
        headsign
        serviceDay
        trip {
          directionId
          departureStoptime {
            scheduledDeparture
          }
          route {
            gtfsId
            shortName
            longName
            mode
          }
        }
      }
    }
  }`;

  const data = await graphqlFetch<StopTimetableResponse>(query);

  const directionMap: Record<string, Set<number>> = {};
  const departures: StopDeparture[] = data.stop.stoptimesWithoutPatterns.map((st) => {
    const gtfsDir = parseInt(st.trip.directionId, 10);
    const mqttDir = gtfsDir + 1; // GTFS 0 -> MQTT 1, GTFS 1 -> MQTT 2

    if (!directionMap[st.trip.route.gtfsId]) {
      directionMap[st.trip.route.gtfsId] = new Set();
    }
    directionMap[st.trip.route.gtfsId].add(mqttDir);

    return {
      scheduledDeparture: st.scheduledDeparture,
      realtimeDeparture: st.realtimeDeparture,
      departureDelay: st.departureDelay,
      realtime: st.realtime,
      realtimeState: st.realtimeState,
      headsign: st.headsign,
      serviceDay: st.serviceDay,
      routeGtfsId: st.trip.route.gtfsId,
      routeShortName: st.trip.route.shortName,
      routeLongName: st.trip.route.longName,
      routeMode: normalizeMode(st.trip.route.mode, st.trip.route.gtfsId),
      directionId: gtfsDir,
      tripStartTime: (() => {
        const secs = st.trip.departureStoptime.scheduledDeparture;
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      })(),
    };
  });

  const directions: Record<string, number[]> = {};
  for (const [routeId, dirs] of Object.entries(directionMap)) {
    directions[routeId] = Array.from(dirs);
  }

  return { departures, directions };
};

// Fetch routes for a specific stop
interface StopRoutesResponse {
  stop: {
    gtfsId: string;
    name: string;
    code: string;
    lat: number;
    lon: number;
    vehicleMode: string;
    routes: Array<{
      gtfsId: string;
      shortName: string;
      longName: string;
      mode: string;
    }>;
  };
}

export const fetchStopRoutes = async (stopId: string): Promise<StopRoute[]> => {
  const query = `{
    stop(id: "${stopId}") {
      routes {
        gtfsId
        shortName
        longName
        mode
      }
    }
  }`;

  const data = await graphqlFetch<StopRoutesResponse>(query);

  return data.stop.routes.map((r) => ({
    gtfsId: r.gtfsId,
    shortName: r.shortName,
    longName: r.longName,
    mode: normalizeMode(r.mode, r.gtfsId),
  }));
};
