# CodeSync - Real-Time Collaborative Code Editor

> "Figma for Code" - A production-ready platform for real-time collaborative coding with AI assistance

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.7-2D3748)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## Overview

CodeSync is a real-time collaborative code editor built with modern web technologies. Multiple developers can work on the same codebase simultaneously with automatic conflict resolution, real-time chat, cursor tracking, and AI assistance.

### Key Features

- 🔄 **Real-Time Collaboration** - Powered by Yjs CRDT for conflict-free editing
- 💬 **Live Chat** - Socket.io-based chat with reactions and threading
- 👁️ **Presence System** - See who's online and where they're editing
- 🤖 **AI Integration** - Code completion and explanations (coming soon)
- 🔐 **Secure Authentication** - JWT tokens with httpOnly cookies
- 📊 **Comprehensive Monitoring** - Prometheus metrics and structured logging
- 🎯 **Role-Based Access** - Owner, Editor, Commenter, Viewer roles
- 📝 **Audit Logging** - Complete history of all actions
- 🚀 **Production Ready** - Built with scalability and security in mind

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│  API Server  │────▶│  PostgreSQL │
│  (Next.js)  │     │  (Express)   │     │   Database  │
└─────────────┘     └──────────────┘     └─────────────┘
       │                    │
       │            ┌───────┴────────┐
       │            │                │
       ▼            ▼                ▼
┌─────────────┐ ┌──────────┐  ┌──────────┐
│ Yjs WebSocket│ │Socket.io │  │  Redis   │
│    Server    │ │  Server  │  │  Cache   │
└─────────────┘ └──────────┘  └──────────┘
```

## Tech Stack

### Backend
- **Runtime:** Node.js 22
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL 16 (Prisma ORM)
- **Cache:** Redis 7
- **Storage:** MinIO (S3-compatible)
- **Real-Time:** Yjs + WebSocket, Socket.io
- **Authentication:** JWT with httpOnly cookies
- **Validation:** Zod
- **Logging:** Winston
- **Metrics:** Prometheus

### Frontend (Planned)
- **Framework:** Next.js 14
- **Editor:** Monaco Editor
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Real-Time:** Yjs + y-monaco, Socket.io client

## Getting Started

### Prerequisites

- Node.js 22+
- Docker and Docker Compose
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/codesync.git
cd codesync
```

2. **Generate secrets**
```bash
bash scripts/generate-secrets.sh
```

This will create `.env` files with secure random secrets.

3. **Start Docker services**
```bash
docker-compose up -d
```

This starts PostgreSQL, Redis, and MinIO.

4. **Install backend dependencies**
```bash
cd backend
npm install
```

5. **Generate Prisma client**
```bash
npx prisma generate
```

6. **Run database migrations**

Migrations have been applied manually. To verify:
```bash
docker exec codesync-postgres psql -U codesync_user -d codesync -c "\dt"
```

### Running the Application

**Option 1: Run both servers together (recommended)**
```bash
cd backend
npm run dev:all
```

**Option 2: Run servers separately**

Terminal 1 - Main API server:
```bash
cd backend
npm run dev
```

Terminal 2 - Yjs WebSocket server:
```bash
cd backend
npm run dev:yjs
```

### Available Services

- **API Server:** http://localhost:4000
- **Yjs WebSocket:** ws://localhost:4001
- **Socket.io:** ws://localhost:4000/socket.io
- **Metrics:** http://localhost:4000/metrics
- **Health Check:** http://localhost:4000/health
- **Prisma Studio:** `npm run prisma:studio`

## API Documentation

Complete API documentation is available in [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

### Quick Examples

**Register a new user:**
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token>" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "name": "John Doe"
  }'
```

**Create a session:**
```bash
curl -X POST http://localhost:4000/api/sessions \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token>" \
  -H "Cookie: token=<jwt>" \
  -d '{
    "name": "My Project",
    "language": "typescript",
    "visibility": "PRIVATE"
  }'
```

**Connect to Yjs for collaborative editing:**
```javascript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const ydoc = new Y.Doc();
const provider = new WebsocketProvider(
  'ws://localhost:4001',
  'sessionId:fileName',
  ydoc
);

const ytext = ydoc.getText('codesync');
ytext.observe(() => {
  console.log('Document updated:', ytext.toString());
});
```

**Connect to Socket.io for chat:**
```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:4000', {
  auth: { token: '<jwt>' }
});

socket.emit('join:session', 'sessionId');

socket.on('message:new', (message) => {
  console.log('New message:', message);
});
```

## Project Structure

```
CodeSync/
├── backend/
│   ├── src/
│   │   ├── db/              # Database client
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── validators/      # Zod schemas
│   │   ├── websocket/       # WebSocket servers
│   │   ├── utils/           # Utilities
│   │   ├── index.ts         # Main API server
│   │   └── yjs-server.ts    # Yjs WebSocket server
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   └── package.json
├── frontend/                 # (To be implemented)
├── scripts/
│   └── generate-secrets.sh  # Secret generation
├── docker-compose.yml       # Docker services
├── API_DOCUMENTATION.md     # Complete API reference
├── CHANGELOG.md             # Development log
└── README.md                # This file
```

## Database Schema

The application uses a comprehensive PostgreSQL schema with:

- **Users** - Authentication and profiles
- **Sessions** - Collaborative sessions
- **Participants** - Session membership with roles
- **Session Files** - File content and Yjs states
- **Messages** - Chat functionality
- **Message Reactions** - Emoji reactions
- **Code Snapshots** - Version history
- **AI Usage** - Cost tracking
- **Audit Logs** - Complete action history
- **Rate Limits** - API/AI/WebSocket limits
- **Token Blacklist** - Secure logout

All tables support soft deletes and include comprehensive audit trails.

## Security

CodeSync implements multiple security layers:

- **Authentication:** JWT tokens in httpOnly cookies
- **CSRF Protection:** Token validation on all state-changing operations
- **Rate Limiting:** Per-user and per-IP limits
- **Password Hashing:** bcrypt with 12 rounds
- **Input Validation:** Zod schemas for all inputs
- **SQL Injection:** Protected by Prisma ORM
- **XSS Protection:** Helmet middleware
- **RBAC:** Role-based access control
- **Audit Logging:** Complete action history
- **Token Blacklist:** Secure logout mechanism

## Monitoring

Built-in monitoring with Prometheus metrics:

- HTTP request duration and counts
- WebSocket connection tracking
- Yjs document operations
- AI usage and costs
- Database query performance
- Rate limit hits
- Error tracking
- Active sessions and participants

Access metrics at: http://localhost:4000/metrics

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start API server
npm run dev:yjs          # Start Yjs server
npm run dev:all          # Start both servers

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio

# Production
npm run build            # Build TypeScript
npm run start            # Start API server
npm run start:yjs        # Start Yjs server

# Testing (to be implemented)
npm run test             # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

### Environment Variables

See `.env.example` for all required environment variables. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `CSRF_SECRET` - CSRF token secret
- `OPENAI_API_KEY` - OpenAI API key (for AI features)

## Deployment

### Production Build

```bash
# Build backend
cd backend
npm run build

# Start production servers
npm run start        # API server
npm run start:yjs    # Yjs server (in separate process)
```

### Docker Deployment

Docker support coming soon.

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

### Phase 1: Backend API ✅ (Complete)
- [x] Authentication system
- [x] Session management
- [x] Real-time collaboration (Yjs)
- [x] Real-time chat (Socket.io)
- [x] API documentation

### Phase 2: Frontend (In Progress)
- [ ] Next.js application setup
- [ ] Monaco editor integration
- [ ] Yjs + Monaco binding
- [ ] Chat UI
- [ ] User dashboard
- [ ] Admin panel

### Phase 3: AI Integration
- [ ] OpenAI integration
- [ ] Code completion
- [ ] Code explanation
- [ ] Refactoring suggestions
- [ ] Cost tracking

### Phase 4: Advanced Features
- [ ] Session invitations
- [ ] File upload
- [ ] Code snapshots
- [ ] Export functionality
- [ ] Search
- [ ] Notifications

### Phase 5: DevOps
- [ ] Docker production images
- [ ] Kubernetes manifests
- [ ] CI/CD pipeline
- [ ] Automated testing
- [ ] Performance testing
- [ ] Security audit

## Testing

Testing implementation is planned for Phase 5. Will include:

- Unit tests with Jest
- Integration tests
- E2E tests with Playwright
- Load testing
- Security testing

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation:** [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **Issues:** [GitHub Issues](https://github.com/yourusername/codesync/issues)
- **Email:** support@codesync.com

## Acknowledgments

- **Yjs** - Conflict-free replicated data types
- **Prisma** - Next-generation ORM
- **Socket.io** - Real-time communication
- **Monaco Editor** - VS Code's editor
- **Express** - Web framework
- **TypeScript** - Type safety

---

**Built with ❤️ by the CodeSync Team**

**Version:** 1.0.0
**Status:** Phase 1 Complete - Backend API Ready
**Last Updated:** 2025-10-27
