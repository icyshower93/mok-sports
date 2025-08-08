# Overview

Mok Sports is a fantasy sports application that redefines traditional fantasy leagues by enabling users to draft entire teams instead of individual players. It features a modern web interface, a robust backend, and integrates Google OAuth for authentication. The project aims to provide a unique and engaging fantasy sports experience with a focus on real-time drafting, persistent state, and a highly available system.

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
Real-time draft synchronization is managed via WebSocket connections. A comprehensive snake draft manager handles draft logic, timer management, auto-pick functionality, and conference rule validation. Draft state persists across page reloads and reconnections, with automatic timer restoration. The system includes an automated bot user system for comprehensive draft testing and features enhanced timer resilience.

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