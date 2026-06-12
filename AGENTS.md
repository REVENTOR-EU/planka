# AGENTS.md - Planka Project Guide

## Project Overview

Planka is an open-source Kanban board application (v2.1.1). It uses a monorepo structure with a Sails.js server and a React client.

## Architecture

```
planka/
├── server/          # Sails.js backend (Node.js >=20)
│   ├── api/
│   │   ├── controllers/   # Request handlers (REST actions)
│   │   ├── helpers/       # Business logic (reusable service layer)
│   │   ├── hooks/         # Custom Sails hooks
│   │   ├── models/        # Waterline ORM model definitions
│   │   ├── policies/      # Auth/permission middleware
│   │   └── responses/     # Custom HTTP response helpers
│   ├── config/
│   │   ├── routes.js      # All API route definitions
│   │   ├── policies.js    # Policy mapping
│   │   └── sockets.js     # Socket.io config
│   ├── db/
│   │   ├── migrations/    # Knex migrations (PostgreSQL)
│   │   ├── seeds/
│   │   └── knexfile.js
│   └── utils/
│       ├── validators.js  # Custom validators (isStopwatch, isDueDate, etc.)
│       └── inputs.js      # Shared input definitions
├── client/          # React frontend (Vite)
│   └── src/
│       ├── actions/        # Redux action creators
│       ├── api/            # Socket.io API layer
│       ├── components/     # React components
│       ├── constants/      # Enums, action types
│       ├── contexts/       # React contexts
│       ├── entry-actions/  # Entry-point action creators
│       ├── hooks/          # Custom React hooks
│       ├── lib/            # Utility libraries (custom UI, popup)
│       ├── models/         # redux-orm model definitions
│       ├── reducers/       # Redux reducers
│       ├── sagas/          # redux-saga (core services + watchers)
│       ├── selectors/      # Reselect selectors
│       └── utils/          # Utility functions
├── charts/          # Helm charts (Kubernetes)
└── docker-compose.yml
```

## Data Hierarchy

```
Project -> Board -> List -> Card
                     |        |
                     |        ├── TaskList -> Task
                     |        ├── Comment
                     |        ├── Action (activity log)
                     |        ├── CardMembership -> User
                     |        ├── CardSubscription -> User
                     |        ├── Attachment
                     |        ├── CustomFieldValue
                     |        └── CardLabel -> Label
                     |
                     └── List types: active, closed, archive, trash
```

## Tech Stack

### Server
- **Framework**: Sails.js v1.5.17
- **ORM**: Waterline (via sails-hook-orm v4.0.3) with `sails-postgresql` v5.0.1
- **Database**: PostgreSQL (migrations via Knex v3.1.0 + pg v8.20.0)
- **Auth**: JWT (jsonwebtoken v9.0.3), bcrypt, OIDC support
- **Real-time**: sails-hook-sockets v3.0.2 (Socket.io)
- **Linting**: ESLint with airbnb-base + prettier
- **Testing**: Mocha + Chai + Supertest

### Client
- **Framework**: React 18.2.0
- **Build**: Vite v7.3.2
- **State**: Redux v5.0.1 + redux-orm v0.16.2 + redux-saga v1.4.2 + reselect v5.1.1
- **UI**: Semantic UI React v2.1.5
- **Drag & Drop**: react-beautiful-dnd v13.1.1
- **Real-time**: sails.io.js + socket.io-client
- **i18n**: i18next v25.8.18
- **Dates**: date-fns v4.1.0
- **CSV**: papaparse v5.5.3 (available for export)
- **Linting**: ESLint with airbnb + prettier
- **Testing**: Jest + Playwright (acceptance)

## Code Conventions

### Server Patterns

**Controllers** (`server/api/controllers/<resource>/<action>.js`):
- Define `inputs` (validation), `exits` (error types), and `fn` (handler)
- Use `sails.helpers.<resource>.<action>` for business logic
- Access current user via `this.req.currentUser`
- Return `{ item }` or `{ items, included }` responses
- Check permissions via `BoardMembership.qm.getOneByBoardIdAndUserId()`

**Helpers** (`server/api/helpers/<resource>/<action>.js`):
- Core business logic, called from controllers
- Use `inputs`/`exits` pattern like controllers
- Broadcast changes via `sails.sockets.broadcast(`board:${boardId}`, 'cardUpdate', { item })`
- Send webhooks via `sails.helpers.utils.sendWebhooks.with({...})`
- Create activity actions via `sails.helpers.actions.createOne.with({...})`

**Models** (`server/api/models/<Model>.js`):
- Waterline attribute definitions with `type`, `required`, `allowNull`, `columnName`
- Use Query Manager pattern: `Model.qm.getOneById()`, `Model.qm.getByBoardId()`
- ID generation: Snowflake-like IDs via `next_id()` PostgreSQL function
- Foreign keys use `model: 'TargetModel'` or `collection/via/through` for many-to-many

**Database Migrations** (`server/db/migrations/`):
- Knex-based, named with timestamp prefix: `YYYYMMDDHHMMSS_description.js`
- Use `next_id()` for primary keys
- Always create both `up` and `down` functions

**Route Definitions** (`server/config/routes.js`):
- Pattern: `'VERB /api/path/:param': 'controller/action'`
- All routes require authentication by default (configured in `policies.js`)

### Client Patterns

**Components** (`client/src/components/`):
- Functional components with `React.memo` for optimization
- PropTypes for type checking (no TypeScript)
- SCSS modules for styling (`*.module.scss`)
- Follow existing naming: `<ComponentName>/<ComponentName>.jsx`

**State Management**:
- Actions defined in `client/src/actions/` (simple objects with type + payload)
- Entry actions in `client/src/entry-actions/` (thunk-like, dispatch actions + call API)
- Sagas in `client/src/sagas/` for complex async flows
- Selectors in `client/src/selectors/` using reselect (memoized with `makeSelect*` factory pattern)
- Models in `client/src/models/` using redux-orm with `attr()`, `fk()`, `many()`

**API Layer** (`client/src/api/`):
- Socket.io-based API calls (not HTTP fetch)
- Transform functions to convert server data (e.g., ISO date strings to Date objects)
- Pattern: `socket.get(url)`, `socket.patch(url, data)`, `socket.post(url, data)`

**Real-time Updates**:
- Server broadcasts events like `cardUpdate`, `cardCreate`, `listUpdate`
- Client saga watcher in `sagas/core/watchers/socket.js` dispatches Redux actions
- All board subscribers receive updates via `board:${boardId}` socket rooms

### Naming Conventions
- **Server files**: kebab-case (`update-one.js`, `get-path-to-project-by-id.js`)
- **Client files**: PascalCase for components (`ActionsStep.jsx`), camelCase for utilities
- **Database columns**: snake_case (`board_id`, `list_changed_at`)
- **JavaScript variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **CSS classes**: camelCase in SCSS modules (`headerName`, `menuItem`)

## Common Tasks

### Adding a new API endpoint
1. Create migration if DB schema changes (`server/db/migrations/`)
2. Create/update model (`server/api/models/`)
3. Create helper (`server/api/helpers/<resource>/`)
4. Create controller (`server/api/controllers/<resource>/`)
5. Register route (`server/config/routes.js`)
6. Add policy if needed (`server/config/policies.js`)

### Adding a new client feature
1. Create Redux actions (`client/src/constants/ActionTypes.js`)
2. Add redux-orm model fields (`client/src/models/`)
3. Create selectors (`client/src/selectors/`)
4. Create entry actions (`client/src/entry-actions/`)
5. Create API layer (`client/src/api/`)
6. Create components (`client/src/components/`)
7. Add socket event handling (`client/src/sagas/core/watchers/socket.js`)

### Adding a database migration
```bash
# Create migration file manually in server/db/migrations/
# Use timestamp format: YYYYMMDDHHMMSS_description.js
# Run migration:
npm run server:db:migrate
```

## Key Commands

```bash
# Development
npm start                        # Start both server and client
npm run server:start             # Start server only (nodemon)
npm run client:start             # Start client only (Vite)

# Building
npm run server:build             # Build server
npm run client:build             # Build client

# Linting
npm run lint                     # Lint both server and client
npm run server:lint              # Lint server
npm run client:lint              # Lint client

# Testing
npm test                         # Run all tests
npm run server:test              # Server tests (Mocha)
npm run client:test              # Client tests (Jest)

# Database
npm run server:db:migrate        # Run migrations
npm run server:db:init           # Initialize database
npm run server:db:create-admin-user  # Create admin user
```

## Prettier Configuration

Both server and client use:
```json
{
  "printWidth": 100,
  "singleQuote": true,
  "trailingComma": "all"
}
```

## Important Notes

- The server uses `lodash` globally as `_` and `sails` globally (no imports needed)
- All IDs are big integers (snowflake-like), stored as strings in the client
- Cards have two types: `project` (with stopwatch) and `story`
- The stopwatch is a JSONB field: `{ startedAt: datetime|null, total: number (seconds) }`
- Lists of type `archive` and `trash` are auto-created per board and use cursor-based pagination
- Cards in archive/trash retain `prevListId` for restoration
- No existing export functionality exists in the codebase
- `papaparse` is available on the client side but not yet used for any export feature
