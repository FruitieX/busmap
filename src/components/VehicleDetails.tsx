import { useEffect, useState } from 'react';
import type { Route, TrackedVehicle } from '@/types';
import { useSettingsStore, useSubscriptionStore } from '@/stores';
import { resolveRouteColor } from '@/lib';
import { DELAY_EARLY_THRESHOLD, DELAY_LATE_THRESHOLD, MPS_TO_KMPH } from '@/constants';
import { StarIcon } from './StarToggleButton';

interface VehicleDetailsProps {
  vehicle: TrackedVehicle;
  onBack: () => void;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
  isFollowing?: boolean;
  onReFollow?: () => void;
  onRouteActivate?: (route: Route) => void;
  backTitle?: string;
}

const formatDelay = (delaySeconds: number): string => {
  if (delaySeconds === 0) return 'On time';
  const minutes = Math.round(delaySeconds / 60);
  if (minutes === 0) return 'On time';
  if (minutes > 0) return `+${minutes} min late`;
  return `${Math.abs(minutes)} min early`;
};

const formatSpeed = (mps: number): string => {
  const kmh = Math.round(mps * MPS_TO_KMPH);
  return `${kmh} km/h`;
};

const formatLastUpdate = (lastUpdate: number, now: number): string => {
  const secondsAgo = Math.floor((now - lastUpdate) / 1000);
  if (secondsAgo <= 2) return 'now';
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  const minutes = Math.floor(secondsAgo / 60);
  return `${minutes}m ago`;
};

export const VehicleDetails = ({
  vehicle,
  onBack,
  onSubscribe,
  onUnsubscribe,
  isFollowing = true,
  onReFollow,
  onRouteActivate,
  backTitle = 'Back to vehicles',
}: VehicleDetailsProps) => {
  const subscribedRoutes = useSubscriptionStore((state) => state.subscribedRoutes);
  const developerMode = useSettingsStore((state) => state.developerMode);
  const routeColorMode = useSettingsStore((state) => state.routeColorMode);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const subscribed = subscribedRoutes.find(
    (route) => route.gtfsId === `HSL:${vehicle.routeId}` || route.shortName === vehicle.routeShortName,
  );
  const isSubscribed = !!subscribed;
  const route = {
    gtfsId: `HSL:${vehicle.routeId}`,
    shortName: vehicle.routeShortName,
    longName: vehicle.headsign,
    mode: vehicle.mode,
  } satisfies Route;
  const color = resolveRouteColor({
    routeId: subscribed?.gtfsId ?? `HSL:${vehicle.routeId}`,
    mode: vehicle.mode,
    colorMode: routeColorMode,
    isSubscribed,
  });

  const delayClass =
    vehicle.delay > DELAY_LATE_THRESHOLD
      ? 'text-red-500'
      : vehicle.delay < DELAY_EARLY_THRESHOLD
        ? 'text-green-500'
        : 'text-gray-600 dark:text-gray-400';

  return (
    <div className="space-y-3 px-0.5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title={backTitle}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 hover:opacity-85 transition-opacity"
          style={{ backgroundColor: color }}
          onClick={() => onRouteActivate?.(route)}
          title="Open route details"
        >
          {vehicle.routeShortName}
        </button>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 dark:text-white truncate">
            {vehicle.headsign || 'Unknown destination'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {vehicle.mode} • Vehicle {vehicle.vehicleNumber}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2">
          <div className={`text-sm font-semibold ${delayClass}`}>{formatDelay(vehicle.delay)}</div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">Delay</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">{formatSpeed(vehicle.speed)}</div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">Speed</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">{formatLastUpdate(vehicle.lastUpdate, now)}</div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">Updated</div>
        </div>
      </div>

      {developerMode && (
        <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1 font-mono bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
          <div className="flex justify-between gap-3">
            <span>Vehicle ID:</span>
            <span className="text-right break-all">{vehicle.vehicleId}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Route ID:</span>
            <span>{vehicle.routeId}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Position:</span>
            <span>{vehicle.lat.toFixed(5)}, {vehicle.lng.toFixed(5)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Heading:</span>
            <span>{vehicle.heading?.toFixed(0) ?? 'N/A'} deg</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Acceleration:</span>
            <span>{vehicle.acceleration?.toFixed(2) ?? 'N/A'} m/s2</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Door status:</span>
            <span>{vehicle.doorStatus === 1 ? 'Open' : 'Closed'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Occupancy:</span>
            <span>{vehicle.occupancy}%</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Operating day:</span>
            <span>{vehicle.operatingDay}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Start time:</span>
            <span>{vehicle.startTime}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Next stop:</span>
            <span>{vehicle.nextStopId || 'N/A'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Operator:</span>
            <span>{vehicle.operatorId}</span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!isFollowing && onReFollow && (
          <button
            onClick={onReFollow}
            className="py-2 px-3 rounded-lg text-sm font-medium transition-colors bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Re-center on vehicle"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
        <button
          onClick={isSubscribed ? onUnsubscribe : onSubscribe}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            isSubscribed
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              : 'text-white hover:opacity-90'
          }`}
          style={!isSubscribed ? { backgroundColor: color } : undefined}
        >
          <StarIcon active={isSubscribed} className="w-4 h-4" />
          {isSubscribed ? 'Stop tracking route' : 'Track this route'}
        </button>
      </div>

      {onRouteActivate && (
        <div className="pt-1">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Route</h3>
          <button
            className="w-full text-left bg-gray-50 dark:bg-gray-800 rounded-xl p-2 min-[425px]:p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={() => onRouteActivate(route)}
          >
            <div
              className="w-10 h-10 min-[425px]:w-12 min-[425px]:h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ backgroundColor: color }}
            >
              {vehicle.routeShortName}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-white truncate">
                {vehicle.headsign || `Route ${vehicle.routeShortName}`}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {vehicle.mode}
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};