import { AuthToken } from '@/lib/auth-token';
import { markModule } from '@/lib/dup-guard';

markModule('features/query/api');

export async function apiRequest(
  method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE',
  url: string,
  body?: unknown,
  extraHeaders: Record<string,string> = {}
): Promise<any> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...AuthToken.headers(),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
  }
  return await res.json();
}