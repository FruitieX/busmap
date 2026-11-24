/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_DIGITRANSIT_API_KEY: string;
  readonly VITE_TRANSIT_PROVIDER?: string;
  readonly VITE_VIETNAM_API_BASE?: string;
  readonly VITE_VIETNAM_API_KEY?: string;
  readonly VITE_VIETNAM_MQTT_BROKER?: string;
  readonly VITE_VIETNAM_MQTT_TOPIC_PREFIX?: string;
  readonly VITE_VIETNAM_ROUTE_ID_PREFIX?: string;
  readonly VITE_VIETNAM_MQTT_DIR_OFFSET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
