# Deployment Guide - Mok Sports Draft

## ✅ Production Fixes Applied

All critical deployment issues have been resolved:

### 🔧 Fixed Issues

1. **ESM `import.meta.dirname` → `__dirname`**
   - Replaced all `import.meta.dirname` with proper ESM `fileURLToPath` pattern
   - Fixed in: `server/index.ts`, `server/routes.ts`

2. **Vite Dev-Only Integration**
   - Conditional dynamic import: `await import("./vite.js")` only in development
   - No top-level vite imports in production builds
   - Production serves static assets directly

3. **Environment Checks**
   - Replaced `app.get('env')` with `process.env.NODE_ENV !== 'production'`
   - Consistent environment detection across server

4. **Production Server Entry**
   - Created `server/prod.ts` with production-optimized configuration
   - Proper client dist path resolution for compiled server
   - Health endpoint `/healthz` for deployment detection

## 🚀 Deployment Commands

### For Replit Deployments:

```bash
# Build client and server
npm run build

# Run production server (NODE_ENV will be set by Replit)
node server/dist/index.js
```

### Alternative Production Build:

```bash
# Use the provided build script
./build-production.sh

# Run production server
NODE_ENV=production node server/dist/prod.js
```

## 🔧 Environment Variables

Required for production:

```bash
NODE_ENV=production
PORT=3000                    # Set by Replit automatically
DATABASE_URL=postgres://...  # Your Neon database URL
UPSTASH_REDIS_REST_URL=...   # Your Redis connection
```

## 📂 Production File Structure

After build:
```
client/dist/           # Client build artifacts
server/dist/          # Compiled server
server/dist/index.js  # Main production entry point
server/dist/prod.js   # Alternative production entry point
```

## 🏥 Health Checks

The server provides a health endpoint for deployment platforms:

- `GET /healthz` → Returns "ok" status 200

## 🎯 Key Production Features

- **Static Asset Serving**: Proper MIME types and caching headers
- **SPA Routing**: Client-side routing support with fallback to index.html
- **CORS Configuration**: Production-ready cross-origin setup
- **Error Handling**: Graceful error responses without stack traces
- **WebSocket Support**: Real-time draft functionality maintained
- **Redis Integration**: Persistent state management
- **Database Connectivity**: PostgreSQL with connection pooling

## ✅ Deployment Ready

Your Mok Sports Draft application is now ready for production deployment with:

- ✅ ESM compatibility fixes
- ✅ Production build optimization
- ✅ Proper static asset serving
- ✅ Health check endpoint
- ✅ Environment-aware configuration
- ✅ Error handling and logging

The application will successfully initialize and serve both the API and client assets from a single port.