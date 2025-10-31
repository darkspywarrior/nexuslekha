# Social Gaming Matchmaking Platform

## Overview

GameMatch is a social gaming web application designed for real-time matchmaking between gamers. The platform enables users to create and browse match requests, find teammates, and form gaming groups across various popular games. It features a mobile-first design, instant notifications, and real-time updates to facilitate seamless gaming coordination and enhance the social gaming experience. The project aims to provide a robust platform for gamers to connect and play, addressing the need for efficient team-finding and community building in the gaming world.

## Recent Changes

### October 31, 2025
- **Voice Feature Consolidation**: Removed redundant voice controls from the Chat tab to eliminate confusion. The Voice tab is now the single, clear entry point for all voice communication features.
- **Discord-Style Voice Lobby**: Added a Discord-inspired lobby view in the Voice tab that shows participants waiting in the voice channel with their status (muted/live), making it easier to see who's available.
- **VoiceProvider Refactor**: Rewrote VoiceChannel component to use the centralized VoiceProvider context instead of local state, improving maintainability and preventing WebRTC "glare" issues where both users simultaneously send offers.
- **Deterministic Caller Selection**: Implemented caller arbitration using userId comparison to ensure only one user initiates the WebRTC offer, preventing call setup failures.

### October 30, 2025
- **Connections/Messages Sorting**: Modified Connections and Messages tabs to prioritize accepted connections at the top, with pending requests appearing below in collapsible sections for better UX.
- **LFO Bug Fix**: Fixed issue where LFO (Looking for Opponents) match requests were appearing in the LFG tab by requiring `matchType` and `duration` fields in the schema validation, preventing database defaults from overriding user selections.
- **Notifications Schema**: Created database schema for notifications system (foundation laid for future implementation of request status notifications).

## User Preferences

- **Communication Style**: Simple, everyday language
- **Development Mode**: Authentication is **DISABLED** by default during development.
- **Authentication**: Google OAuth 2.0 for production - Do not use or suggest alternative authentication methods (Replit Auth, email/password, etc.). The application is built specifically for Google OAuth integration.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite for development.
- **Routing**: Wouter for client-side routing.
- **State Management**: TanStack Query for server state management and caching.
- **UI Components**: Radix UI primitives with shadcn/ui.
- **Styling**: Tailwind CSS with a dark-mode-first, gaming-focused design system inspired by Discord, Steam, and Twitch.

### Backend Architecture
- **Runtime**: Node.js with Express.js server.
- **Database ORM**: Drizzle ORM for type-safe database operations.
- **Real-time Communication**: WebSocket integration for live updates.
- **Session Management**: Express sessions with PostgreSQL session store.
- **API Design**: RESTful endpoints supplemented by WebSockets.

### Authentication System
- **Provider**: Google OAuth 2.0.
- **Session Storage**: PostgreSQL-backed session store (`connect-pg-simple`).
- **Authorization**: Session-based authentication using Passport.js.
- **User Management**: Automatic user profile creation on first Google login.

### Database Design
- **Primary Database**: PostgreSQL via Neon serverless hosting.
- **Schema Management**: Drizzle Kit for migrations.
- **Core Tables**: Users, match requests, match connections, and session storage.

### Mobile-First Design
- **Responsiveness**: Tailwind breakpoints and mobile-first media queries.
- **Navigation**: Bottom tab bar for mobile, sidebar for desktop.
- **Performance**: Optimized bundle sizes and lazy loading.

### Core Features
- **Matchmaking System**: Create/browse match requests, accept/decline connections, hide unwanted matches.
- **User Profiles**: Unique gamertags, customizable bios, location, age, gender, language, and preferred games.
- **Game Profile Portfolios**: Detailed, game-specific portfolios including ranks, hours played, achievements, gameplay clips, and custom statistics with full CRUD operations.
- **Communication**: Direct messaging and real-time notifications via WebSockets.
- **Discovery**: Search and filter players and match requests.

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL.
- **Drizzle ORM**: Type-safe ORM.
- **connect-pg-simple**: PostgreSQL session store.

### Authentication
- **Google OAuth 2.0**: For user authentication.
- **Passport.js**: Authentication middleware.
- **Express Session**: Session management.

### UI and Styling
- **Radix UI**: Headless components.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.
- **Google Fonts**: Inter and Outfit.

### Development Tools
- **TypeScript**: For type safety.
- **Vite**: Fast development server.
- **ESBuild**: Production bundling.

### Real-time Infrastructure
- **WebSocket (`ws` package)**: For real-time communication.
- **TanStack Query**: Data fetching, caching, and synchronization.