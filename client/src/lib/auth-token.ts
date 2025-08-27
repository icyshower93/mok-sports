// Pure auth token utility - no React imports, no barrel imports
const TOKEN_KEY = 'mok_sports_auth_token';

export const AuthToken = {
  get(): string | null {
    try { 
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(TOKEN_KEY); 
    } catch { 
      return null; 
    }
  },
  set(token: string) {
    try { 
      if (typeof window === 'undefined') return;
      localStorage.setItem(TOKEN_KEY, token); 
    } catch {}
  },
  clear() {
    try { 
      if (typeof window === 'undefined') return;
      localStorage.removeItem(TOKEN_KEY); 
    } catch {}
  },
  headers(): Record<string, string> {
    const token = AuthToken.get();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
};