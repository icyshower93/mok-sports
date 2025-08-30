// Build version information for debugging and cache verification
// Using compile-time constants to avoid runtime generation
const BUILD_TIMESTAMP = '2025-08-30T19:47:24.230Z';
const BUILD_HASH = 'meyob5qe';

export const BUILD_INFO = {
  version: 1756583244230,
  date: BUILD_TIMESTAMP,
  env: import.meta.env.MODE,
  hash: BUILD_HASH
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