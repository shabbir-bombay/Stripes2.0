# Stripes

Campus cart rides for University of the Pacific: students request a ride between campus stops, drivers claim and complete it, and admins run the service.

One Next.js app serves both the pages and the API (`app/api`). The database is Postgres, accessed through Prisma.

## Run it locally

You need Node 22.18 or newer and Postgres 16 (on a Mac: `brew install postgresql@16`).

```sh
npm install
createdb stripes_app
cp .env.example .env    # then put your Mac user name in DATABASE_URL and a random AUTH_SECRET
npm run db:migrate      # create the tables
npm run db:seed         # sample accounts, carts and stops
npm run dev             # http://localhost:3000
npm test
```

The seed creates `admin@pacific.edu`, `driver1@pacific.edu`, `driver2@pacific.edu` and `student@u.pacific.edu`, all with the password `stripes-dev`, plus 2 carts and 20 campus stops.

## Database

`prisma/schema.prisma` holds the tables: User, DriverProfile, Cart, Stop, Ride, ServiceRule and Service (the admin's on / off / automatic switch). The first migration also adds rules the database enforces itself:
- emails must end in `@pacific.edu` or `@u.pacific.edu`;
- a student has at most one active ride;
- a ride's pickup and drop-off are different stops.

To change the schema, edit `schema.prisma` and run `npm run db:migrate -- --name what-changed`.

## Who owns what

| Backend (Shabbir Murtaza) | Frontend (Khaled Omar) |
|---|---|
| `app/api/`, `lib/server/`, `prisma/` | `app/student/`, `app/driver/`, `app/admin/` |
| `API.md`, `lib/types.ts` | `app/sign-in/`, `app/sign-up/`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css` |
| CI, `Dockerfile`, config files | `components/`, `lib/mocks.ts`, `public/` |

[`API.md`](API.md) and `lib/types.ts` are the contract between the two sides. Change them only when both people agree.

## Deploying to AWS

Nothing in the code is tied to a provider. The app needs two settings: `DATABASE_URL`, and `AUTH_SECRET`, a random string of at least 32 characters (`openssl rand -base64 32`) that signs the session cookie.

1. Create an RDS Postgres 16 database.
2. Run `DATABASE_URL=<rds url>?sslmode=require npm run db:deploy` once, and again after every new migration. Run `npm run db:seed` too if you want the sample data; set `SEED_PASSWORD` first so the accounts don't use the public default.
3. Run the image built from `Dockerfile` on any AWS container host (ECS, App Runner, Lightsail), with `DATABASE_URL` and `AUTH_SECRET` set on the container. Serve it over HTTPS: in production the session cookie is only sent over secure connections.

The app listens on port 3000, and `GET /api/health` returns `{"status":"ok"}` for health checks.
