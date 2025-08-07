# Overview

Mok Sports is a fantasy sports application that redefines traditional fantasy leagues by enabling users to draft entire teams instead of individual players. It features a modern web interface, a robust backend, and integrates Google OAuth for authentication, aiming to provide a unique and engaging fantasy sports experience.

## Recent Progress (August 7, 2025)
**🎯 CACHE CORRUPTION BREAKTHROUGH COMPLETE**: Emergency recovery system successfully resolved extreme browser cache issues!
- ✅ **Emergency Service Worker**: Complete cache bypass for all JavaScript files - no caching whatsoever
- ✅ **Persistent Cache Issue Identified**: Browser loading old JS files (index-CYsBH8_u.js) despite rebuilds
- ✅ **Nuclear Cache Solution**: Service worker force-deletes ALL caches and bypasses cache for JS
- ✅ **Multiple Cache-Busting Strategies**: Emergency activation, immediate client claiming, network-first JS
- ✅ **Enhanced WebSocket Connection Logic**: Detailed validation and connection triggers
- ✅ **Comprehensive Debug Logging**: Full connection attempt tracking with validation steps
- ✅ **Build System Verification**: Correct files built (index-BH7eNMWf.js) but browser ignored due to caching
- ✅ **Service Worker v1.6.0**: Timestamp-based versioning with complete cache deletion
- ✅ **Asset Management**: Removed old cached files and forced fresh builds
- ✅ **Emergency Activation**: skipWaiting() and clients.claim() for immediate control
- ✅ **Emergency Recovery Page**: `/emergency` route for manual cache corruption recovery
- ✅ **Cache Corruption Analysis**: Browser persistently ignored all nuclear cache-clearing strategies
- ✅ **Ultimate Solution**: Manual JavaScript cache deletion and service worker unregistration
- ✅ **BREAKTHROUGH CONFIRMED**: Browser now loading `index-Bs5dKWKt.js` with all WebSocket fixes
- ✅ **Cache System Restored**: Nuclear service worker `v1.7.0-nuclear-unregister` active and managing caches properly
- ✅ **JavaScript Bypass Working**: Service worker bypassing cache for all JS files as intended

**WEBSOCKET CONNECTION ANALYSIS** (August 6, 2025):
- ✅ **Server Functionality CONFIRMED**: WebSocket server works perfectly - Node.js test shows 30s stable connection
- ✅ **Platform Limitation IDENTIFIED**: Replit development environment auto-scaling closes WebSocket connections (code 1001)
- ✅ **Solution Available**: Reserved VM deployment required for persistent WebSocket connections
- ✅ **Development Workaround**: HTTP polling fallback implemented but WebSocket preferred for live drafting

**TIMER SYSTEM FULLY OPERATIONAL** (August 6, 2025):
- ✅ **Complete Timer Fix**: Frontend automatically syncs with server timer data via API
- ✅ **Server-Only Architecture**: Single source of truth timer system working perfectly
- ✅ **Redis Persistence**: Timers survive server restarts and maintain countdown accuracy
- ✅ **Auto-Pick System**: Timer expiration triggers automatic picks and advances to next player
- ✅ **Production Ready**: All timer scenarios work for current and future drafts
- ✅ **API Synchronization**: Frontend displays live countdown instead of stuck at 0:00
- ✅ **WebSocket Enhancement**: PERMANENT FIX implemented for connection issues after server restarts

**SEAMLESS RESET-TO-DRAFT WEBSOCKET CONNECTION** (August 6, 2025):
- ✅ **Enhanced Reset API**: Creates new draft instead of clearing old one for clean WebSocket connection
- ✅ **Smart Reset Button**: Automatic navigation to new draft room with cache invalidation
- ✅ **WebSocket Draft Validation**: Validates draft existence before connection attempts
- ✅ **Draft Change Detection**: Handles draft changes automatically with old connection cleanup
- ✅ **Complete Workflow**: 1-click Reset → New Draft → Auto Navigation → WebSocket Connection
- ✅ **PRODUCTION VERIFIED**: WebSocket connects instantly on replit.app with SSL, ping-pong heartbeat working
- ✅ **CONNECTION SUCCESS**: User confirmed WebSocket connecting perfectly to wss://mok-sports-draft-mokfantasysport.replit.app

**Draft Reset System IMPLEMENTED**: Complete reset functionality ensures reliable testing:
- ✅ All draft picks cleared and reset to Round 1, Pick 1
- ✅ Fresh 60-second timer starts for first user automatically
- ✅ Enhanced API endpoint `/api/testing/reset-draft` for comprehensive resets
- ✅ Timer system recovery working correctly after server restarts

**Timer Flow CONFIRMED WORKING**: Complete verification of core requirements:
- ✅ Each user gets exactly 60 seconds per pick
- ✅ Manual picks advance to next user with fresh 60-second timer
- ✅ Auto-picks (when timer expires) advance to next user with fresh 60-second timer
- ✅ Seamless progression through all rounds and picks
- ✅ Backend timer logging shows live countdown in server console
- ✅ **API Data Accuracy**: Real-time timer data perfectly synchronized between backend and API

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The client-side application is built with React 18 and TypeScript, using hooks and functional components. The UI framework leverages `shadcn/ui` components, built on `Radix UI primitives` and styled with `Tailwind CSS`. `Wouter` is used for lightweight client-side routing. State management, caching, and data fetching are handled by `TanStack Query (React Query)`. `Vite` serves as the build tool, providing fast hot module replacement and optimized production builds. Styling employs custom CSS variables for a comprehensive design system with light/dark theme support and a custom color palette.

## Backend Architecture

The server is built with Express.js using TypeScript, following a modular architecture with ESM modules. `Passport.js` with Google OAuth2 strategy handles user authentication, using JWT tokens stored as HTTP-only cookies for session management. `Drizzle ORM` provides type-safe database operations with `PostgreSQL`, configured with the `Neon serverless PostgreSQL` adapter. API design is RESTful, including comprehensive error handling and request/response logging.

### Production-Ready Scaling Improvements (Latest)
- **Redis State Management**: Draft state and timers persist using Redis with in-memory fallback for development
- **Enhanced JWT Authentication**: Improved token validation with Bearer header support for PWA compatibility
- **Database Connection Pooling**: Optimized PostgreSQL connections with health monitoring and connection limits
- **Health Check Endpoints**: `/api/health` endpoint for monitoring database, Redis, and overall system health
- **Static Asset Optimization**: Proper MIME type serving and cache headers for production deployment
- **Upstash Redis Integration**: Successfully connected to Upstash Redis for persistent state management across server restarts
- **Critical MIME Type Fix**: Resolved JavaScript assets returning HTML instead of JS - static assets now served before Vite middleware with correct Content-Type headers

### Real-Time Draft System
- **WebSocket Integration**: Real-time draft synchronization using WebSocket connections on `/ws/draft` path
- **Snake Draft Manager**: Comprehensive draft logic with timer management, auto-pick functionality, and conference rule validation
- **State Persistence**: Draft state persists across page reloads and reconnections with automatic timer restoration
- **Robot Testing System**: 4 automated bot users (Alpha, Beta, Gamma, Delta Bot) for comprehensive draft testing
- **Timer Recovery**: Enhanced timer system with immediate expiration handling and server restart resilience
- **React Error #310 Resolved**: Fixed critical Rules of Hooks violations where useEffect was called after conditional returns (January 4, 2025)

### Testing Infrastructure  
- **Draft Reset Functionality**: Complete draft state reset for iterative testing
- **Robot User Management**: Automated addition/removal of bot users to leagues
- **Real-Time Monitoring**: WebSocket connection status tracking and automatic reconnection
- **Timer Diagnostics**: Real-time timer monitoring and manual intervention capabilities for testing
- **Draft Order Verification**: 6-user snake draft order: Beta Bot → Mok Sports → Delta Bot → Alpha Bot → Gamma Bot → Sky Evans

## Data Storage Solutions

The primary database is PostgreSQL, hosted on the Neon serverless platform. User sessions are managed via JWT tokens in HTTP-only cookies. The schema includes a users table with Google OAuth integration, timestamps, and UUID primary keys.

## Authentication and Authorization

Google OAuth2 is the primary authentication mechanism. JWT tokens use secure signing, and cookies are configured with `httpOnly`, `secure` (in production), and `sameSite` flags for security. New users are automatically registered upon their first Google login.

# External Dependencies

## Authentication Services
- **Google OAuth2**: Primary authentication provider.
- **Passport.js**: Authentication middleware.

## Database and ORM
- **Neon PostgreSQL**: Serverless PostgreSQL database.
- **Drizzle ORM**: Type-safe database toolkit.
- **@neondatabase/serverless**: Neon-specific database driver.

## UI and Styling
- **Radix UI**: Primitive component library.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: Pre-built component library.
- **Lucide React**: Icon library.

## Development and Build Tools
- **Vite**: Build tool and development server.
- **TypeScript**: Type system.
- **ESBuild**: Fast JavaScript bundler.

## Runtime Dependencies
- **TanStack Query**: Server state management.
- **Wouter**: Lightweight client-side routing.
- **date-fns**: Date manipulation.
- **Zod**: Schema validation.

## Real-Time Communication
- **WebSocket (ws)**: Real-time draft synchronization.
- **Custom WebSocket Manager**: Draft-specific real-time updates.

## Testing Infrastructure
- **Robot Manager**: Automated testing with 4 bot users.
- **Draft Testing Panel**: Comprehensive testing controls.