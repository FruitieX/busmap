import type {
  Route, RoutePattern, Stop, StopRoute, VehicleTrip,
  TransportMode,
} from '@/types';
import {
  ParsedVehicle, StopTimetableResult, TransitProvider,
} from '@/lib/provider';

const getEnv = (name: string, fallback: string): string => {
  return import.meta.env[name] ?? fallback;
};

// Vietnam transit provider. Configuration is read from Vite env variables so
// operators in different Vietnamese cities can point the app at their own
// GTFS/realtime endpoints without code changes.
//
// Recommended env vars:
//   VITE_TRANSIT_PROVIDER=vietnam
//   VITE_VIETNAM_API_BASE=https://api.example.com/gtfs
//   VITE_VIETNAM_API_KEY=optional_key
//   VITE_VIETNAM_MQTT_BROKER=wss://mqtt.example.com/
//   VITE_VIETNAM_MQTT_TOPIC_PREFIX=/hfp/v2/journey/ongoing/vp
//   VITE_VIETNAM_ROUTE_ID_PREFIX=VN:
//   VITE_VIETNAM_MQTT_DIR_OFFSET=1
//   VITE_VIETNAM_TIMEZONE=Asia/Ho_Chi_Minh
export const vietnamProvider: TransitProvider = {
  id: 'vietnam',
  label: 'Vietnam Transit',
  cacheKeyPrefix: 'busmap-vietnam-',
  routeIdPrefix: getEnv('VITE_VIETNAM_ROUTE_ID_PREFIX', 'VN:'),
  timezone: getEnv('VITE_VIETNAM_TIMEZONE', 'Asia/Ho_Chi_Minh'),
  mqttBroker: getEnv('VITE_VIETNAM_MQTT_BROKER', ''),
  mqttTopicPrefix: getEnv('VITE_VIETNAM_MQTT_TOPIC_PREFIX', '/hfp/v2/journey/ongoing/vp'),
  mqttDirOffset: Number(getEnv('VITE_VIETNAM_MQTT_DIR_OFFSET', '1')) || 1,
  isApiKeyConfigured: () => true,
  normalizeMode: (mode?: string): TransportMode => {
    if (!mode) return 'bus';
    const m = mode.toLowerCase();
    if (m === 'subway' || m === 'metro') return 'metro';
    if (m === 'rail' || m === 'train') return 'train';
    if (m === 'bus') return 'bus';
    if (m === 'tram') return 'tram';
    if (m === 'ferry') return 'ferry';
    return 'bus';
  },
  fetchAllRoutes: async (): Promise<Route[]> => {
    const base = getEnv('VITE_VIETNAM_API_BASE', '');
    if (!base) return [];

    try {
      const response = await fetch(`${base}/routes`, {
        headers: {
          'Accept': 'application/json',
          ...(getEnv('VITE_VIETNAM_API_KEY', '') ? { 'Authorization': `Bearer ${getEnv('VITE_VIETNAM_API_KEY', '')}` } : {}),
        },
      });
      if (!response.ok) return [];
      const data = await response.json();
      const routes = Array.isArray(data) ? data : data.routes ?? [];
      return routes.map((r: unknown) => normalizeVietnamRoute(r));
    } catch {
      return [];
    }
  },
  fetchAllStops: async (): Promise<Stop[]> => {
    const base = getEnv('VITE_VIETNAM_API_BASE', '');
    if (!base) return [];

    try {
      const response = await fetch(`${base}/stops`, {
        headers: {
          'Accept': 'application/json',
          ...(getEnv('VITE_VIETNAM_API_KEY', '') ? { 'Authorization': `Bearer ${getEnv('VITE_VIETNAM_API_KEY', '')}` } : {}),
        },
      });
      if (!response.ok) return [];
      const data = await response.json();
      const stops = Array.isArray(data) ? data : data.stops ?? [];
      return stops.map((s: unknown) => normalizeVietnamStop(s));
    } catch {
      return [];
    }
  },
  fetchRoutesByIds: async (routeIds: string[]): Promise<Route[]> => {
    const base = getEnv('VITE_VIETNAM_API_BASE', '');
    if (!base || routeIds.length === 0) return [];

    try {
      const ids = routeIds.map((id) => encodeURIComponent(id)).join(',');
      const response = await fetch(`${base}/routes?ids=${ids}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) return [];
      const data = await response.json();
      const routes = Array.isArray(data) ? data : data.routes ?? [];
      return routes.map((r: unknown) => normalizeVietnamRoute(r));
    } catch {
      return [];
    }
  },
  fetchRoutePatterns: async (routeIds: string[]): Promise<Map<string, RoutePattern[]>> => {
    const result = new Map<string, RoutePattern[]>();
    for (const routeId of routeIds) result.set(routeId, []);
    const base = getEnv('VITE_VIETNAM_API_BASE', '');
    if (!base) return result;

    for (const routeId of routeIds) {
      try {
        const response = await fetch(`${base}/routes/${encodeURIComponent(routeId)}/patterns`, {
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) continue;
        const data = await response.json();
        const patterns = Array.isArray(data) ? data : data.patterns ?? [];
        result.set(routeId, patterns.map((p: unknown) => normalizeVietnamPattern(routeId, p)));
      } catch {
        // Skip individual route pattern failures
      }
    }
    return result;
  },
  fetchStopTimetable: async (_stopId: string): Promise<StopTimetableResult> => {
    return { departures: [], directions: {} };
  },
  fetchVehicleTrip: async (): Promise<VehicleTrip | null> => {
    return null;
  },
  fetchStopRoutes: async (_stopId: string): Promise<StopRoute[]> => {
    return [];
  },
  parseVehicleMessage: (_topic: string, _payload: Buffer): ParsedVehicle | null => {
    return null;
  },
};

const normalizeVietnamRoute = (raw: unknown): Route => {
  const r = raw as Record<string, unknown>;
  return {
    gtfsId: String(r.gtfsId ?? r.id ?? r.route_id ?? ''),
    shortName: String(r.shortName ?? r.short_name ?? r.route_short_name ?? r.name ?? ''),
    longName: String(r.longName ?? r.long_name ?? r.route_long_name ?? r.name ?? ''),
    mode: 'bus',
    color: r.color ? String(r.color) : undefined,
  };
};

const normalizeVietnamStop = (raw: unknown): Stop => {
  const s = raw as Record<string, unknown>;
  return {
    gtfsId: String(s.gtfsId ?? s.id ?? s.stop_id ?? ''),
    name: String(s.name ?? s.stop_name ?? ''),
    code: String(s.code ?? s.stop_code ?? ''),
    lat: Number(s.lat ?? s.latitude ?? 0),
    lon: Number(s.lon ?? s.longitude ?? 0),
    vehicleMode: 'bus',
    routes: [],
    headsigns: [],
    routeDirections: {},
  };
};

const normalizeVietnamPattern = (routeId: string, raw: unknown): RoutePattern => {
  const p = raw as Record<string, unknown>;
  const geometry = Array.isArray(p.geometry) ? p.geometry : [];
  return {
    gtfsId: routeId,
    name: String(p.name ?? p.pattern_name ?? ''),
    geometry: geometry.map((g: unknown) => {
      const coord = g as Record<string, unknown>;
      return { lat: Number(coord.lat ?? coord.latitude ?? 0), lon: Number(coord.lon ?? coord.longitude ?? coord.lng ?? 0) };
    }),
  };
};
