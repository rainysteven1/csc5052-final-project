const rawApiBase =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '';
const normalizedApiBase = rawApiBase.replace(/\/$/, '');

export function buildApiUrl(path: string) {
  if (!normalizedApiBase) {
    return path;
  }
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${normalizedApiBase}${path.startsWith('/') ? path : `/${path}`}`;
}
