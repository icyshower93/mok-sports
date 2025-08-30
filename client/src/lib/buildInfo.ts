// Build version information for debugging and cache verification
// Using environment variables set at build time
const env = import.meta.env;
const hash = env.VITE_BUILD_HASH ?? 'dev';
const date = env.VITE_BUILD_TIME ?? new Date().toISOString();

export const BUILD_INFO = { hash, date, env: env.MODE };

export function logBuildInfo() {
  console.log('🏗️ Build Info:', BUILD_INFO);
  console.log(`📦 Version: ${BUILD_INFO.hash}`);
  console.log(`📅 Built: ${BUILD_INFO.date}`);
  console.log(`🔧 Environment: ${BUILD_INFO.env}`);
}

// Make build info available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).__BUILD_INFO__ = BUILD_INFO;
}