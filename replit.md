# Overview

Mok Sports is a fantasy sports application that reimagines traditional fantasy leagues by allowing users to draft entire teams rather than individual players. The application features a modern web interface built with React and TypeScript, utilizing a full-stack architecture with Express.js backend, PostgreSQL database, and Google OAuth authentication.

# User Preferences

Preferred communication style: Simple, everyday language.

# Testing Scenario

## Test League Setup (January 2025)
- **League Name**: Test League 1
- **Join Code**: EEW2YU
- **Status**: FULL (6/6 members)
- **Creator**: Sky Evans (skyevans04@gmail.com)
- **Members**: 
  - Mok Sports (mokfantasysports@gmail.com)
  - Alex Rodriguez (alex.rodriguez.test@example.com) 
  - Sarah Chen (sarah.chen.test@example.com)
  - Marcus Johnson (marcus.johnson.test@example.com)
  - Emily Davis (emily.davis.test@example.com)

This setup allows testing the complete league workflow including:
- League full notification triggers
- Draft scheduling functionality for creators
- Push notification system for PWA users
- Full league member management and interaction

# System Architecture

## Frontend Architecture

The client-side application is built with **React 18** and **TypeScript**, utilizing modern React patterns including hooks and functional components. The UI framework is based on **shadcn/ui** components built on top of **Radix UI primitives** and styled with **Tailwind CSS**. The application uses **Wouter** for client-side routing instead of React Router, providing a lightweight navigation solution.

**State Management**: The application uses **TanStack Query (React Query)** for server state management, caching, and data fetching. Authentication state is managed through a custom React context provider that integrates with the query system.

**Build System**: **Vite** is used as the build tool and development server, providing fast hot module replacement and optimized production builds. The configuration includes custom path aliases for organized imports and development-specific plugins for error handling.

**Styling Strategy**: Custom CSS variables define a comprehensive design system with support for light/dark themes. The color palette includes brand-specific colors (fantasy-green, trust-blue, accent-gold) alongside the standard Tailwind color system.

## Backend Architecture

The server is built with **Express.js** using TypeScript and follows a modular architecture pattern. The application uses **ESM modules** throughout for modern JavaScript support.

**Authentication System**: Implements **Passport.js** with Google OAuth2 strategy for user authentication. JWT tokens are used for session management, stored as HTTP-only cookies for security. The authentication flow supports both new user registration and existing user login scenarios.

**Database Layer**: **Drizzle ORM** provides type-safe database operations with PostgreSQL. The ORM configuration uses the Neon serverless PostgreSQL adapter for cloud deployment compatibility. Database migrations are managed through Drizzle Kit.

**API Design**: RESTful API endpoints handle authentication flows and user data operations. The server includes comprehensive error handling middleware and request/response logging for debugging.

**Development Tools**: Custom Vite integration enables server-side rendering during development while serving static files in production. The setup includes runtime error overlays and development banners for enhanced developer experience.

## Data Storage Solutions

**Primary Database**: PostgreSQL database hosted on Neon serverless platform, chosen for its scalability and managed infrastructure. The database schema is defined using Drizzle ORM with TypeScript for type safety.

**Session Management**: User sessions are managed through JWT tokens stored in HTTP-only cookies, providing security against XSS attacks while maintaining stateless server architecture.

**Schema Design**: The current schema includes a users table with Google OAuth integration fields, timestamps for user tracking, and UUID primary keys for scalability.

## Authentication and Authorization

**OAuth Integration**: Google OAuth2 provides the primary authentication mechanism, reducing user friction and leveraging trusted identity providers. The implementation handles profile data extraction and user account creation/linking.

**Security Measures**: JWT tokens use secure signing with environment-specific secrets. Cookies are configured with appropriate security flags (httpOnly, secure in production, sameSite) to prevent common web vulnerabilities.

**User Flow**: New users are automatically registered upon first Google login, while existing users are authenticated and redirected appropriately. Error handling covers authentication failures and provides user feedback.

**Configuration Management**: OAuth configuration is checked dynamically, allowing the application to gracefully handle missing credentials without crashing. The frontend checks OAuth availability before attempting authentication, providing appropriate error messages to users when sign-in is unavailable.

# External Dependencies

## Authentication Services
- **Google OAuth2**: Primary authentication provider requiring client ID and secret configuration
- **Passport.js**: Authentication middleware with Google strategy implementation

## Database and ORM
- **Neon PostgreSQL**: Serverless PostgreSQL database platform
- **Drizzle ORM**: Type-safe database toolkit with PostgreSQL dialect
- **@neondatabase/serverless**: Neon-specific database driver with WebSocket support

## UI and Styling
- **Radix UI**: Comprehensive primitive component library for accessible UI elements
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **shadcn/ui**: Pre-built component library built on Radix UI primitives
- **Lucide React**: Icon library providing consistent iconography

## Development and Build Tools
- **Vite**: Modern build tool and development server
- **TypeScript**: Type system for enhanced developer experience and code reliability
- **ESBuild**: Fast JavaScript bundler for production builds

## Runtime Dependencies
- **TanStack Query**: Server state management and caching solution
- **Wouter**: Lightweight client-side routing library
- **date-fns**: Date manipulation and formatting utilities
- **Zod**: Schema validation library for runtime type checking