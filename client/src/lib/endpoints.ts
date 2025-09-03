// client/src/lib/endpoints.ts
const apiBase = import.meta.env.VITE_API_BASE ?? '/api';

export const endpoints = {
  draft: (draftId: string) => `${apiBase}/drafts/${draftId}`,
  // If your backend uses a different path, change it *here only*:
  draftAvailableTeams: (draftId: string) => `${apiBase}/drafts/${draftId}/available-teams`,
  startLeagueDraft: (leagueId: string) => `${apiBase}/leagues/${leagueId}/draft/start`,
};

export function wsUrl(path: string, params?: Record<string, string | number | boolean | null | undefined>) {
  // Prefer explicit base if set (works for multi-service deploys),
  // otherwise derive from current origin.
  const base = (import.meta.env.VITE_WS_BASE as string | undefined)
    ?? window.location.origin.replace(/^http/i, 'ws');
  const url = new URL(path.startsWith('/') ? path : `/${path}`, base);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}