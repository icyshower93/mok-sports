# Mok Sports Technical Stack Documentation

## Overview

Mok Sports is a modern Progressive Web Application (PWA) for fantasy sports that enables users to draft entire NFL teams instead of individual players. The application features real-time drafting, persistent state management, and a highly scalable architecture designed for production deployment on Replit Reserved VM.

---

## Frontend Architecture

### Core Framework
- **React 18** with TypeScript
  - Functional components with hooks
  - Strict mode enabled for development
  - Modern ES2022+ features

### Build System & Development
- **Vite** - Ultra-fast build tool and development server
  - Hot Module Replacement (HMR)
  - Tree-shaking for optimized production builds
  - ES modules support
  - TypeScript compilation via ESBuild

### UI Framework & Styling
- **Tailwind CSS** - Utility-first CSS framework
  - Custom design system with CSS variables
  - Light/dark theme support
  - Responsive design patterns
- **shadcn/ui** - Modern component library
  - Built on Radix UI primitives
  - Accessible components out-of-the-box
  - Customizable with Tailwind
- **Radix UI** - Low-level UI primitives
  - Accessibility compliant
  - Unstyled, composable components
- **Lucide React** - Icon library with 1000+ icons

### Routing & Navigation
- **Wouter** - Lightweight client-side routing
  - ~2.8KB bundle size
  - Hook-based routing API
  - No dependencies

### State Management & Data Fetching
- **TanStack Query (React Query v5)** - Server state management
  - Caching and synchronization
  - Background updates
  - Optimistic updates
  - Error handling and retry logic
- **React Hooks** - Local state management
  - useState for component state
  - useEffect for side effects
  - Custom hooks for business logic

### Form Handling
- **React Hook Form** - Performant form library
  - Minimal re-renders
  - Built-in validation
- **Zod** - TypeScript-first schema validation
  - Runtime type checking
  - Form validation integration

### Real-Time Communication
- **WebSocket API** - Native browser WebSocket
  - Custom connection management
  - Automatic reconnection logic
  - Heartbeat monitoring
  - Connection pooling

---

## Backend Architecture

### Core Framework
- **Node.js** with TypeScript
- **Express.js** - Web application framework
  - RESTful API design
  - Middleware-based architecture
  - CORS configuration
  - Session management

### Module System
- **ES Modules (ESM)** - Modern JavaScript modules
  - Tree-shaking support
  - Static analysis benefits
  - Better tooling support

### Authentication & Security
- **Passport.js** - Authentication middleware
  - Google OAuth2 strategy
  - JWT token management
- **JWT (JSON Web Tokens)** - Stateless authentication
  - HTTP-only cookies for web security
  - Bearer token support for PWA compatibility
- **Cookie Security**
  - httpOnly flag
  - secure flag (production)
  - sameSite configuration

### Database & ORM
- **PostgreSQL** - Primary relational database
  - ACID compliance
  - JSON support for complex data
  - Full-text search capabilities
- **Neon** - Serverless PostgreSQL platform
  - Auto-scaling
  - Branching for development
  - Connection pooling
- **Drizzle ORM** - Type-safe database toolkit
  - Zero-cost abstractions
  - SQL-like syntax
  - Migration system
  - Zod integration for validation

### Caching & State Persistence
- **Redis** - In-memory data store
  - Draft state persistence
  - Session storage
  - Real-time data caching
- **Upstash Redis** - Serverless Redis
  - HTTP-based API
  - Global edge caching
  - Automatic scaling

### Real-Time Communication
- **ws** - WebSocket library for Node.js
  - High-performance WebSocket server
  - Custom draft synchronization
  - Connection management
  - Heartbeat monitoring

---

## Data Layer

### Database Schema
```
Users Table
├── Authentication (Google OAuth)
├── Profile information
└── Timestamps

Leagues Table
├── League configuration
├── Creator relationships
├── Member management
└── Draft scheduling

Drafts Table
├── Draft state management
├── Snake draft logic
├── Timer configuration
└── Pick tracking

NFL Teams Table
├── Team information
├── Conference/Division data
└── Logo assets
```

### Data Validation
- **Zod Schemas** - Runtime validation
  - API request/response validation
  - Database insert/update schemas
  - Form validation rules
- **Drizzle Relations** - Type-safe relationships
  - Foreign key constraints
  - Join operations
  - Cascade operations

---

## Development Tools

### TypeScript Configuration
- **Strict mode enabled**
- **Path mapping** for clean imports
- **ES2022 target** for modern features
- **Incremental compilation**

### Code Quality
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript compiler** - Type checking

### Package Management
- **npm** - Dependency management
- **package-lock.json** - Deterministic installs

---

## Progressive Web App (PWA) Features

### Service Worker
- **Custom service worker** implementation
- **Cache strategies** for offline support
- **Background sync** capabilities
- **Push notifications** support

### Web App Manifest
- **Installable PWA** on mobile/desktop
- **Custom icons** and branding
- **Offline capabilities**
- **Native app-like experience**

### Performance Optimization
- **Code splitting** via Vite
- **Lazy loading** of components
- **Image optimization**
- **Bundle size optimization**

---

## Deployment & Infrastructure

### Platform
- **Replit Reserved VM** - Production hosting
  - Dedicated resources
  - Sticky sessions for WebSocket
  - Custom domain support
  - SSL/TLS termination

### Environment Configuration
- **Environment variables** for configuration
- **Development/Production** builds
- **Secret management** via Replit Secrets

### Database Hosting
- **Neon PostgreSQL** - Serverless database
  - Auto-scaling compute
  - Instant branching
  - Point-in-time recovery
  - Global availability

### Caching Layer
- **Upstash Redis** - Serverless Redis
  - Edge caching
  - Automatic scaling
  - HTTP-based access

---

## Real-Time Draft System

### Snake Draft Algorithm
- **Round-based progression** (5 rounds default)
- **Snake pattern** (1-6, 6-1, 1-6, etc.)
- **Pick time limits** (60 seconds default)
- **Auto-pick** functionality for timeouts

### Timer Management
- **Server-side timer authority**
- **Client-side countdown display**
- **Automatic timer recovery** after restarts
- **Persistent timer state** in Redis

### WebSocket Communication
- **Draft state synchronization**
- **Real-time pick updates**
- **Timer broadcasts**
- **Connection health monitoring**

---

## Testing Infrastructure

### Automated Testing
- **Robot user system** for draft testing
- **Automated draft scenarios**
- **Connection stress testing**
- **Timer accuracy verification**

### Development Tools
- **Draft reset functionality**
- **Real-time diagnostics**
- **Connection status monitoring**
- **Performance metrics**

---

## Security Considerations

### Authentication Security
- **OAuth 2.0** with Google
- **JWT token validation**
- **Secure cookie configuration**
- **CSRF protection**

### API Security
- **Input validation** with Zod
- **SQL injection prevention** via ORM
- **Rate limiting** capabilities
- **CORS configuration**

### Database Security
- **Connection pooling**
- **Prepared statements** via Drizzle
- **Environment-based credentials**
- **SSL connections**

---

## Performance Optimizations

### Frontend Performance
- **Code splitting** and lazy loading
- **React Query caching**
- **Optimized re-renders**
- **Bundle size optimization**

### Backend Performance
- **Connection pooling** for PostgreSQL
- **Redis caching** for frequent queries
- **Efficient WebSocket management**
- **Database query optimization**

### Network Performance
- **HTTP/2 support**
- **Gzip compression**
- **Static asset caching**
- **CDN-ready architecture**

---

## Development Workflow

### Local Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run db:push      # Push schema changes
```

### Database Management
- **Drizzle migrations** for schema changes
- **Development/Production** environment separation
- **Database seeding** for testing

### Deployment Process
- **Automatic builds** on Replit
- **Environment-specific** configurations
- **Health check endpoints**
- **Graceful shutdowns**

---

## Future Scalability

### Horizontal Scaling
- **Stateless application design**
- **Redis-based session storage**
- **Load balancer ready**
- **Microservice potential**

### Database Scaling
- **Read replicas** support
- **Sharding capabilities**
- **Connection pooling**
- **Query optimization**

### Caching Strategy
- **Multi-layer caching**
- **CDN integration**
- **Edge computing** ready
- **Cache invalidation** strategies

---

## Monitoring & Observability

### Logging
- **Structured logging**
- **Error tracking**
- **Performance monitoring**
- **User analytics**

### Health Checks
- **Database connectivity**
- **Redis availability**
- **WebSocket status**
- **Application health**

### Metrics
- **Response times**
- **Error rates**
- **Connection counts**
- **Draft completion rates**

---

This technical stack provides a robust, scalable foundation for a modern fantasy sports application with real-time capabilities, strong type safety, and production-ready performance characteristics.