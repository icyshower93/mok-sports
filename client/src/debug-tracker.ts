// Debug tracking for PWA issues
export function trackModuleError(error: any, context: string) {
  console.error(`[DEBUG] Module Error in ${context}:`, {
    error,
    message: error?.message,
    stack: error?.stack,
    type: typeof error,
    constructor: error?.constructor?.name,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    pathname: window.location.pathname,
    userAgent: navigator.userAgent
  });
  
  // Store in sessionStorage for PWA debugging
  try {
    const debugLog = JSON.parse(sessionStorage.getItem('mok-debug-log') || '[]');
    debugLog.push({
      context,
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      url: window.location.href
    });
    
    // Keep only last 10 entries
    if (debugLog.length > 10) {
      debugLog.splice(0, debugLog.length - 10);
    }
    
    sessionStorage.setItem('mok-debug-log', JSON.stringify(debugLog));
  } catch (e) {
    console.warn('[DEBUG] Could not store error in sessionStorage:', e);
  }
}

export function getDebugLog() {
  try {
    return JSON.parse(sessionStorage.getItem('mok-debug-log') || '[]');
  } catch {
    return [];
  }
}