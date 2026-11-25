# Project Pulse

A collaborative project management platform with a live Kanban board. When one teammate moves a card, everyone else sees it move, with no refresh.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite | Fast dev loop, component model suits a stateful board |
| Styling | Tailwind CSS 3 | Consistent design tokens, responsive utilities |
| Drag and drop | dnd-kit | Accessible (keyboard + touch), headless, supports multi-column sorting |
| Backend | Node.js + Express 4 | Small, explicit REST API |
| Database | PostgreSQL | Relational integrity for users, projects, members, tasks |
| Real time | Socket.IO | Rooms per project, automatic reconnection |
| Auth | JWT + bcrypt | Stateless API auth, salted password hashes (cost 12) |
| Validation | Zod | One schema per request, field-level error messages |

## Architecture

```
client/  React SPA                        server/  Express API + Socket.IO
  pages/        route-level screens         routes/       auth, projects, members, tasks, comments, dashboard
  components/   board, project, ui          middleware/   requireAuth, projectAccess, ownerOnly, errors
  hooks/        useProjectSocket            services/     shared task SQL
  context/      auth, toasts                realtime/     socket auth, rooms, presence
  lib/          api client, socket          utils/        zod schemas, stats maths, activity log
                                            db/           schema.sql, migrate, seed
```

**Authorization is enforced on the server.** `requireAuth` validates the JWT on every request. `projectAccess` checks membership for every `/projects/:projectId/*` route and returns `404` to non-members, so other teams' projects are never revealed. `ownerOnly` guards project settings and member management. Task deletion is limited to the owner or the task's creator. Sockets must present the same JWT and are re-checked against `project_members` before joining a project room.

**Data model:** `users`, `projects`, `project_members (role: owner | member)`, `tasks`, `comments`, `activities`. See `server/src/db/schema.sql`.

## How real time works

1. Opening a project emits `project:join`. The server verifies membership and adds the socket to the room `project:<id>`.
2. Every REST mutation writes to PostgreSQL first, then broadcasts to that room (`tasks:upsert`, `task:deleted`, `comment:created`, `activity:created`, `member:added/removed`, `project:updated/deleted`).
3. Clients apply events idempotently (upsert by id), so a user's own echoed event is harmless.
4. If a connection drops, the client rejoins and refetches the project so nothing is missed.
5. Presence ("who is online") is derived from the sockets in each room.

## How drag and drop reaches the database

1. dnd-kit moves the card between columns locally while dragging.
2. On drop, the board reports `(taskId, status, index)` and the UI updates optimistically.
3. `PATCH /api/projects/:id/tasks/:taskId/move` runs in one transaction: it locks the rows, inserts the task at `index`, renumbers positions in the destination column, closes the gap in the source column, and returns the affected tasks.
4. The server broadcasts those tasks so every client converges on the same order. If the request fails, the client refetches the authoritative state and shows an error.

## Setup

Requirements: Node 18+, PostgreSQL 13+ (or Docker).

```bash
# 1. Install dependencies
npm run install:all

# 2. Start PostgreSQL (skip if you already have one)
npm run db:up

# 3. Configure environment
cp server/.env.example server/.env      # set JWT_SECRET to a long random string
cp client/.env.example client/.env      # optional in development

# 4. Create tables and (optionally) demo data
npm run migrate
npm run seed        # alice@example.com / bob@example.com, password: Password123

# 5. Run (two terminals)
npm run dev:server  # http://localhost:4000
npm run dev:client  # http://localhost:5173
```

To try collaboration, sign in as Alice in one browser and Bob in a private window, open "Product Launch", and drag a card.

### Environment variables

| File | Variable | Purpose |
|---|---|---|
| `server/.env` | `DATABASE_URL` | PostgreSQL connection string |
| | `JWT_SECRET` | Signing key for tokens (required) |
| | `CLIENT_URL` | Allowed CORS / Socket.IO origin |
| | `PORT` | API port (default 4000) |
| `client/.env` | `VITE_API_URL`, `VITE_SOCKET_URL` | Only needed when the API is on another origin (production) |

### Tests

```bash
npm test
```

- `stats.test.js`: unit tests for dashboard maths (completion %, overdue, workload).
- `api.test.js`: integration test of the Alice/Bob workflow against a real database (needs `DATABASE_URL`; it is skipped otherwise). Covers auth, validation, owner-only actions, non-member 404s, assignee validation, drag-and-drop persistence, comments, activity, filters and stats. It cleans up the users it creates.

## Features

**Mandatory:** registration/login/logout, bcrypt hashing, JWT-protected API; project CRUD, add members by email, owner/member roles; Kanban board with drag and drop persisted to PostgreSQL; task CRUD with assignee, priority, due date, created/updated timestamps; real-time sync across sessions; comments and chronological activity history; dashboard with totals, status breakdown, completion %, overdue counts and per-project progress; search plus status/priority/assignee filters with empty states; responsive layout, form validation, loading and error states.

**Extras:** drag-and-drop ordering within columns, online presence, live comment updates, keyboard- and touch-accessible dragging, optimistic UI with rollback, per-member workload chart, safe project deletion (type the name to confirm), removing a member unassigns their tasks and disconnects their live session, rate limiting on auth routes, Helmet headers, seed data and Docker Compose.

## Known limitations

- The JWT is stored in `localStorage` (simple and works with Socket.IO). HttpOnly cookies would be stronger against XSS.
- Concurrent edits to the same field are last-write-wins. The edit form only sends fields the user changed, which reduces clobbering.
- Dragging is paused while filters are active, because card indices only make sense on the full column.
- Overdue is computed against the server's UTC date.
- No email invitations: only existing registered users can be added.
- Client-side automated tests (component and end-to-end) are not included.

## Future improvements

Customizable columns, in-app notifications and @mentions, file attachments, subtasks and labels, calendar view, Playwright end-to-end tests with two browser contexts, CI pipeline, Redis adapter for horizontal Socket.IO scaling, refresh-token rotation with HttpOnly cookies.

## Submission notes

- **AI tools used:** _(fill in before submitting: which assistants you used and for which parts)_
- Be ready to explain the move transaction in `server/src/routes/tasks.js` and the board state handling in `client/src/components/board/Board.jsx`; they are the heart of the project.
