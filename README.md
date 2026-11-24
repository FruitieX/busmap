# <img src="public/icon.png" alt="icon" width="48" height="48" style="display: inline;vertical-align: middle; margin-right: 4px; margin-bottom: 6px;"> busmap

Real-time public transport vehicle tracker. Track buses, trams, metros, trains, and ferries live on the map.

**Live:** https://busmap.netlify.app

![Screenshot](screenshot.png)

## Features

- 🚌 **Real-time vehicle tracking** - See vehicles move on the map in real-time via HSL's MQTT feed
- ⭐ **Saved routes mode** - Track your favorite routes and they'll load automatically when you open the app
- 📍 **Nearby mode** - Discover all vehicles in your current area
- 🗺️ **Smooth WebGL map** - Powered by MapLibre GL JS for 60fps animations
- 📱 **Mobile-first PWA** - Install as an app on your phone
- 🌙 **Dark mode** - Automatic or manual theme switching
- ⚡ **Fast startup** - Cached routes load instantly

## Setup

### Prerequisites

1. Node.js 18+ installed
2. A transit API key (depends on provider — see "Transit providers" below)

### Transit providers

busmap supports multiple transit backends through a pluggable provider system. Select the provider with `VITE_TRANSIT_PROVIDER` in `.env`:

- **`hsl`** (default) — Helsinki (HSL). Requires a Digitransit API key (`VITE_DIGITRANSIT_API_KEY`) for routes/stops. Live vehicle positions come from HSL's MQTT HFP feed (no auth).
- **`vietnam`** — A configurable Vietnam transit backend. Point it at your own REST API via `VITE_VIETNAM_API_BASE`, optional `VITE_VIETNAM_API_KEY`, and MQTT broker via `VITE_VIETNAM_MQTT_BROKER`.

See `.env.example` for all available environment variables.

### Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env and add your API key / provider settings

# Start development server
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

## Technology Stack

- **Frontend:** React 18, TypeScript
- **Build:** Vite
- **Maps:** MapLibre GL JS + react-map-gl
- **Styling:** Tailwind CSS
- **State:** Zustand
- **Data fetching:** TanStack React Query
- **Animations:** Framer Motion
- **Real-time:** MQTT.js (configurable per provider)
- **API:** Digitransit GraphQL API (HSL) or configurable REST (Vietnam)
- **PWA:** Workbox via vite-plugin-pwa

## Transit providers

### HSL (Helsinki) — default

- Routes/stops: Digitransit GraphQL API (`https://api.digitransit.fi/routing/v2/hsl/gtfs/v1`)
- Live vehicles: HSL MQTT HFP feed (`wss://mqtt.hsl.fi:443/`)
- Route IDs use the `HSL:` prefix (e.g. `HSL:2551`)
- Requires `VITE_DIGITRANSIT_API_KEY` (register at https://portal-api.digitransit.fi/)

### Vietnam

- Routes/stops: configurable REST base (`VITE_VIETNAM_API_BASE`)
- Live vehicles: configurable MQTT broker (`VITE_VIETNAM_MQTT_BROKER`)
- Route ID prefix: `VITE_VIETNAM_ROUTE_ID_PREFIX` (default `VN:`)
- Timezone: `VITE_VIETNAM_TIMEZONE` (default `Asia/Ho_Chi_Minh`)
- Set `VITE_TRANSIT_PROVIDER=vietnam` to activate

Add new providers by implementing the `TransitProvider` interface in `src/lib/providers/` and registering it in `src/lib/providers/index.ts`.

## API Notes

- **HSL MQTT feed (mqtt.hsl.fi):** Free, no authentication required. Provides real-time vehicle positions (default HSL provider).
- **Digitransit Routing API:** Requires registration and API key. Used for route list and polylines (default HSL provider).
- **Vietnam provider:** Route/stops and MQTT broker are configured via `VITE_VIETNAM_*` env vars; no default credentials.

## License

MIT
