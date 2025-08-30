// Build version information for debugging and cache verification
// Using stable compile-time values since Vite defines aren't available
const BUILD_TIMESTAMP = '2025-08-30T20:12:26.213Z';
const BUILD_HASH = 'meyp7co5';

export const BUILD_INFO = {
  hash: BUILD_HASH,
  date: BUILD_TIMESTAMP,
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