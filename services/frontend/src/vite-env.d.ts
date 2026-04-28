/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_BACKEND_MODE?: 'live' | 'fake';
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TARGET?: string;
  readonly VITE_HOST?: string;
  readonly VITE_PORT?: string;
  readonly VITE_USE_POLLING?: string;
  readonly VITE_POLLING_INTERVAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
