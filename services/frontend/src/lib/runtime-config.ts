export type FrontendBackendMode = 'live' | 'fake';

const rawBackendMode =
  (import.meta.env.VITE_APP_BACKEND_MODE as string | undefined)
    ?.trim()
    .toLowerCase() || 'live';

export const frontendBackendMode: FrontendBackendMode =
  rawBackendMode === 'fake' ? 'fake' : 'live';

export const isFakeDeployment = frontendBackendMode === 'fake';
