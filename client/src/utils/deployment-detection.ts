/**
 * Deployment Detection Utilities
 * Helps identify if the app is running in production vs development
 * Critical for iOS PWA push notification functionality
 */

export interface DeploymentInfo {
  isProduction: boolean;
  isDevelopment: boolean;
  isHTTPS: boolean;
  isReplit: boolean;
  isLocalhost: boolean;
  hostingPlatform: 'replit' | 'netlify' | 'vercel' | 'localhost' | 'unknown';
  canReceiveIOSPush: boolean;
}

export function getDeploymentInfo(): DeploymentInfo {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const href = window.location.href;
  
  // Check hosting platform
  const isReplit = hostname.includes('replit.app') || hostname.includes('repl.co');
  const isNetlify = hostname.includes('netlify.app') || hostname.includes('netlify.com');
  const isVercel = hostname.includes('vercel.app') || hostname.includes('vercel.com');
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
  
  let hostingPlatform: DeploymentInfo['hostingPlatform'] = 'unknown';
  if (isReplit) hostingPlatform = 'replit';
  else if (isNetlify) hostingPlatform = 'netlify';
  else if (isVercel) hostingPlatform = 'vercel';
  else if (isLocalhost) hostingPlatform = 'localhost';
  
  const isHTTPS = protocol === 'https:';
  const isProduction = !isLocalhost && isHTTPS;
  const isDevelopment = isLocalhost || !isHTTPS;
  
  // iOS Safari PWA push notifications only work with HTTPS in production
  const canReceiveIOSPush = isHTTPS && !isLocalhost;
  
  return {
    isProduction,
    isDevelopment,
    isHTTPS,
    isReplit,
    isLocalhost,
    hostingPlatform,
    canReceiveIOSPush
  };
}

export function logDeploymentInfo() {
  const info = getDeploymentInfo();
  console.log('[Deployment Info]', {
    environment: info.isProduction ? 'PRODUCTION' : 'DEVELOPMENT',
    platform: info.hostingPlatform,
    protocol: window.location.protocol,
    host: window.location.host,
    iosNotificationsSupported: info.canReceiveIOSPush
  });
  return info;
}