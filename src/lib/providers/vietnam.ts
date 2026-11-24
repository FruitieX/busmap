import type {
  Route, RoutePattern, Stop, StopRoute, VehicleTrip,
  TransportMode,
} from '@/types';
import {
  ParsedVehicle, StopTimetableResult, TransitProvider,
} from '@/lib/provider';
import { stripRouteIdPrefix } from '@/lib/routeId';

const getEnv = (name: string, fallback: string): string => {
  return import.meta.env[name] ?? fallback;
};

const API_BASE = getEnv('VITE_VIETNAM_API_BASE', '');
const SEARCH_URL = `${API_BASE}/Engine/Business/Search/action.ashx`;

const requestHeaders: Record<string, string> = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': 'application/json',
  'Referer': 'http://timbus.vn/',
  'X-Requested-With': 'XMLHttpRequest',
};

const postForm = async (url: string, body: Record<string, string>): Promise<unknown> => {
  const formBody = Object.entries(body)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const response = await fetch(url, {
    method: 'POST',
    headers: requestHeaders,
    body: formBody,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
};

const getDt = (payload: unknown): unknown => {
  const p = payload as Record<string, unknown> | null;
  if (!p) return null;
  return p.dt ?? null;
};

const parseGeoString = (value: unknown): { lat: number; lon: number } | null => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Try "lat,lng" or "lng,lat"
    const parts = trimmed.split(',').map((p) => Number(p.trim()));
    if (parts.length === 2 && parts.every((p) => Number.isFinite(p))) {
      const [a, b] = parts;
      // Heuristic: lat is in [-90, 90], lng is in [-180, 180]
      if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
        return { lat: a, lon: b };
      }
      if (Math.abs(b) <= 90 && Math.abs(a) <= 180) {
        return { lat: b, lon: a };
      }
    }
    return null;
  }

  if (Array.isArray(value)) {
    const arr = value as unknown[];
    if (arr.length >= 2) {
      const a = Number(arr[0]);
      const b = Number(arr[1]);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
          return { lat: a, lon: b };
        }
        if (Math.abs(b) <= 90 && Math.abs(a) <= 180) {
          return { lat: b, lon: a };
        }
      }
    }
    return null;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const lat = Number(obj.lat ?? obj.latitude ?? obj.y ?? 0);
    const lon = Number(obj.lon ?? obj.longitude ?? obj.lng ?? obj.x ?? 0);
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return { lat, lon };
    }
    return null;
  }

  return null;
};

const parseGeoList = (value: unknown): { lat: number; lon: number }[] => {
  if (value === null || value === undefined) return [];

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    // Could be "lat1,lng1;lat2,lng2;..." or "lat1,lng1 lat2,lng2" etc.
    const segments = trimmed.split(/[;\s|]+/).filter(Boolean);
    const points: { lat: number; lon: number }[] = [];
    for (const seg of segments) {
      const pt = parseGeoString(seg);
      if (pt) points.push(pt);
    }
    return points;
  }

  if (Array.isArray(value)) {
    const points: { lat: number; lon: number }[] = [];
    for (const item of value as unknown[]) {
      const pt = parseGeoString(item);
      if (pt) points.push(pt);
    }
    return points;
  }

  return [];
};

const routeIdToFleetId = (routeId: string): string => stripRouteIdPrefix(routeId);

export const vietnamProvider: TransitProvider = {
  id: 'vietnam',
  label: 'Vietnam Transit (timbus.vn)',
  cacheKeyPrefix: 'busmap-vietnam-',
  routeIdPrefix: getEnv('VITE_VIETNAM_ROUTE_ID_PREFIX', 'TB:'),
  timezone: getEnv('VITE_VIETNAM_TIMEZONE', 'Asia/Ho_Chi_Minh'),
  mqttBroker: '',
  mqttTopicPrefix: '',
  mqttDirOffset: 1,
  isApiKeyConfigured: () => true,
  normalizeMode: (): TransportMode => 'bus',
  fetchAllRoutes: async (): Promise<Route[]> => {
    if (!API_BASE) return [];

    try {
      const payload = await postForm(SEARCH_URL, {
        act: 'searchfull',
        typ: '1',
        key: '',
      });

      const dt = getDt(payload);
      if (!dt || typeof dt !== 'object') return [];

      const data = (dt as Record<string, unknown>).Data;
      if (!Array.isArray(data)) return [];

      return data
        .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
        .map((r) => normalizeVietnamRoute(r));
    } catch {
      return [];
    }
  },
  fetchAllStops: async (): Promise<Stop[]> => {
    // timbus.vn has no standalone "all stops" endpoint. Stops are loaded
    // per-route via fleetdetail, so return empty here and let callers
    // use fetchStopRoutes / fetchRoutePatterns to discover stops.
    return [];
  },
  fetchRoutesByIds: async (routeIds: string[]): Promise<Route[]> => {
    if (!API_BASE || routeIds.length === 0) return [];

    const routes: Route[] = [];
    for (const routeId of routeIds) {
      try {
        const fid = routeIdToFleetId(routeId);
        const payload = await postForm(SEARCH_URL, {
          act: 'fleetdetail',
          fid,
        });

        const dt = getDt(payload);
        if (!dt || typeof dt !== 'object') continue;

        const d = dt as Record<string, unknown>;
        routes.push(normalizeVietnamRouteFromDetail(d));
      } catch {
        // Skip individual route failures
      }
    }
    return routes;
  },
  fetchRoutePatterns: async (routeIds: string[]): Promise<Map<string, RoutePattern[]>> => {
    const result = new Map<string, RoutePattern[]>();
    if (!API_BASE || routeIds.length === 0) return result;

    for (const routeId of routeIds) {
      result.set(routeId, []);
      try {
        const fid = routeIdToFleetId(routeId);
        const payload = await postForm(SEARCH_URL, {
          act: 'fleetdetail',
          fid,
        });

        const dt = getDt(payload);
        if (!dt || typeof dt !== 'object') continue;

        const d = dt as Record<string, unknown>;
        const patterns: RoutePattern[] = [];

        for (const dirKey of ['Go', 'Re']) {
          const dir = d[dirKey];
          if (!dir || typeof dir !== 'object') continue;

          const dirObj = dir as Record<string, unknown>;
          const geo = dirObj.Geo;
          const geometry = parseGeoList(geo);

          if (geometry.length > 0) {
            patterns.push({
              gtfsId: routeId,
              name: dirKey === 'Go' ? 'Outbound' : 'Inbound',
              geometry,
            });
          }
        }

        result.set(routeId, patterns);
      } catch {
        // Skip individual route failures
      }
    }
    return result;
  },
  fetchStopTimetable: async (): Promise<StopTimetableResult> => {
    // timbus.vn static API does not expose live departures/ETAs.
    return { departures: [], directions: {} };
  },
  fetchVehicleTrip: async (): Promise<VehicleTrip | null> => {
    // timbus.vn static API does not expose live vehicle trips.
    return null;
  },
  fetchStopRoutes: async (): Promise<StopRoute[]> => {
    // Stop-to-routes mapping requires loading route details first.
    // Return empty; callers can use fetchRoutesByIds / fetchRoutePatterns.
    return [];
  },
  parseVehicleMessage: (): ParsedVehicle | null => {
    // timbus.vn has no live vehicle GPS feed.
    return null;
  },
};

const normalizeVietnamRoute = (raw: Record<string, unknown>): Route => {
  const objectID = raw.ObjectID ?? raw.objectID ?? raw.id ?? raw.route_id ?? '';
  const shortName = String(
    raw.ShortName ?? raw.short_name ?? raw.route_short_name ??
    raw.Name ?? raw.name ?? '',
  );
  const longName = String(
    raw.LongName ?? raw.long_name ?? raw.route_long_name ??
    raw.Name ?? raw.name ?? '',
  );
  const cost = raw.Cost ?? raw.cost ?? null;

  return {
    gtfsId: `${getEnv('VITE_VIETNAM_ROUTE_ID_PREFIX', 'TB:')}${objectID}`,
    shortName: shortName || String(objectID),
    longName: longName || shortName || String(objectID),
    mode: 'bus',
    ...(cost !== null && cost !== undefined ? { color: undefined } : {}),
  };
};

const normalizeVietnamRouteFromDetail = (d: Record<string, unknown>): Route => {
  const objectID = d.ObjectID ?? d.objectID ?? d.id ?? '';
  const shortName = String(
    d.ShortName ?? d.short_name ?? d.route_short_name ??
    d.Name ?? d.name ?? String(objectID),
  );
  const longName = String(
    d.LongName ?? d.long_name ?? d.route_long_name ??
    d.Name ?? d.name ?? shortName,
  );

  return {
    gtfsId: `${getEnv('VITE_VIETNAM_ROUTE_ID_PREFIX', 'TB:')}${objectID}`,
    shortName: shortName || String(objectID),
    longName: longName || shortName || String(objectID),
    mode: 'bus',
  };
};
