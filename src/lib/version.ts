export const APP_VERSION = __APP_VERSION__;

const APP_VERSION_FILE = '/app-version.json';

export type DeployedAppVersionStatus = 'same' | 'different' | 'unknown';

type AppVersionPayload = {
  version: string;
};

const isAppVersionPayload = (value: unknown): value is AppVersionPayload => {
  if (typeof value !== 'object' || value === null || !('version' in value)) {
    return false;
  }

  return typeof value.version === 'string';
};

export const fetchDeployedAppVersion = async (): Promise<string | null> => {
  try {
    const response = await fetch(`${APP_VERSION_FILE}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    if (!isAppVersionPayload(payload)) {
      return null;
    }

    return payload.version;
  } catch {
    return null;
  }
};

export const getDeployedAppVersionStatus = async (): Promise<DeployedAppVersionStatus> => {
  const deployedVersion = await fetchDeployedAppVersion();
  if (deployedVersion === null) {
    return 'unknown';
  }

  return deployedVersion === APP_VERSION ? 'same' : 'different';
};
