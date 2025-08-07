// Build version information for debugging and cache verification
export const BUILD_INFO = {
  version: Date.now(),
  date: new Date().toISOString(),
  env: import.meta.env.MODE,
  // Simple hash-based version for production builds
  hash: import.meta.env.MODE === 'production' ? 
    Date.now().toString(36) : 
    'dev-' + Date.now().toString(36)
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