# Overview

Mok Sports is a fantasy sports application that redefines traditional fantasy leagues by enabling users to draft entire NFL teams instead of individual players. It features unique mechanics including weekly "locks" for bonus points, "Lock and Load" high-risk/high-reward plays, dynamic free agent trading, and weekly "skins" prizes. The platform provides a modern web interface, a robust backend, and integrates Google OAuth for authentication, aiming to deliver a unique and engaging fantasy sports experience with a focus on real-time drafting, persistent state, and high availability.

## Game Mechanics Summary

- **6-player leagues** with **5 NFL teams** each (30/32 teams drafted, 2 free agents)
- **Snake draft** with **division restrictions** (max 1 team per division unless unavoidable)
- **Weekly scoring**: Wins (+1), Ties (+0.5), Blowouts (+1), Shutouts (+1), Weekly high (+1), Weekly low (-1)
- **Lock system**: Pick 1 team to lock weekly for +1 bonus (up to 4 times per team per season). Logic is tied to actual game completion status, not API cache.
- **Lock and Load**: Once per team per season, +2 for win, -1 for loss
- **Trading**: Team-to-team trading during a specific window (Monday night to Thursday 8:20 PM ET). Includes free agent pickups.
- **Skins**: Weekly $30 cash prizes that stack when tied.
- **Season prizes**: Most points ($50), Super Bowl winner ($10), most correct locks ($10).

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The client-side is a React 18, TypeScript application using hooks and functional components. The UI is built with `shadcn/ui` (on `Radix UI primitives`) and styled with `Tailwind CSS`, supporting light/dark themes and a custom color palette. `Wouter` handles client-side routing, and `TanStack Query` manages state, caching, and data fetching. `Vite` is used for development and optimized production builds.

## Backend Architecture

The server is built with Express.js in TypeScript, following a modular architecture with ESM modules. `Passport.js` with Google OAuth2 handles user authentication, using JWT tokens in HTTP-only cookies. `Drizzle ORM` provides type-safe database operations with `PostgreSQL`, using the `Neon serverless PostgreSQL` adapter. The API is RESTful, with robust error handling and logging.

### Key Architectural Decisions

- **Production Scaling**: Redis (with in-memory fallback) for draft state persistence. Enhanced JWT authentication with Bearer header support. PostgreSQL connections optimized with pooling and health monitoring.
- **Real-Time Draft System**: WebSocket connections manage real-time draft synchronization, including snake draft logic, timer management, auto-pick, and division rule validation. Draft state persists across reconnections.
- **Scoring System**: Hybrid scoring system leveraging Tank01 API for current season data and ESPN for historical data. Integrates Mok Sports specific scoring rules (blowout bonuses, weekly penalties, lock system).
- **Weekly Skins System**: Automated weekly cash prize system where highest scorer wins 1 skin ($30). Ties automatically roll over skins to next week, creating accumulated prizes (2, 3, or more skins). Complete database tracking with audit trail.
- **Automatic Week Display**: Scores tab intelligently displays appropriate week based on current date and game completion status. Shows current week during games, automatically switches to next week when all games complete. Users can manually override selection.
- **Admin Panel**: Simplified admin panel for season management and progression, including one-click season switching (e.g., 2024 testing vs. 2025 production). Real-time NFL season simulation with time acceleration controls and authentic game processing.
- **NFL Data Integration**: Comprehensive NFL schedule and point spread import system with RapidAPI integration and ESPN API fallbacks. Tank01 RapidAPI is the primary source for 2024/2025 NFL season data, including game scores and betting odds.
- **Mobile-First Design**: Implemented with a bottom navigation bar for core tabs (Home, Stable, League, Scores, More) and PWA design principles (touch targets, icon sizes).

## Data Storage Solutions

The primary database is PostgreSQL, hosted on Neon serverless. User sessions are managed via JWT tokens in HTTP-only cookies. The schema includes user data with Google OAuth integration, timestamps, and UUID primary keys.

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

# Recent Updates (August 2025)

## Comprehensive Scoring System for All Weeks - IMPLEMENTED
- **Fixed Point Allocation Pipeline**: Resolved critical bug where games were processed but points weren't allocated to users
- **Enhanced API Integration**: Added multiple Tank01 API fallback methods (box score → weekly games → daily games) for robust data retrieval
- **Authentic NFL Scores for Weeks 1-2**: Manually added real NFL scores for comprehensive testing capability
- **Corrected Data Types**: Fixed ID parsing issues in point calculation function that prevented proper team owner lookup
- **Real-Time Point Updates**: Points now calculate instantly when games complete and are immediately visible in season standings and weekly skins
- **Comprehensive Week Coverage**: System now works for all weeks 1-18 using authentic data sources
- **Date**: August 14, 2025

## Real-Time Score Updates System - PERSISTENT WEBSOCKET SOLUTION IMPLEMENTED
- **Root Issue Identified**: Fixed WebSocket connection dropping immediately after establishment (code 1001 "Going away") caused by React component lifecycle management
- **Singleton WebSocket Manager**: Created `websocket-manager.ts` service for persistent connections that survive React component lifecycles and PWA navigation  
- **Enhanced Connection Persistence**: WebSocket connections no longer drop on component re-renders or page navigation
- **Aggressive Keep-Alive System**: 15-second ping intervals with automatic reconnection detection and recovery
- **Immediate Message Handling**: Direct cache invalidation with `refetchType: 'active'` on admin_date_advanced, admin_season_reset, weekly_bonuses_calculated events
- **Smart Reconnection Logic**: Exponential backoff (up to 30s) with 5 retry attempts and automatic connection recovery
- **PWA-Optimized Architecture**: Singleton pattern prevents multiple WebSocket instances and ensures stable connections in PWA environments
- **Simplified Integration**: Removed aggressive polling fallback - now relies on stable WebSocket connections for real-time updates
- **Multi-Event Support**: Handles all admin events with immediate data refresh using queryClient invalidation
- **Build Hash**: meapo7wa includes persistent WebSocket manager addressing root connection stability issues
- **Date**: August 14, 2025

## Season Reset with Skins Reset - IMPLEMENTED
- **Enhanced Reset Season Button**: Added weekly skins table cleanup to `/api/admin/reset-season` endpoint  
- **Complete Data Reset**: Now clears userWeeklyScores AND weeklySkins tables when season is reset
- **Real-Time Broadcast**: Season reset triggers "admin_season_reset" WebSocket event for immediate UI refresh
- **Comprehensive Cleanup**: Removes all skins winners, rollover data, and prize tracking for clean testing restart
- **TypeScript Error Resolution**: Fixed all remaining LSP diagnostics in admin routes
- **Date**: August 13, 2025

## Page Loading & API Endpoint Fixes - RESOLVED
- **Fixed League Page Loading**: Corrected API endpoints from non-existent `/api/leagues/{id}/members` to working `/api/leagues/{id}/standings`
- **Fixed Scores Page User Teams**: Changed from missing `/api/user/teams` to working `/api/user/stable/{leagueId}` endpoint
- **Verified API Functionality**: All core endpoints now operational:
  - `/api/leagues/{id}/standings` - Complete league standings with all members
  - `/api/scoring/leagues/{id}/week-scores/{season}/{week}` - Weekly scoring data
  - `/api/scoring/skins/{leagueId}/{season}` - Weekly skins winners and prizes
  - `/api/user/stable/{leagueId}` - User's teams for highlighting owned teams
- **Page Navigation Fixed**: Both League and Scores tabs now load without "something is wrong" errors
- **Data Integration Working**: Real-time scoring, team highlighting, and skins tracking all functional
- **Date**: August 13, 2025

## Weekly Skins Reset System - IMPLEMENTED
- **Enhanced Week Progression Logic**: Added `resetWeeklyPointsForAllLeagues()` function to properly clear weekly skins competition when new week starts
- **Preserved Season Totals**: Weekly point reset only affects current week scores (for skins calculation), season totals remain intact by summing all previous weeks
- **Automatic Reset Trigger**: Week progression automatically resets weekly points to 0 for all users, ensuring fresh skins competition each week
- **Clear Documentation**: Added logging to distinguish between weekly skins reset and season total preservation
- **Integration Point**: Reset functionality integrated into `handleWeekProgression()` for automatic execution
- **Date**: August 13, 2025

## Bonus Calculation System - RESOLVED 
- **Fixed Critical Duplicate Processing Bug**: Eliminated bonus calculations happening multiple times causing inflated scores (Gamma Bot was getting 7x high score bonuses instead of 1)
- **Enhanced Race Condition Protection**: Added double-check logic with additional WHERE clause safety checks to prevent multiple bonus applications
- **Database Integrity Restoration**: Corrected existing inflated bonuses by capping high score bonuses at +1 and low score penalties at -1 maximum per week
- **Improved Deduplication Logic**: Added robust checks and row count validation to prevent bonus accumulation during date advancement
- **Real-Time Bonus Verification**: Bonuses now apply correctly with proper logging and duplicate detection across multiple game processing cycles
- **Date**: August 14, 2025