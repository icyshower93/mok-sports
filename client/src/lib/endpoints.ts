// client/src/lib/endpoints.ts
const apiBase = import.meta.env.VITE_API_BASE ?? '/api';

export const endpoints = {
  // Auth endpoints
  authMe: () => `${apiBase}/auth/me`,
  authConfig: () => `${apiBase}/auth/config`,
  authLogout: () => `${apiBase}/auth/logout`,
  authGoogle: () => `${apiBase}/auth/google`,
  
  // Draft endpoints
  draft: (draftId: string) => `${apiBase}/drafts/${draftId}`,
  draftState: (draftId: string) => `${apiBase}/drafts/${draftId}/state`,
  draftAvailableTeams: (draftId: string) => `${apiBase}/drafts/${draftId}/available-teams`,
  draftsLeague: (leagueId: string) => `${apiBase}/drafts/league/${leagueId}`,
  
  // League endpoints
  leagues: () => `${apiBase}/leagues`,
  leaguesUser: () => `${apiBase}/leagues/user`,
  league: (leagueId: string) => `${apiBase}/leagues/${leagueId}`,
  leagueJoin: () => `${apiBase}/leagues/join`,
  leagueRemoveMember: (leagueId: string) => `${apiBase}/leagues/${leagueId}/remove-member`,
  leagueLeave: (leagueId: string) => `${apiBase}/leagues/${leagueId}/leave`,
  startLeagueDraft: (leagueId: string) => `${apiBase}/leagues/${leagueId}/draft/start`,
  
  // User endpoints
  userStats: () => `${apiBase}/user/stats`,
  userDraftsRecent: () => `${apiBase}/user/drafts/recent`,
  userLeagues: () => `${apiBase}/user/leagues`,
  
  // Push notification endpoints
  pushVapidKey: () => `${apiBase}/push/vapid-key`,
  pushSubscribe: () => `${apiBase}/push/subscribe`,
  pushUnsubscribe: () => `${apiBase}/unsubscribe`,
  pushTest: () => `${apiBase}/push/test`,
  pushWelcome: () => `${apiBase}/push/welcome`,
  pushLeagueFull: () => `${apiBase}/push/league-full`,
  vapidPublicKey: () => `${apiBase}/vapid-public-key`,
  
  // Admin endpoints
  adminState: () => `${apiBase}/admin/state`,
  adminAdvanceDay: () => `${apiBase}/admin/advance-day`,
  adminResetSeason: () => `${apiBase}/admin/reset-season`,
  adminCurrentWeek: () => `${apiBase}/admin/current-week`,
  
  // Debug endpoints
  debugDatabaseCounts: () => `${apiBase}/debug/database/counts`,
  
  // Test endpoints
  testLeagueFullNotification: () => `${apiBase}/test/league-full-notification`,
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