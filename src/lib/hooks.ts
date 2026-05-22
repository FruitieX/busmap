import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { fetchAllRoutes, fetchAllStops, fetchRoutePatterns, fetchStopTimetable, getCachedRoutes, getCachedStops, setCachedRoutes, setCachedStops, isApiKeyConfigured } from './api';
import type { StopTimetableResult } from './api';
import type { Route, RoutePattern, Stop } from '@/types';

const ROUTES_QUERY_KEY = ['routes', 'normalized'] as const;
const STOPS_QUERY_KEY = ['stops', 'normalized'] as const;

export const useRoutes = () => {
  const queryClient = useQueryClient();

  return useQuery<Route[], Error>({
    queryKey: ROUTES_QUERY_KEY,
    queryFn: async () => {
      // Try cache first
      const cached = getCachedRoutes();
      if (cached) {
        // Still fetch in background to update cache
        fetchAllRoutes()
          .then((routes) => {
            setCachedRoutes(routes);
            queryClient.setQueryData(ROUTES_QUERY_KEY, routes);
          })
          .catch(() => {});
        return cached;
      }

      const routes = await fetchAllRoutes();
      setCachedRoutes(routes);
      return routes;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    enabled: isApiKeyConfigured(),
    retry: 2,
  });
};

export const useStops = (enabled = true) => {
  const queryClient = useQueryClient();

  return useQuery<Stop[], Error>({
    queryKey: STOPS_QUERY_KEY,
    queryFn: async () => {
      const cached = getCachedStops();
      if (cached) {
        fetchAllStops()
          .then((stops) => {
            setCachedStops(stops);
            queryClient.setQueryData(STOPS_QUERY_KEY, stops);
          })
          .catch(() => {});
        return cached;
      }

      const stops = await fetchAllStops();
      setCachedStops(stops);
      return stops;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    enabled: enabled && isApiKeyConfigured(),
    retry: 2,
  });
};

export const useRoutePatterns = (routeIds: string[]) => {
  return useQuery<Map<string, RoutePattern[]>, Error>({
    queryKey: ['routePatterns', routeIds],
    queryFn: () => fetchRoutePatterns(routeIds),
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    enabled: routeIds.length > 0 && isApiKeyConfigured(),
    placeholderData: keepPreviousData, // keep showing old patterns while refetching
  });
};

export const useStopTimetable = (stopId: string | null) => {
  return useQuery<StopTimetableResult, Error>({
    queryKey: ['stopTimetable', stopId],
    queryFn: () => fetchStopTimetable(stopId!),
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 5, // 5 minutes
    enabled: stopId !== null && isApiKeyConfigured(),
    refetchInterval: 1000 * 30, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true,
  });
};
