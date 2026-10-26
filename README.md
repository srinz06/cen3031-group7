# cen3031-group7

Goal Sync uses React/Vite, Express, Prisma, and PostgreSQL.

## Local setup

Run commands from the repository root. Install dependencies in each package:

```powershell
npm install
npm --prefix frontend install
```

If `backend/.env` does not exist, copy `backend/.env.example` to it. Set
`DATABASE_URL` to your team's development PostgreSQL connection string, then run:

```powershell
npm --prefix backend install
```

## Database setup

The Prisma schema is in `backend/src/prisma/schema.prisma`. This implementation
covers the Project part of the team's diagram and its relationship to User:

| Model | Fields and relationships |
| --- | --- |
| User | Existing UUID `id`, name, email, password hash, role, and `createdAt` (registration date). Owns projects. |
| Project | UUID `id`, name, description, goal, optional `targetDate`, creation timestamp, and `ownerId` referencing User. |

Target dates are PostgreSQL `DATE` values, with no time of day. UUIDs are generated
by Prisma. The owner foreign key prevents orphan projects; removing a user who
owns projects is restricted.

Two SQL migrations are included in `backend/migrations/sql`: `0_init` represents the existing User table;
`20261026000000_add_projects` adds the Project table without changing User.
The older `migrations/app` and `migrations/snapshots` files are preserved historical
artifacts; they are not SQL migrations and describe an older integer User ID.

### Existing development database with user accounts

One teammate should perform this setup for a shared database. First inspect the
migration history:

```powershell
npm --prefix backend run db:status
```

If the User table exists but there is no SQL migration history yet, confirm it
matches the baseline:

```powershell
npm --prefix backend run db:baseline:check
```

Only if that reports **no difference**, mark the existing User table as already
created. This records the baseline without recreating the table:

```powershell
npm --prefix backend run db:baseline
```

If the baseline check reports differences or cannot connect, resolve that before
baselining. In particular, an integer User ID does not match the UUID schema.
If migration history already exists, review it with the team rather than marking
an unrelated migration as applied.

Then apply pending migrations:

```powershell
npm --prefix backend run db:migrate
npm --prefix backend run generate
```

For subsequent checkouts against that same database, skip the baseline commands;
run `db:migrate` and `generate`.

### New, empty database

Do not mark a baseline as applied. Apply both migrations to create all tables:

```powershell
npm --prefix backend run db:migrate
npm --prefix backend run generate
```

### Run and verify

```powershell
npm run dev
```

Open http://localhost:5173. Backend health: http://localhost:3001/api/health.
After applying migrations, log in, choose **Create project**, fill out the form,
and submit. The saved project appears on Home and remains after refreshing.
To inspect database records, run `npm --prefix backend run db:studio`.

## Project creation flow

1. The form sends `POST /api/projects` with name, description, goal, and an optional
   `YYYY-MM-DD` target date. The browser includes the login session cookie.
2. Express requires authentication and validates types, lengths, and calendar
   dates. Only name is required. The server derives `ownerId` from the session;
   clients cannot select another owner.
3. Prisma inserts the Project record and returns HTTP 201. The page returns to
   Home, which calls `GET /api/projects` to load projects owned by the current user.

Tasks, friendships, and collaborators are outside this implementation. Project
creation saves only the project's details and its owner relationship.

## Checks

```powershell
npm --prefix backend test
npm --prefix backend run typecheck
npm --prefix frontend run build
```
