# Overview

Mok Sports is a fantasy sports application that redefines traditional fantasy leagues by enabling users to draft entire NFL teams instead of individual players. It features unique mechanics including weekly "locks" for bonus points, "Lock and Load" high-risk/high-reward plays, dynamic free agent trading, and weekly "skins" prizes. The platform provides a modern web interface, a robust backend, and integrates Google OAuth for authentication, aiming to deliver a unique and engaging fantasy sports experience with a focus on real-time drafting, persistent state, and high availability.

## Game Mechanics Summary

- **6-player leagues** with **5 NFL teams** each (30/32 teams drafted, 2 free agents)
- **Snake draft** with **division restrictions** (max 1 team per division unless unavoidable)
- **Weekly scoring**: Wins (+1), Ties (+0.5), Blowouts (+1), Shutouts (+1), Weekly high (+1), Weekly low (-1)
- **Lock system**: Pick 1 team to lock weekly for +1 bonus (up to 4 times per team per season).
- **Lock and Load**: Once per team per season, +2 for win, -1 for loss
- **Trading**: Team-to-team trading during a specific window (Monday night to Thursday 8:20 PM ET). Includes free agent pickups.
- **Skins**: Weekly $30 cash prizes that stack when tied. **FIXED: Smart weekly reset system preserves Mok points during game processing while enabling proper skins competition.**
- **Season prizes**: Most points ($50), Super Bowl winner ($10), most correct locks ($10).

# User Preferences

Preferred communication style: Simple, everyday language.

## Recent Critical Fixes (August 2025)
- **Mok Points Calculation Bug RESOLVED**: Fixed week progression logic that was wiping out freshly calculated points immediately after games completed. Implemented smart weekly reset system that preserves points during game processing while enabling proper weekly skins competition.
- **Weekly Skins Architecture**: Weekly points stored in `user_weekly_scores.totalPoints` (reset each week), season totals calculated dynamically by summing all weeks. Skins awarded based on highest weekly points only.
- **NFL Game Processing Bug RESOLVED**: Fixed incomplete September 15 game processing where 8 games failed due to missing API data. Extended authentic 2024 score coverage to include all Week 2 games with correct away@home format matching. All future weeks will fall back gracefully to Tank01 API or database scores.
- **Weekly Skins Reset Bug RESOLVED**: Fixed smart reset system that was preventing weekly skins competition from resetting to 0 at the start of each new week. Weekly skins now properly reset during week transitions (Week 1→2, 2→3, etc.) to ensure fair competition, while still preserving Mok points during same-week game processing.

# System Architecture

## Frontend Architecture

The client-side is a React 18, TypeScript application using hooks and functional components. The UI is built with `shadcn/ui` (on `Radix UI primitives`) and styled with `Tailwind CSS`, supporting light/dark themes and a custom color palette. `Wouter` handles client-side routing, and `TanStack Query` manages state, caching, and data fetching. `Vite` is used for development and optimized production builds.

## Backend Architecture

The server is built with Express.js in TypeScript, following a modular architecture with ESM modules. `Passport.js` with Google OAuth2 handles user authentication, using JWT tokens in HTTP-only cookies. `Drizzle ORM` provides type-safe database operations with `PostgreSQL`, using the `Neon serverless PostgreSQL` adapter. The API is RESTful, with robust error handling and logging.

### Key Architectural Decisions

- **Production Scaling**: Redis (with in-memory fallback) for draft state persistence. Enhanced JWT authentication with Bearer header support. PostgreSQL connections optimized with pooling and health monitoring.
- **Real-Time Draft System**: WebSocket connections manage real-time draft synchronization, including snake draft logic, timer management, auto-pick, and division rule validation. Draft state persists across reconnections.
- **Scoring System**: Hybrid scoring system leveraging Tank01 API for current season data and ESPN for historical data. Integrates Mok Sports specific scoring rules (blowout bonuses, weekly penalties, lock system). **CRITICAL BUG FIXED (Aug 2025): Smart weekly reset system prevents point loss during game processing.**
- **Weekly Skins System**: Automated weekly cash prize system where highest scorer wins 1 skin ($30). Ties automatically roll over skins to next week, creating accumulated prizes. **ARCHITECTURE: Weekly points reset for skins competition, season totals calculated by summing all weeks.**
- **Automatic Week Display**: Scores tab intelligently displays appropriate week based on current date and game completion status, and allows manual override.
- **Admin Panel**: Simplified admin panel for season management and progression, including one-click season switching and real-time NFL season simulation with time acceleration.
- **NFL Data Integration**: Comprehensive NFL schedule and point spread import system with RapidAPI integration and ESPN API fallbacks. Tank01 RapidAPI is the primary source.
- **Mobile-First Design**: Implemented with a bottom navigation bar for core tabs and PWA design principles.

## Data Storage Solutions

The primary database is PostgreSQL, hosted on Neon serverless. User sessions are managed via JWT tokens in HTTP-only cookies.

## Authentication and Authorization

Google OAuth2 is the primary authentication mechanism. JWT tokens are securely signed, and cookies are configured with `httpOnly`, `secure` (in production), and `sameSite` flags. New users are automatically registered upon first Google login.

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

## Third-Party APIs
- **Tank01 RapidAPI**: NFL game data, scores, and betting odds.
- **ESPN API**: Fallback for historical NFL data.