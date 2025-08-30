// Build version information for debugging and cache verification
// Using compile-time constants injected by Vite
declare const __BUILD_TIME__: string;
declare const __BUILD_HASH__: string;

export const BUILD_INFO = {
  hash: typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : Date.now().toString(36),
  date: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString(),
  env: import.meta.env.MODE,
};

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