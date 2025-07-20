# IoT Controller - Replit Configuration

## Overview

This is a full-stack IoT device controller application built with React + TypeScript frontend and Express + Node.js backend. The application is designed to discover, manage, and control ESPHome devices on a local network with a dark OLED theme optimized for mobile and desktop use. The application starts with a clean state - no test devices are included in the production build.

## Recent Changes

**July 19, 2025**
- ✓ Removed all test devices for clean production deployment
- ✓ Fixed all TypeScript compilation errors (9 errors across 4 files)
- ✓ Verified Node.js 20 compatibility for production builds
- ✓ Server configured for 0.0.0.0 visibility across network
- ✓ Production build working correctly with import.meta.dirname support
- ✓ Created Node.js v18 compatibility script (start-prod.js) for deployment
- ✓ Added comprehensive production deployment instructions

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development
- **UI Library**: Shadcn/ui components with Radix UI primitives
- **Styling**: TailwindCSS with OLED dark theme (pure black background)
- **State Management**: TanStack Query for server state and React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Database**: PostgreSQL with Drizzle ORM (configured but can use in-memory storage for development)
- **API**: RESTful endpoints for device management and control
- **Development**: Vite integration for seamless full-stack development

### Key Design Decisions

**Monorepo Structure**: Single repository with client, server, and shared code for easier development and deployment.

**Shared Schema**: Common TypeScript types and Zod schemas in `/shared` directory for type safety across frontend and backend.

**OLED Theme**: Pure black backgrounds (#000000) with green (#00FF00) for "on" states, red (#FF0000) for "off" states, and blue (#00BFFF) for neutral states to optimize for OLED displays.

## Key Components

### Frontend Components
- **DeviceList**: Displays all discovered devices with status indicators and Lucide icons
- **DeviceControlModal**: Individual device control interface with dynamic buttons
- **AddDeviceModal**: Form for manually adding devices or editing existing ones
- **DeviceDiscovery**: Network scanning and device statistics dashboard
- **Settings**: Configuration page for ESPHome server, interface preferences, and advanced options

### Backend Services
- **Device Management**: CRUD operations for IoT devices
- **Storage Layer**: Abstracted storage interface with in-memory implementation (can be extended to PostgreSQL)
- **API Routes**: RESTful endpoints for device operations and control commands

### Database Schema
```typescript
devices: {
  id: serial primary key
  name: text (device name)
  ip: text (device IP address)
  port: integer (default 6053)
  apiPassword: text (optional)
  isOnline: boolean (connection status)
  lastSeen: timestamp
  deviceType: text (light, sensor, switch, etc.)
  autoDiscover: boolean
  createdAt: timestamp
}
```

## Data Flow

1. **Device Discovery**: Backend scans network for ESPHome devices using mDNS
2. **Status Updates**: Periodic polling of device status and entity states
3. **Command Execution**: Frontend sends commands through REST API to control devices
4. **Real-time Updates**: TanStack Query handles cache invalidation and background refetching

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless driver
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **react-hook-form**: Form handling
- **zod**: Schema validation
- **wouter**: Lightweight routing

### UI Dependencies
- **@radix-ui/***: Accessible component primitives
- **tailwindcss**: Utility-first styling
- **lucide-react**: Icon library (replaced buggy SVG icons)
- **class-variance-authority**: Component variant system

## Deployment Strategy

### Development Mode
- Vite dev server for frontend with HMR
- Express server with TypeScript compilation
- Shared development environment on port configuration

### Production Build
- Frontend: Vite builds static assets to `dist/public`
- Backend: esbuild bundles server code to `dist/index.js`
- Single deployment artifact serving both frontend and API

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (optional for in-memory mode)
- `NODE_ENV`: Environment setting (development/production)

### Database Migrations
- Drizzle Kit handles schema migrations
- `npm run db:push` applies schema changes to database

The application is designed to work both with and without a PostgreSQL database, falling back to in-memory storage for development and testing purposes.