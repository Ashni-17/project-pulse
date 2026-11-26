
# Project Pulse

### Plan. Collaborate. Deliver.

An AI-powered, real-time collaborative project management platform designed to help teams organize tasks, manage workloads, track progress and collaborate efficiently through a shared workspace.

![React](https://img.shields.io/badge/React-Frontend-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?logo=nodedotjs)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--time-010101?logo=socketdotio)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss)
![Gemini](https://img.shields.io/badge/Gemini-AI-4285F4?logo=google)
![Tests](https://img.shields.io/badge/Tests-55%2F55%20Passed-brightgreen)

---

## Project Overview

Project Pulse brings project planning, task management, team collaboration, progress analytics and AI-assisted decision-making into a single responsive application.

Unlike traditional task management systems that require frequent page refreshes, Project Pulse uses WebSocket-based communication to synchronize project changes across connected team members in real time.

### Project Objectives

- Simplify project planning and task organization.
- Enable seamless real-time team collaboration.
- Provide meaningful insights into project progress.
- Improve productivity through intelligent AI recommendations.
- Protect project data through authentication and role-based authorization.
- Maintain human control over AI-generated actions.

---

## Project Links

| Resource | Status |
|---|---|
| Source Code | [GitHub Repository](https://github.com/Ashni-17/project-pulse) |
| Live Application | Deployment pending |
| Demo Video | Recording pending |
| Automated Tests | 55/55 passed |

---

## Core Features

### 1. Authentication and Account Security

- User registration with email OTP verification.
- Secure login and logout.
- Google OAuth authentication.
- Forgot password and OTP-based password recovery.
- Password hashing using bcrypt.
- JWT-based authentication.
- Protected frontend routes and backend APIs.
- Session invalidation after password reset.
- Real-time disconnection of invalidated sessions.

### 2. Project and Team Management

- Create, view, update and delete projects.
- Add existing registered users through email.
- Owner and member role-based permissions.
- Team member management.
- Online presence indicators.
- Confirmation before project deletion.
- Automatic task unassignment when a member is removed.

### 3. Interactive Kanban Board

Organize tasks across three workflow stages:

- To do
- In progress
- Done

Features include:

- Drag and drop between columns.
- Task reordering within columns.
- Persistent task positions in PostgreSQL.
- Optimistic UI updates.
- Real-time synchronization across connected users.
- Keyboard and touch drag-and-drop support.

### 4. Task Management

- Create, edit and delete tasks.
- Task titles and descriptions.
- Low, medium and high priorities.
- Team member assignments.
- Due dates and overdue indicators.
- Task creation and update timestamps.
- Search by task title.
- Filter by status, priority and assignee.
- Version-based concurrent editing protection.

### 5. Real-time Collaboration

- Live task creation and updates.
- Live Kanban movement.
- Real-time comments.
- Project activity synchronization.
- Online member presence.
- Automatic reconnection and project resynchronization.

### 6. Comments and Activity History

- Task-specific discussions.
- Comment author information and timestamps.
- Live comment updates.
- Chronological project activity timeline.
- Tracking of task creation, updates, deletion and status changes.
- Tracking of project and membership changes.

### 7. Dashboard and Project Analytics

- Total projects and tasks.
- Completed and pending tasks.
- Status distribution.
- Priority distribution.
- Overdue task tracking.
- Project completion percentage.
- Individual project progress.
- Team workload visualization.

### 8. Responsive User Interface

- Modern green-themed workspace.
- Responsive authentication screens.
- Adaptive sidebar navigation.
- Interactive dashboard.
- Responsive project headers and task forms.
- Horizontally scrollable Kanban board on smaller screens.
- Loading, empty, success and error states.
- Mobile, tablet, landscape and desktop browser verification.

---

## Pulse AI — Intelligent Project Assistant

Pulse AI integrates Google Gemini into the project workspace to support intelligent planning and decision-making.

### AI Modules

| Module | Functionality |
|---|---|
| Smart Planner | Generates structured tasks from project descriptions, natural language instructions and meeting notes |
| Project Intelligence | Provides project summaries, progress insights, risk identification and priority recommendations |
| Smart Assignment | Recommends task assignments using project membership and workload information |
| Ask Pulse AI | Answers project-related questions using available project context |

### Smart Planner

- Generate tasks from project requirements.
- Convert natural language instructions into structured tasks.
- Extract actionable tasks from meeting notes.
- Suggest priorities, deadlines and assignees.
- Review and edit generated tasks.
- Select individual suggestions before saving.
- Prevent duplicate task suggestions.

### Project Intelligence

- Analyze project progress.
- Identify pending and overdue tasks.
- Highlight project risks.
- Generate productivity recommendations.
- Suggest task priority changes.
- Allow users to approve recommendations individually.

### Smart Assignment

- Analyze team member workloads.
- Recommend suitable task assignees.
- Compare current and projected workload.
- Validate recommended members against project membership.
- Apply recommendations only after user approval.

### Ask Pulse AI

- Ask questions about the current project.
- Retrieve relevant task information.
- Understand project progress and pending work.
- Identify tasks requiring attention.
- View related tasks and suggested actions.
- Maintain conversation history within the active workspace.

### Responsible AI Design

Pulse AI is an advisory system, not an autonomous project administrator.

- AI-generated tasks are reviewed before creation.
- Assignment and priority changes require explicit approval.
- Generated responses are validated using Zod schemas.
- Unknown task and member identifiers are filtered.
- Duplicate suggestions are filtered.
- Stale recommendations are detected using task version information.
- AI endpoints enforce project membership.
- API keys remain on the backend.
- Rate limiting and request concurrency controls are implemented.
- Fallback model support handles temporary service failures.
- Timeout and malformed response handling provide controlled errors.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 | Component-based user interface |
| Build Tool | Vite | Development server and production builds |
| Styling | Tailwind CSS 3 | Responsive styling and design system |
| Icons | Lucide React | Interface icons |
| Routing | React Router | Client-side navigation |
| Drag and Drop | dnd-kit | Interactive Kanban management |
| Backend | Node.js and Express | REST API and business logic |
| Database | PostgreSQL | Relational data storage |
| Database Driver | pg | PostgreSQL connectivity and transactions |
| Real-time | Socket.IO | Live project synchronization |
| Authentication | JWT | Authenticated API and socket sessions |
| Password Security | bcrypt | Password hashing |
| Email | Nodemailer | OTP verification and password recovery |
| OAuth | Google Auth Library | Google authentication |
| Artificial Intelligence | Google Gemini | Intelligent project assistance |
| Validation | Zod | Request and AI response validation |
| Testing | Vitest and Supertest | Automated unit and integration testing |
| Version Control | Git and GitHub | Source code management |

---

## System Architecture

```mermaid
flowchart TD
    U[Project Members] --> F[React Frontend]
    F -->|HTTP REST API| B[Express Backend]
    F <-->|Socket.IO| S[Real-time Server]

    B --> A[Authentication and Authorization]
    A --> P[Project and Task Services]

    P --> D[(PostgreSQL Database)]
    P --> S

    B --> AI[Pulse AI Service]
    AI --> D
    AI --> G[Google Gemini API]

    B --> E[Email OTP Service]
    E --> SMTP[SMTP Provider]

    B --> O[Google OAuth]
    S --> D
```

### Architecture Explanation

The React frontend communicates with the Express backend through REST APIs.

The backend validates requests, authenticates users, checks project permissions and executes database operations using PostgreSQL.

After successful project mutations, Socket.IO broadcasts relevant updates to authorized project members.

The Pulse AI service collects project context, requests structured responses from Gemini and validates the generated recommendations before returning them to the frontend.

---

## Project Structure

```text
project-pulse/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ai/
│   │   │   ├── board/
│   │   │   ├── project/
│   │   │   └── ui/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── pages/
│   ├── .env.example
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── realtime/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── tests/
│   ├── .env.example
│   └── package.json
│
├── .gitignore
├── docker-compose.yml
├── package.json
└── README.md
```

---

## Database Design

PostgreSQL is used to maintain relational integrity between users, projects, members, tasks, comments and activities.

### Core Entities

| Entity | Responsibility |
|---|---|
| users | User accounts and authentication information |
| projects | Project details and ownership |
| project_members | Project membership and roles |
| tasks | Task information, assignments, positions and versions |
| comments | Task discussions |
| activities | Project activity history |

Additional authentication tables support pending registrations, password recovery and Google OAuth sessions.

### Entity Relationships

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    USERS ||--o{ PROJECT_MEMBERS : joins
    PROJECTS ||--o{ PROJECT_MEMBERS : contains
    PROJECTS ||--o{ TASKS : contains
    USERS o|--o{ TASKS : assigned
    TASKS ||--o{ COMMENTS : receives
    USERS o|--o{ COMMENTS : writes
    PROJECTS ||--o{ ACTIVITIES : records
    TASKS o|--o{ ACTIVITIES : relates
    USERS o|--o{ ACTIVITIES : performs
```

The complete database schema is available in:

`server/src/db/schema.sql`

---

## How Real-time Collaboration Works

1. A user opens a project workspace.
2. The client emits a `project:join` event.
3. The server validates the JWT and project membership.
4. The socket joins the corresponding project room.
5. A user creates, updates or moves a task.
6. The backend persists the operation in PostgreSQL.
7. Socket.IO broadcasts the resulting changes.
8. Connected clients update their local state without refreshing.

### Real-time Events

| Event | Purpose |
|---|---|
| project:join | Join an authorized project room |
| tasks:upsert | Create or update task state |
| task:deleted | Remove a deleted task |
| comment:created | Synchronize new comments |
| activity:created | Synchronize activity history |
| member:added | Update project membership |
| member:removed | Remove project membership |
| project:updated | Synchronize project details |
| project:deleted | Handle project deletion |
| project:refresh | Request project resynchronization |

Clients merge incoming task updates by identifier, reducing duplicate state entries.

When a connection is restored, the client rejoins the project and refetches the current state.

---

## Drag-and-Drop Implementation

The Kanban board uses dnd-kit to support interactive task movement and reordering.

### Workflow

1. The user drags a task to a new position.
2. The frontend updates the board optimistically.
3. The task ID, destination status and position are sent to the backend.
4. PostgreSQL transactions update the task and affected positions.
5. The backend returns the updated tasks.
6. Socket.IO broadcasts the changes to connected project members.
7. If the request fails, the client reloads the authoritative project state.

### API Endpoint

```http
PATCH /api/projects/:projectId/tasks/:taskId/move
```

Example request:

```json
{
  "status": "in_progress",
  "index": 0
}
```

Dragging is intentionally disabled while filters are active because filtered card positions do not represent the complete column ordering.

---

## Authentication and Authorization

Authorization is enforced on the backend rather than relying only on frontend visibility.

### Security Measures

- bcrypt password hashing with cost factor 12.
- JWT validation for protected APIs.
- Email OTP expiration and attempt limits.
- Password recovery token validation.
- Google OAuth state, nonce and PKCE verification.
- Server-side project membership checks.
- Owner-only project administration.
- Task deletion restricted to the project owner or task creator.
- Socket authentication and membership validation.
- Session invalidation following password changes.
- Rate limiting and Helmet security headers.
- Zod request validation.
- Environment-based secret management.

### Role Permissions

| Action | Owner | Member |
|---|---|---|
| View project | Yes | Yes |
| Create tasks | Yes | Yes |
| Edit tasks | Yes | Yes |
| Move tasks | Yes | Yes |
| Add comments | Yes | Yes |
| Access project AI | Yes | Yes |
| Manage members | Yes | No |
| Edit project settings | Yes | No |
| Delete project | Yes | No |
| Delete any task | Yes | No |
| Delete own created tasks | Yes | Yes |

Unauthorized project access returns a controlled error without exposing project details.

---

## Concurrent Editing Protection

Project Pulse uses task versioning to reduce accidental overwrites when multiple users edit the same task.

- Each task contains a version number.
- Meaningful task changes increment the version.
- Edit requests can include an expected version.
- The backend compares the expected version against the stored version.
- Stale requests receive an HTTP 409 Conflict response.
- The frontend detects stale editing and AI recommendation states.

This mechanism protects supported task update operations. Drag-and-drop and deletion do not currently enforce the same expected-version check.

---

## Local Installation

### Prerequisites

- Node.js 22.14.0 or a compatible supported version.
- npm.
- PostgreSQL.
- Git.
- SMTP credentials for email authentication features.
- Google OAuth credentials for Google sign-in.
- Gemini API key for Pulse AI.

The project was developed using Node.js 22.14.0 and PostgreSQL 19.

### 1. Clone the Repository

```bash
git clone https://github.com/Ashni-17/project-pulse.git
cd project-pulse
```

### 2. Install Dependencies

```bash
npm run install:all
```

Alternatively, install dependencies separately:

```bash
cd server
npm install

cd ../client
npm install

cd ..
```

### 3. Configure PostgreSQL

Create a database named:

```text
project_pulse
```

Alternatively, use the provided Docker Compose configuration:

```bash
npm run db:up
```

### 4. Configure Environment Variables

For Windows PowerShell:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

For Linux or macOS:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Update the environment files with your own configuration.

### Backend Environment Variables

| Variable | Description |
|---|---|
| PORT | Backend port |
| NODE_ENV | Application environment |
| DATABASE_URL | PostgreSQL connection string |
| JWT_SECRET | Secure JWT signing secret |
| CLIENT_URL | Frontend origin |
| SERVER_URL | Backend origin |
| SMTP_HOST | SMTP server hostname |
| SMTP_PORT | SMTP server port |
| SMTP_SECURE | SMTP secure connection setting |
| SMTP_USER | Email service username |
| SMTP_PASS | Email service password |
| SMTP_FROM | Sender email identity |
| GOOGLE_CLIENT_ID | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret |
| GOOGLE_CALLBACK_URL | Google OAuth callback URL |
| GEMINI_API_KEY | Google Gemini API key |
| GEMINI_MODEL | Primary AI model |
| GEMINI_FALLBACK_MODEL | Fallback AI model |
| GEMINI_TIMEOUT_MS | AI request timeout configuration |

Example local configuration:

```env
PORT=4000
NODE_ENV=development

DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/project_pulse
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET

CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:4000

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=YOUR_EMAIL
SMTP_PASS=YOUR_APP_PASSWORD
SMTP_FROM=YOUR_EMAIL

GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback

GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite
GEMINI_TIMEOUT_MS=15000
```

Use the actual PostgreSQL port configured on your machine. Model availability depends on the Gemini API account and provider configuration.

Never commit real credentials or `.env` files to GitHub.

### Frontend Environment Variables

```env
VITE_API_URL=
VITE_SOCKET_URL=
```

Leave these empty during local development to use the Vite proxy.

For production, configure the deployed API base URL and Socket.IO server origin.

### 5. Run Database Migrations

From the project root:

```bash
npm run migrate
```

### 6. Seed Demo Data

```bash
npm run seed
```

Local demonstration accounts:

| Account | Email | Password |
|---|---|---|
| Alice Carter | alice@example.com | Password123 |
| Bob Mehta | bob@example.com | Password123 |

These are development demonstration credentials only. Do not reuse them for privileged production accounts.

### 7. Start the Backend

Open the first terminal:

```bash
npm run dev:server
```

Backend:

`http://localhost:4000`

Health check:

`http://localhost:4000/api/health`

### 8. Start the Frontend

Open the second terminal:

```bash
npm run dev:client
```

Frontend:

`http://localhost:5173`

---

## Testing and Quality Assurance

The backend uses Vitest and Supertest for automated unit, integration, authentication, real-time and AI service testing.

### Automated Test Results

Latest verified local run: November 26, 2026.

| Test Suite | Passed | Failed |
|---|---:|---:|
| Backend API | 10 | 0 |
| Socket.IO Security | 8 | 0 |
| AI Routes | 13 | 0 |
| AI Service | 20 | 0 |
| Statistics | 4 | 0 |
| Total | 55 | 0 |

**Test files:** 5/5 passed

**Test execution duration:** 19.41 seconds

### Running Tests

Create a separate PostgreSQL database named:

```text
project_pulse_test
```

Configure `DATABASE_URL` to point to the test database before running migrations and tests.

From the server directory:

```bash
npm run migrate
npm test
```

Do not run database integration tests against production data.

### AI Testing

The AI service tests use mocked model responses to verify:

- Duplicate task filtering.
- Assignee validation.
- Structured response validation.
- Invalid JSON handling.
- Invalid priority and deadline handling.
- Workload balancing.
- Fallback model behavior.
- Rate limit handling.
- Temporary service retries.
- Request timeout handling.

### Manual Browser Testing

- Authentication workflows.
- Project and task management.
- Drag-and-drop persistence.
- Real-time synchronization.
- Comments and activity history.
- Search and filtering.
- AI-assisted project management.
- Concurrent task editing.
- Mobile, tablet and desktop layouts.

### Production Build Verification

```bash
cd client
npm run build
```

Latest local build:

| Metric | Result |
|---|---|
| Build status | Successful |
| Modules transformed | 1,636 |
| JavaScript gzip size | 137.53 KB |
| CSS gzip size | 9.76 KB |
| Build duration | 30.14 seconds |

### Dependency Audit

Both frontend and backend reported zero known vulnerabilities during the final npm audit on November 26, 2026.

This does not constitute a comprehensive application security audit.

---

## Application Screenshots

### 1. Login
![Login](docs/screenshots/01-login.png)

### 2. Registration
![Registration](docs/screenshots/02-register.png)

### 3. Dashboard
![Dashboard](docs/screenshots/03-dashboard.png)

### 4. Kanban Board
![Kanban Board](docs/screenshots/04-kanban.png)

### 5. Task Details and Comments
![Task Details](docs/screenshots/05-task-details.png)

### 6. Project Overview and Analytics
![Project Overview](docs/screenshots/06-project-overview.png)

### 7. Activity Timeline
![Activity](docs/screenshots/07-activity.png)

### 8. Team Members
![Members](docs/screenshots/08-members.png)

### 9. Pulse AI — Smart Planner
![Smart Planner](docs/screenshots/09-smart-planner.png)

### 10. Pulse AI — Project Intelligence
![Project Intelligence](docs/screenshots/10-project-intelligence.png)

### 11. Pulse AI — Smart Assignment
![Smart Assignment](docs/screenshots/11-smart-assignment.png)

### 12. Pulse AI — Ask Pulse AI
![Ask Pulse AI](docs/screenshots/12-ask-pulse-ai.png)

### 13. Mobile Responsive View
<img src="docs/screenshots/13-mobile-view.png" alt="Mobile Responsive View" width="350"/>

---

## Technical Challenges and Solutions

| Challenge | Implemented Solution |
|---|---|
| Real-time state synchronization | Socket.IO project rooms and identifier-based state merging |
| Persistent task ordering | PostgreSQL transactions and position updates |
| Unauthorized project access | Server-side membership and role checks |
| Concurrent task editing | Task versions and conflict detection |
| AI-generated invalid data | Structured output validation and identifier filtering |
| AI provider failures | Fallback models, retry logic and timeout handling |
| Unbalanced task assignments | Workload-aware recommendation validation |
| Password recovery security | Expiring OTPs, reset tokens and session invalidation |
| Responsive Kanban layout | Adaptive headers and scrollable task columns |
| Accidental AI modifications | Explicit review and approval workflows |

---

## Deployment

Deployment is currently pending.

The planned production architecture consists of:

- A hosted React frontend.
- A hosted Express and Socket.IO backend.
- A managed PostgreSQL database.
- Secure environment variables for SMTP, OAuth and Gemini.
- HTTPS-enabled communication.

Live application and demonstration links will be updated after successful deployment and verification.

---

## Known Limitations

- JWT access tokens are stored in localStorage; HttpOnly cookie-based authentication could provide stronger protection against token theft through XSS.
- Expected-version conflict protection is implemented for supported task edits, but not all mutation operations.
- AI recommendations may contain inaccurate explanations and require human review.
- AI workload projections may become outdated when project data changes.
- AI availability depends on provider quotas and service availability.
- Dragging is disabled while filters are active.
- Overdue calculations use the server's UTC date.
- Team members must already have registered accounts.
- Automated frontend component and end-to-end tests are not included.
- Responsive verification was performed using browser emulation rather than a physical-device test matrix.
- Production OAuth, SMTP and live service connectivity require deployment verification.

---

## Future Enhancements

- Customizable Kanban columns.
- Subtasks, labels and file attachments.
- Calendar and timeline views.
- In-app notifications and mentions.
- Email-based project invitations.
- Advanced AI productivity analytics.
- Automated frontend and end-to-end testing.
- Continuous integration and deployment pipelines.
- Redis-backed Socket.IO scaling.
- Refresh-token rotation and HttpOnly cookie-based authentication.
- Extended concurrency protection across all task mutations.

---

##  AI Usage Disclosure

ChatGPT was used as an AI-assisted development tool during project planning, implementation guidance, code generation, debugging, UI improvements, test development and documentation.

Generated code and recommendations were integrated into the local development workflow, with manual browser testing and automated backend verification.

Google Gemini is integrated into the application itself to provide Pulse AI features.

The project follows a human-controlled approach in which AI-generated recommendations require user review and approval before modifying project data.

---

## Developer

**Ashni Reffin R**

B.Tech Information Technology

Panimalar Engineering College

GitHub: [Ashni-17](https://github.com/Ashni-17)

---

### Project Pulse

**Plan smarter. Collaborate seamlessly. Deliver confidently.**


