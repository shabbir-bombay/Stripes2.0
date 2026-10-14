# Stripes

Campus cart rides for University of the Pacific: students request a ride between campus stops, drivers claim and complete it, and admins run the service.

One Next.js app serves both the pages and the API (`app/api`). The database is Postgres, accessed through Prisma.

```sh
npm install
npm run dev     # http://localhost:3000
npm run build
```

## Who owns what

| Backend (Shabbir Murtaza) | Frontend (Khaled Omar) |
|---|---|
| `app/api/`, `lib/server/`, `prisma/` | `app/student/`, `app/driver/`, `app/admin/` |
| `API.md`, `lib/types.ts` | `app/sign-in/`, `app/sign-up/`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css` |
| CI, `Dockerfile`, config files | `components/`, `lib/mocks.ts`, `public/` |

`API.md` and `lib/types.ts` are the contract between the two sides. Change them only when both people agree.

## Deploying to AWS

`Dockerfile` builds the image that any AWS container host runs (ECS, App Runner, Lightsail). The app listens on port 3000, and `GET /api/health` returns `{"status":"ok"}` for health checks.
