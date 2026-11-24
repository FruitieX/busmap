import type {
  Route, RoutePattern, Stop, StopRoute, StopDeparture, VehicleTrip,
  TransportMode,
} from '@/types';
import {
  ParsedVehicle, StopTimetableResult, TransitProvider,
  routeIdWithoutPrefix,
} from '@/lib/provider';

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

  const id = routeIdWithoutPrefix(gtfsId, 'HSL:');

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

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isOptionalString = (value: unknown): value is string | null | undefined => (
  value === undefined || value === null || typeof value === 'string'
);

const isSearchableRoute = (route: unknown): route is SearchableRawRoute => {
  if (!isRecord(route)) return false;

  return typeof route.gtfsId === 'string' && route.gtfsId.length > 0
    && typeof route.shortName === 'string' && route.shortName.length > 0
    && typeof route.longName === 'string'
    && isOptionalString(route.mode)
    && isOptionalString(route.color);
};

const normalizeRoute = (route: SearchableRawRoute): Route => ({
  gtfsId: route.gtfsId,
  shortName: route.shortName,
  longName: route.longName,
  mode: normalizeMode(route.mode ?? undefined, route.gtfsId),
  color: route.color ?? undefined,
});

const isSearchableStop = (stop: unknown): stop is RawStop & {
  gtfsId: string;
  name: string;
  lat: number;
  lon: number;
} => {
  if (!isRecord(stop)) return false;

  return typeof stop.gtfsId === 'string' && stop.gtfsId.length > 0
    && typeof stop.name === 'string' && stop.name.length > 0
    && typeof stop.lat === 'number'
    && typeof stop.lon === 'number'
    && isOptionalString(stop.code)
    && isOptionalString(stop.vehicleMode)
    && (stop.routes === undefined || stop.routes === null || Array.isArray(stop.routes))
    && (stop.patterns === undefined || stop.patterns === null || Array.isArray(stop.patterns));
};

const isSearchableStopRoute = (route: unknown): route is RawStopRoute & {
  gtfsId: string;
  shortName: string;
  longName: string;
} => {
  if (!isRecord(route)) return false;

  return typeof route.gtfsId === 'string' && route.gtfsId.length > 0
    && typeof route.shortName === 'string' && route.shortName.length > 0
    && typeof route.longName === 'string'
    && isOptionalString(route.mode);
};

const sortRoutesByShortName = (routes: Route[]): Route[] => routes.sort((firstRoute, secondRoute) => {
  const firstNumber = parseInt(firstRoute.shortName, 10);
  const secondNumber = parseInt(secondRoute.shortName, 10);

  if (!isNaN(firstNumber) && !isNaN(secondNumber)) {
    return firstNumber - secondNumber;
  }
  return firstRoute.shortName.localeCompare(secondRoute.shortName);
});

const normalizeRouteList = (rawRoutes: unknown[]): Route[] => {
  const seen = new Set<string>();
  const routes: Route[] = [];

  for (const route of rawRoutes) {
    if (!isSearchableRoute(route)) continue;
    if (seen.has(route.shortName)) continue;

    seen.add(route.shortName);
    routes.push(normalizeRoute(route));
  }

  return sortRoutesByShortName(routes);
};

const getStopPatternMetadata = (stop: RawStop) => {
  const headsigns = new Set<string>();
  const routeDirections: Record<string, number[]> = {};

  const patterns = Array.isArray(stop.patterns) ? stop.patterns : [];
  for (const pattern of patterns) {
    if (!isRecord(pattern)) continue;

    if (typeof pattern.headsign === 'string') {
      headsigns.add(pattern.headsign);
    }

    const routeId = isRecord(pattern.route) && typeof pattern.route.gtfsId === 'string'
      ? pattern.route.gtfsId
      : null;
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
    routes: (Array.isArray(stop.routes) ? stop.routes : [])
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

// GTFS service time starts twelve hours before local noon, including on DST
// transition days. Trip.stoptimes may return serviceDay=-1 (schedule only).
const getHelsinkiServiceDay = (operatingDay: string): number => {
  const noonUtc = new Date(`${operatingDay}T12:00:00Z`);
  const localHour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Helsinki', hour: '2-digit', hourCycle: 'h23',
  }).format(noonUtc));
  return noonUtc.getTime() / 1000 - localHour * 3600;
};

const escapeGraphqlString = (value: string): string => (
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
);

const parseTripStartTime = (value: string): number | null => {
  const match = /^(\d+):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) return null;
  return hours * 60 * 60 + minutes * 60;
};

interface VehicleTripResponse {
  fuzzyTrip: {
    gtfsId: string;
    directionId: string;
    tripHeadsign: string | null;
    stoptimesForDate: Array<{
      stop: {
        gtfsId: string;
        name: string;
        code: string;
        lat: number;
        lon: number;
      } | null;
      serviceDay: number;
      stopPositionInPattern: number;
      scheduledArrival: number | null;
      scheduledDeparture: number | null;
      realtimeArrival: number | null;
      realtimeDeparture: number | null;
      departureDelay: number | null;
      realtime: boolean | null;
      realtimeState: string | null;
    } | null>;
  } | null;
}

interface StopsResponse {
  stops: Array<RawStop | null>;
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
          scheduledDeparture: number;
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

interface RoutePatternResponse {
  routes: Array<null | {
    gtfsId: string;
    shortName: string;
    patterns: Array<{
      name: string;
      geometry: Array<{ lat: number; lon: number }>;
    }>;
  }>;
}

// HFP topic structure:
// /hfp/v2/journey/ongoing/vp/<transport_mode>/<operator_id>/<vehicle_number>/<route_id>/<direction_id>/<headsign>/<start_time>/<next_stop>/<geohash_level>/<geohash>/#

interface HfpPayload {
  VP?: {
    desi: string;
    dir: string;
    oper: number;
    veh: number;
    tst: string;
    tsi: number;
    spd: number;
    hdg: number;
    lat: number | null;
    long: number | null;
    acc: number;
    dl: number;
    odo: number;
    drst: number;
    oday: string;
    jrn: number;
    line: number;
    start: string;
    loc: string;
    stop: string | number | null;
    route: string;
    occu: number;
  };
}

const parseHfpMessage = (topic: string, payload: Buffer): ParsedVehicle | null => {
  let data: HfpPayload;
  try {
    data = JSON.parse(payload.toString());
  } catch {
    return null;
  }

  const vp = data.VP;
  if (!vp || vp.lat == null || vp.long == null
    || !Number.isFinite(vp.lat) || Math.abs(vp.lat) > 90
    || !Number.isFinite(vp.long) || Math.abs(vp.long) > 180
    || !Number.isFinite(Date.parse(vp.tst))) {
    return null;
  }

  const topicParts = topic.split('/');
  const mode = (topicParts[6] || 'bus') as TransportMode;

  const vehicleId = `${vp.oper}/${vp.veh}`;

  return {
    vehicleId,
    operatorId: vp.oper,
    vehicleNumber: vp.veh,
    lat: vp.lat,
    lng: vp.long,
    heading: Number.isFinite(vp.hdg) ? vp.hdg : 0,
    speed: Number.isFinite(vp.spd) ? Math.max(0, vp.spd) : 0,
    acceleration: Number.isFinite(vp.acc) ? vp.acc : 0,
    routeId: vp.route,
    routeShortName: vp.desi,
    direction: vp.dir === '2' ? 2 : 1,
    headsign: topicParts[11] || '',
    startTime: vp.start,
    operatingDay: vp.oday,
    delay: Number.isFinite(vp.dl) ? vp.dl : 0,
    nextStopId: vp.stop == null || vp.stop === 0 ? null : String(vp.stop),
    doorStatus: vp.drst as 0 | 1,
    occupancy: vp.occu,
    timestamp: new Date(vp.tst),
    mode,
  };
};


export const hslProvider: TransitProvider = {
  id: 'hsl',
  label: 'HSL (Helsinki)',
  cacheKeyPrefix: 'busmap-',
  routeIdPrefix: 'HSL:',
  timezone: 'Europe/Helsinki',
  mqttBroker: 'wss://mqtt.hsl.fi:443/',
  mqttTopicPrefix: '/hfp/v2/journey/ongoing/vp',
  mqttDirOffset: 1,
  isApiKeyConfigured: () => {
    const key = getApiKey();
    return !!key && key !== 'your_api_key_here';
  },
  normalizeMode,
  fetchAllRoutes: async (): Promise<Route[]> => {
    const query = `{
      routes {
        gtfsId
        shortName
        longName
        mode
      }
    }`;

    const data = await graphqlFetch<RoutesResponse>(query);
    return normalizeRouteList(data.routes);
  },
  fetchAllStops: async (): Promise<Stop[]> => {
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
  },
  fetchRoutesByIds: async (routeIds: string[]): Promise<Route[]> => {
    if (routeIds.length === 0) return [];

    const idsString = routeIds.map((routeId) => `"${routeId}"`).join(', ');

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
  },
  fetchRoutePatterns: async (routeIds: string[]): Promise<Map<string, RoutePattern[]>> => {
    if (routeIds.length === 0) {
      return new Map();
    }

    const idsString = routeIds.map((routeId) => `"${routeId}"`).join(', ');

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
      if (!route?.gtfsId || !Array.isArray(route.patterns)) continue;

      const patterns: RoutePattern[] = route.patterns.map((p) => ({
        gtfsId: route.gtfsId,
        name: p.name,
        geometry: p.geometry,
      }));
      result.set(route.gtfsId, patterns);
    }

    for (const routeId of routeIds) {
      if (!result.has(routeId)) {
        result.set(routeId, []);
      }
    }

    return result;
  },
  fetchStopTimetable: async (stopId: string): Promise<StopTimetableResult> => {
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
  },
  fetchVehicleTrip: async (
    routeId: string,
    direction: 1 | 2,
    operatingDay: string,
    startTime: string,
  ): Promise<VehicleTrip | null> => {
    const startSeconds = parseTripStartTime(startTime);
    if (startSeconds === null || !/^\d{4}-\d{2}-\d{2}$/.test(operatingDay)
      || !Number.isFinite(Date.parse(`${operatingDay}T12:00:00Z`))) return null;

    const query = `{
      fuzzyTrip(
        route: "${escapeGraphqlString(routeId)}"
        direction: ${direction - 1}
        date: "${escapeGraphqlString(operatingDay)}"
        time: ${startSeconds}
      ) {
        gtfsId
        directionId
        tripHeadsign
        stoptimesForDate(serviceDate: "${escapeGraphqlString(operatingDay)}") {
          serviceDay
          stop {
            gtfsId
            name
            code
            lat
            lon
          }
          stopPositionInPattern
          scheduledArrival
          scheduledDeparture
          realtimeArrival
          realtimeDeparture
          departureDelay
          realtime
          realtimeState
        }
      }
    }`;

    const data = await graphqlFetch<VehicleTripResponse>(query);
    const trip = data.fuzzyTrip;
    if (!trip) return null;

    return {
      gtfsId: trip.gtfsId,
      directionId: Number(trip.directionId),
      headsign: trip.tripHeadsign ?? '',
      stops: trip.stoptimesForDate.flatMap((st) => {
        if (!st?.stop) return [];

        return [{
          gtfsId: st.stop.gtfsId,
          name: st.stop.name,
          code: st.stop.code,
          lat: st.stop.lat,
          lon: st.stop.lon,
          serviceDay: st.serviceDay > 0 ? st.serviceDay : getHelsinkiServiceDay(operatingDay),
          stopPosition: st.stopPositionInPattern,
          scheduledArrival: st.scheduledArrival,
          scheduledDeparture: st.scheduledDeparture,
          realtimeArrival: st.realtimeArrival,
          realtimeDeparture: st.realtimeDeparture,
          departureDelay: st.departureDelay ?? 0,
          realtime: st.realtime ?? false,
          realtimeState: st.realtimeState ?? 'SCHEDULED',
        }];
      }),
    };
  },
  fetchStopRoutes: async (stopId: string): Promise<StopRoute[]> => {
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
  },
  parseVehicleMessage: parseHfpMessage,
};
