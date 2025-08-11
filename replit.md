# Overview

Mok Sports is a fantasy sports application that redefines traditional fantasy leagues by enabling users to draft entire NFL teams instead of individual players. The platform features unique mechanics including weekly "locks" for bonus points, "Lock and Load" high-risk/high-reward plays, dynamic free agent trading, and weekly "skins" prizes that can stack when tied. It features a modern web interface, a robust backend, and integrates Google OAuth for authentication. The project aims to provide a unique and engaging fantasy sports experience with a focus on real-time drafting, persistent state, and a highly available system.

## Recent Updates (August 2025)

### Production-Ready Season Management (Aug 11, 2025)
- **COMPLETED**: Simplified admin panel with single-button day progression for seamless operation
- **PRODUCTION READY**: Default 2025 season configuration starting September 4 (Eagles vs Cowboys)
- **SEASON SWITCHING**: One-click switching between 2024 (testing) and 2025 (production) seasons
- **SEAMLESS TRANSITION**: Admin panel automatically adapts to current season with proper date calculations
- Tank01 API integration optimized for live 2025 season data with authentic game processing
- Eliminated complex simulation controls in favor of simple day-by-day progression
- Season reset functionality maintains current season context for easy management

### Complete 2024 NFL Season Integration (Aug 11, 2025)
- Successfully imported complete 2024 NFL season using Tank01 RapidAPI exclusively
- All regular season games imported with authentic scores and completion status (weeks 1-18)
- Using completed 2024 season provides real game outcomes for reliable testing
- Fixed API integration to work with Tank01's actual data structure and endpoints
- Implemented robust Tank01 team ID mapping (1-32) to team codes (ARI, ATL, etc.)
- Enhanced date parsing to handle Tank01's various date formats
- System now optimized for comprehensive testing with known game outcomes

### Admin Panel System Integration (Aug 11, 2025)
- Fixed comprehensive admin panel integration with proper TypeScript definitions and database schema alignment
- Successfully integrated admin routes with main Express router using registerAdminRoutes function
- Corrected database table references from nflSchedule to nflGames to match actual schema structure
- Implemented real-time NFL season simulation starting from September 1, 2024 with time acceleration controls
- Built admin WebSocket broadcasting system for synchronized desktop/mobile experience
- Added comprehensive game processing system with Tank01/ESPN API integration for authentic 2024 NFL results
- Created admin state management with simulation controls: start, stop, reset, speed adjustment, and week jumping
- Implemented Mok scoring calculation integration for processed games with proper database updates
- **FIXED: Game Processing Timing** - Games now process only when simulation time crosses their actual scheduled start times, not all at once
- Replaced problematic Radix UI Select components with native HTML selects to eliminate React DOM manipulation errors

### Production-Ready Scoring System (Aug 11, 2025)
- Implemented hybrid scoring system with Tank01 API for current season and ESPN fallback for historical data
- Built for 2025 season production deployment with live NFL data integration
- Successfully tested with authentic 2024 Week 1 results showing correct user scores (Sky Evans: 5 points for 5-0 record)
- Added comprehensive Mok Sports scoring rules including blowout bonuses, weekly high/low penalties, and lock system
- Created robust fallback strategy that prioritizes live APIs for current seasons while maintaining historical accuracy for testing

### NFL Point Spreads Integration (Aug 10, 2025)
- Successfully integrated Tank01 RapidAPI betting odds system with comprehensive fallback strategy
- Created NBettingOdds interfaces and service methods for getBettingOddsForDate() and getBettingOddsForGame()
- Enhanced opponent display to show point spreads with proper home/away team perspective formatting
- Implemented historical 2024 NFL point spreads for realistic demo data when API unavailable
- Teams now display: "vs ARI (-6.5)", "@ CIN (+7.5)" with accurate betting line information

### NFL Schedule Import System (Aug 10, 2025)
- Implemented comprehensive NFL schedule import system with RapidAPI integration and ESPN API fallback
- Successfully imported complete 2024 NFL season with 272 games across 18 weeks
- Created NFL teams seeding functionality with all 32 teams and proper division mapping
- Built app state reset functionality to set all users to 0 points and no locks for fresh testing
- Integrated proper team ID mapping and foreign key relationships for data integrity

### Stable System Implementation (Aug 9, 2025)
- Implemented complete stable system with PostgreSQL database storage
- Added automatic stable initialization when drafts complete
- Updated main page to use real user draft data instead of mock data
- Implemented lock tracking and Lock & Load availability system
- Added league selection for users with multiple leagues
- Created proper loading and empty states for better UX

### Mobile-First PWA Navigation (Aug 9, 2025)
- Implemented bottom navigation bar with 5 core tabs following modern fantasy app patterns
- Renamed "My Teams" to "Stable" to better represent the unique 5-team concept
- Integrated free agent trading functionality directly into the Stable tab using a tabbed interface
- Navigation: Home, Stable, League, Scores, More
- Enhanced PWA design with 60px touch targets, 28px icons, and 80px tall navigation bar
- Fixed team logo loading issues by using correct path structure (/images/nfl/team_logos/)

### Production Testing Strategy (Aug 9, 2025)
- Configured stable development domain using REPLIT_DEV_DOMAIN for consistent OAuth testing
- Updated authentication to support both development and production environments
- Created comprehensive production testing guidelines for seamless app updates
- Established three-stage workflow: development → production validation → release

## Game Mechanics Summary
- **6-player leagues** with **5 NFL teams** each (30/32 teams drafted, 2 free agents)
- **Snake draft** with **division restrictions** (max 1 team per division unless unavoidable)
- **Weekly scoring**: Wins (+1), Ties (+0.5), Blowouts (+1), Shutouts (+1), Weekly high (+1), Weekly low (-1)
- **Lock system**: Pick 1 team to lock weekly for +1 bonus (up to 4 times per team per season)
- **Lock and Load**: Once per team per season, +2 for win, -1 for loss
- **Trading**: Team-to-team trading allowed during trade window (Monday night to Thursday 8:20 PM ET)
  - No lock restrictions on newly acquired teams
  - Cannot trade teams once their week has started 
  - Maximum 1 trade transaction per week
  - Free agent pickups available (drop a team to claim free agent)
- **Skins**: Weekly $30 cash prizes that stack when tied
- **Season prizes**: Most points ($50), Super Bowl winner ($10), most correct locks ($10)

# User Preferences

Preferred communication style: Simple, everyday language.

# Technical Documentation

Comprehensive technical stack documentation is available in `TECH_STACK.md`, covering:
- Complete frontend and backend architecture
- Database design and ORM implementation  
- Real-time WebSocket communication system
- Progressive Web App (PWA) features
- Deployment and scaling strategies
- Security considerations and performance optimizations

# System Architecture

## Frontend Architecture

The client-side application is built with React 18 and TypeScript, utilizing hooks and functional components. The UI framework leverages `shadcn/ui` components, built on `Radix UI primitives` and styled with `Tailwind CSS`. `Wouter` is used for lightweight client-side routing. State management, caching, and data fetching are handled by `TanStack Query (React Query)`. `Vite` serves as the build tool, providing fast hot module replacement and optimized production builds. Styling employs custom CSS variables for a comprehensive design system with light/dark theme support and a custom color palette.

## Backend Architecture

The server is built with Express.js using TypeScript, following a modular architecture with ESM modules. `Passport.js` with Google OAuth2 strategy handles user authentication, using JWT tokens stored as HTTP-only cookies for session management. `Drizzle ORM` provides type-safe database operations with `PostgreSQL`, configured with the `Neon serverless PostgreSQL` adapter. API design is RESTful, including comprehensive error handling and request/response logging.

### Production-Ready Scaling Improvements
Draft state and timers persist using Redis with an in-memory fallback for development. Enhanced JWT authentication includes Bearer header support for PWA compatibility. PostgreSQL connections are optimized with connection pooling, health monitoring, and limits. Health check endpoints (`/api/health`) monitor database, Redis, and overall system health. Static assets are served with proper MIME types and cache headers for production deployment.

### Real-Time Draft System
Real-time draft synchronization is managed via WebSocket connections. A comprehensive snake draft manager handles draft logic, timer management, auto-pick functionality, and **division rule validation** (max 1 team per division unless unavoidable). Draft state persists across page reloads and reconnections, with automatic timer restoration. The system includes an automated bot user system for comprehensive draft testing and features enhanced timer resilience.

### Testing Infrastructure
The system includes robust testing features such as complete draft state reset functionality for iterative testing, automated addition/removal of bot users to leagues, real-time WebSocket connection status tracking with automatic reconnection, and timer diagnostics for monitoring and manual intervention. The draft order is verified for a 6-user snake draft.

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
- **Upstash Redis**: Persistent state management.

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

## Testing Infrastructure
- **Robot Manager**: Automated testing with bot users.