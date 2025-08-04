# Overview

Mok Sports is a fantasy sports application that redefines traditional fantasy leagues by enabling users to draft entire teams instead of individual players. It features a modern web interface, a robust backend, and integrates Google OAuth for authentication, aiming to provide a unique and engaging fantasy sports experience.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The client-side application is built with React 18 and TypeScript, using hooks and functional components. The UI framework leverages `shadcn/ui` components, built on `Radix UI primitives` and styled with `Tailwind CSS`. `Wouter` is used for lightweight client-side routing. State management, caching, and data fetching are handled by `TanStack Query (React Query)`. `Vite` serves as the build tool, providing fast hot module replacement and optimized production builds. Styling employs custom CSS variables for a comprehensive design system with light/dark theme support and a custom color palette.

## Backend Architecture

The server is built with Express.js using TypeScript, following a modular architecture with ESM modules. `Passport.js` with Google OAuth2 strategy handles user authentication, using JWT tokens stored as HTTP-only cookies for session management. `Drizzle ORM` provides type-safe database operations with `PostgreSQL`, configured with the `Neon serverless PostgreSQL` adapter. API design is RESTful, including comprehensive error handling and request/response logging.

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