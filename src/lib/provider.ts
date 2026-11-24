import type {
  Route, RoutePattern, Stop, StopRoute, StopDeparture, VehicleTrip,
  TransportMode,
} from '@/types';

export interface ParsedVehicle {
  vehicleId: string;
  operatorId: number;
  vehicleNumber: number;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  acceleration: number;
  routeId: string;
  routeShortName: string;
  direction: 1 | 2;
  headsign: string;
  startTime: string;
  operatingDay: string;
  delay: number;
  nextStopId: string | null;
  doorStatus: 0 | 1;
  occupancy: number;
  timestamp: Date;
  mode: TransportMode;
}

export interface StopTimetableResult {
  departures: StopDeparture[];
  directions: Record<string, number[]>;
}

export interface TransitProvider {
  id: string;
  label: string;
  cacheKeyPrefix: string;
  routeIdPrefix: string;
  timezone: string;
  mqttBroker: string;
  mqttTopicPrefix: string;
  mqttDirOffset: number;
  isApiKeyConfigured(): boolean;
  normalizeMode(mode?: string, gtfsId?: string): TransportMode;
  fetchAllRoutes(): Promise<Route[]>;
  fetchAllStops(): Promise<Stop[]>;
  fetchRoutesByIds(routeIds: string[]): Promise<Route[]>;
  fetchRoutePatterns(routeIds: string[]): Promise<Map<string, RoutePattern[]>>;
  fetchStopTimetable(stopId: string): Promise<StopTimetableResult>;
  fetchVehicleTrip(
    routeId: string,
    direction: 1 | 2,
    operatingDay: string,
    startTime: string,
  ): Promise<VehicleTrip | null>;
  fetchStopRoutes(stopId: string): Promise<StopRoute[]>;
  parseVehicleMessage(topic: string, payload: Buffer): ParsedVehicle | null;
}

const providers = new Map<string, TransitProvider>();

export const registerProvider = (provider: TransitProvider): void => {
  providers.set(provider.id, provider);
};

export const getProvider = (id?: string): TransitProvider => {
  const selected = id ?? import.meta.env.VITE_TRANSIT_PROVIDER ?? 'hsl';
  const provider = providers.get(selected);
  if (!provider) {
    const available = Array.from(providers.keys()).join(', ');
    throw new Error(
      `Transit provider "${selected}" is not registered. Available providers: ${available}`,
    );
  }
  return provider;
};

export const listProviders = (): TransitProvider[] => Array.from(providers.values());

export const routeIdWithPrefix = (routeId: string, prefix: string): string => (
  routeId.startsWith(prefix) ? routeId : `${prefix}${routeId}`
);

export const routeIdWithoutPrefix = (routeId: string, prefix: string): string => (
  routeId.startsWith(prefix) ? routeId.slice(prefix.length) : routeId
);
