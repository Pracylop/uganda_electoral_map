# Uganda Electoral Map - Server

Backend server for the Uganda Electoral Map application providing REST API and WebSocket real-time updates.

## Technology Stack

- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 15 (PostGIS no longer required)
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **Real-time**: WebSockets (express-ws)

## Project Structure

```
server/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── config/                # Configuration files
│   ├── controllers/           # Request handlers
│   ├── middleware/            # Express middleware
│   ├── routes/                # API routes
│   ├── services/              # Business logic
│   ├── types/                 # TypeScript types
│   └── index.ts               # Application entry point
├── .env.example               # Environment variables template
├── package.json
└── tsconfig.json              # TypeScript configuration
```

## Setup

### Prerequisites

- Node.js 20 LTS or higher
- PostgreSQL 15+ (PostGIS extension no longer required - spatial queries use Turf.js)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your database credentials

4. Generate Prisma client:
```bash
npm run prisma:generate
```

5. Run database migrations:
```bash
npm run prisma:migrate
```

## Development

Start the development server with hot reload:
```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in `.env`)

## Database

### Prisma Commands

- **Generate client**: `npm run prisma:generate`
- **Create migration**: `npm run prisma:migrate`
- **Prisma Studio**: `npm run prisma:studio`

### Schema Overview

- **User**: User accounts with role-based access control (viewer, operator, editor, admin)
- **AdministrativeUnit**: Uganda's administrative hierarchy with PostGIS geometry
- **Election**: Election events (Presidential, Parliamentary, Local)
- **Candidate**: Candidates participating in elections
- **Result**: Election results with approval workflow
- **AuditLog**: Immutable audit trail for all system actions

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication (TODO)
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Current user info

### Results (TODO)
- `GET /api/results` - List results
- `POST /api/results` - Create result
- `POST /api/results/:id/submit` - Submit for verification
- `POST /api/results/:id/approve` - Approve result (Editor+)
- `POST /api/results/:id/reject` - Reject result (Editor+)

## WebSocket

WebSocket server runs on port 3001 (configurable via `WS_PORT` env variable).

### Message Types
- `AUTH` - Authenticate connection
- `RESULT_CREATED` - New result submitted
- `RESULT_APPROVED` - Result approved for broadcast
- `RESULT_REJECTED` - Result rejected
- `RESULT_RETRACTED` - Result removed from broadcast

## Build & Deploy

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## License

MIT
