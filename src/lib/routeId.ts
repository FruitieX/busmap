import { getProvider } from '@/lib/provider';

/** Prefix applied to route GTFS IDs (e.g. "HSL:" for Helsinki, "VN:" for Vietnam). */
export const getRouteIdPrefix = (): string => getProvider().routeIdPrefix;

/** Prefix a bare route ID if it isn't already prefixed. */
export const prefixRouteId = (routeId: string): string => {
  const prefix = getRouteIdPrefix();
  return routeId.startsWith(prefix) ? routeId : `${prefix}${routeId}`;
};

/** Strip the provider prefix from a route GTFS ID. */
export const stripRouteIdPrefix = (routeId: string): string => {
  const prefix = getRouteIdPrefix();
  return routeId.startsWith(prefix) ? routeId.slice(prefix.length) : routeId;
};
