# AGENTS.md

## Overview

busmap is a React SPA that tracks public transport vehicles in real-time on a map. It combines two data sources: a **transit provider API** (routes, stops, timetables) and a **provider MQTT feed** (live vehicle positions). The app is a PWA with offline caching via Workbox.

By default it connects to Helsinki (HSL), but the backend is pluggable via the `TransitProvider` interface so other regions (e.g. Vietnam) can be targeted through environment variables — no code change required.

## Architecture

### Data Flow

1. **Routes/stops** are fetched via the active provider (`src/lib/api.ts` → `src/lib/provider.ts`) and cached with TanStack React Query (`src/lib/hooks.ts`) + localStorage/CacheStorage
2. **Live vehicle positions** stream over WebSocket MQTT (`src/lib/mqtt.ts` → `MqttService` singleton, broker/topic from the provider) and are batched (100ms) into Zustand's `vehicleStore`
3. **Vehicle markers** are smoothly animated between MQTT updates using extrapolation + decaying correction offsets (`src/lib/interpolation.ts`)

### Key Modules

| Layer | Files | Purpose |
|-------|-------|---------|
| Provider | `src/lib/provider.ts` | `TransitProvider` interface + registry; `getProvider()` selects the active provider via `VITE_TRANSIT_PROVIDER` |
| Providers | `src/lib/providers/hsl.ts` | HSL (Helsinki): Digitransit GraphQL + MQTT HFP feed |
| Providers | `src/lib/providers/vietnam.ts` | Vietnam: configurable REST base + MQTT broker |
| State | `src/stores/*.ts` | Zustand stores — `vehicleStore` (ephemeral), `subscriptionStore` + `settingsStore` (persisted via `zustand/persist`) |
| Data | `src/lib/api.ts` | Delegates to the active provider; provider-aware caching |
| Data | `src/lib/hooks.ts` | React Query hooks wrapping API calls with caching config |
| Real-time | `src/lib/mqtt.ts` | MQTT connection, provider topic/broker, vehicle parsing, nearby filtering |
| Animation | `src/lib/interpolation.ts` | Position extrapolation with arc-based heading blend + smooth correction |
| UI | `src/components/*.tsx` | Map (`BusMap`), popovers, bottom sheet, vehicle list, stop details |
| Orchestration | `src/App.tsx` | All state coordination — route subscriptions, temp MQTT management, stop/vehicle selection |

### Route ID prefix

Route GTFS IDs are namespaced with a provider prefix (e.g. `HSL:` for Helsinki, `VN:` for Vietnam). Use `prefixRouteId()` / `stripRouteIdPrefix()` from `src/lib/routeId.ts` instead of hardcoding `HSL:`.

### MQTT Topics

HSL HFP v2 format: `/hfp/v2/journey/ongoing/vp/<mode>/<oper>/<veh>/<route>/<dir>/<headsign>/<start>/<stop>/<geohash_level>/<geohash>/#` (topic prefix from the provider).

Route IDs use the provider prefix in the app but the MQTT topic uses the bare number (prefix stripped).

### GTFS Direction Mapping

GTFS directions are 0/1 but MQTT uses 1/2 (`mqttDir = gtfsDir + 1`). This conversion happens in the provider's `fetchStopTimetable`.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run ci:build     # Lint, app/test typechecks, production build, asset validation
npm test             # Unit + desktop/mobile Playwright tests against dist
```

Requires provider-specific env in `.env` (copy from `.env.example`). For HSL, register a Digitransit key at https://portal-api.digitransit.fi/. For Vietnam, set `VITE_TRANSIT_PROVIDER=vietnam` plus `VITE_VIETNAM_*` variables.

## Conventions

- **Path alias:** `@/*` maps to `./src/*` (configured in both `tsconfig.json` and `vite.config.ts`)
- **Barrel exports:** `src/components/index.ts` and `src/lib/index.ts` re-export public APIs
- **Transport modes:** Always use `normalizeMode()` from the active provider when handling mode strings from the API (maps `subway`→`metro`, `rail`→`train`, etc.)
- **Colors:** Use `TRANSPORT_COLORS` from `types.ts` for mode-based coloring
- **Styling:** Tailwind CSS v4, configured CSS-first in `src/index.css` (`@theme`) via `@tailwindcss/vite`; `dark:` variant is class-based, theme applied via `document.documentElement.classList`
- **TypeScript:** `tsc` is TypeScript 7 (`@typescript/native` alias). `typescript` is aliased to `@typescript/typescript6` because typescript-eslint needs the TS 6 compiler API; drop the alias once typescript-eslint supports TS 7
- **Tests:** Playwright Test in `tests/`, running against the production build. Mock services at HTTP/WebSocket boundaries, never replace application stores or components. Browser tests fail on any `console.error`; tests that simulate failures declare expected ones with `app.expectConsoleErrors(/pattern/)`. On NixOS, run them with `SMOKE_CHROMIUM_PATH` pointing at nixpkgs' `playwright-driver.browsers` Chromium. Run `npm run ci:build` before `npm test`; install Chromium with `npx playwright install --with-deps chromium`.

## Patterns to Follow

- Zustand stores use `getState()` outside React and hook selectors inside components to avoid unnecessary re-renders (see `App.tsx` callbacks)
- MQTT message processing batches updates via `vehicleBuffer` + `setTimeout` flush to reduce React re-renders
- Vehicle interpolation uses scoped correction state (`scope` param in `interpolateVehicle`) to isolate animation state between different render contexts
- The `VehicleTiming` config in `constants.ts` provides mode-specific thresholds (ferry has slower update intervals than bus/tram)
