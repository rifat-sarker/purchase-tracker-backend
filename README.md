# Gadget Purchase Tracker — Backend API

Node.js + Express + TypeScript + Prisma (PostgreSQL) + Redis backend for the Gadget Purchase Tracker. See `../purchase-tracker-frontend/gadget-purchase-tracker-spec.md` for the full product spec this implements.

## Stack

Express, Prisma/PostgreSQL, Redis (ioredis), JWT auth, Zod validation, bcrypt, node-cron, nodemailer, multer (local disk or Cloudinary), helmet, cors, express-rate-limit, winston/morgan, fast-csv.

## Getting started (local dev)

```bash
cp .env.example .env   # fill in secrets
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

The API listens on `PORT` (default 4000), mounted under `/api/v1`. `GET /health` is unversioned.

## Project layout

```
src/
├── app.ts / server.ts        # Express app wiring + graceful shutdown
├── config/                   # env loading/validation, Cloudinary config
├── lib/                      # Prisma + Redis singletons
├── modules/
│   ├── auth/                 # login/refresh/logout (single owner account)
│   ├── product/              # CRUD + DTO visibility + CSV export
│   ├── analytics/            # aggregation endpoints (owner-only)
│   ├── warranty/             # daily cron + email notification
│   └── health/               # DB/Redis health probe
├── middlewares/               # auth, validation, rate limiting, errors, uploads
├── storage/                   # pluggable local-disk / Cloudinary adapter
├── utils/                     # catchAsync, sendResponse, AppError, mailer, logger
└── routes/index.ts            # mounts all module routers under /api/v1
```

## Access control model

There is one dataset, not two. `attachUserIfPresent` runs on GET routes and sets `req.user` if a valid JWT is present (never throws). `requireAuth` runs on all mutation and analytics/export routes and throws 401 if unauthenticated. Every product response is shaped by `product.dto.ts`'s `toProductDTO(product, isOwner)` — public visitors get a sanitized shape, the owner gets everything. See `src/modules/product/product.service.ts` for the documented exception where public requests may still sort by `price`/`purchaseDate` at the query level even though those fields are stripped from the response.

## Scaling this backend

This app is designed to run as multiple **stateless** instances behind a load balancer — auth is pure JWT (no server-side session), and the only shared mutable state (cache, rate-limit counters) lives in Redis, not in-process. That's what makes both scaling paths below safe:

**Path 1 — PM2 cluster mode (single VPS, multi-core).** `ecosystem.config.js` runs the compiled app in PM2's cluster mode across every CPU core (`instances: 'max'`, or pin a count via `PM2_INSTANCES`). PM2 load-balances incoming connections across the workers itself. This is the cheapest way to use all the cores on one box before you need more than one machine. Run with `pm2 start ecosystem.config.js`.

**Path 2 — Docker Compose + Nginx (multi-container, horizontal).** `docker-compose.yml` defines `postgres`, `redis`, `api` (no fixed `container_name`, so it can be scaled), and `nginx` as a reverse proxy in front of the API replicas. Scale out with:

```bash
docker compose up --scale api=3
```

Docker's embedded DNS round-robins across the `api` service's replicas, and `nginx`'s `least_conn` upstream (see `nginx/nginx.conf`) balances further by active connection count. nginx OSS doesn't do *active* upstream health checks on its own — `nginx_upstream_check_module` or nginx Plus would be the next step if that becomes necessary; in the meantime `GET /health` (checking both Postgres via `SELECT 1` and Redis via `PING`, each with a short timeout) is exactly what such a check, a Docker `HEALTHCHECK`, or an orchestrator's readiness probe should hit.

**Beyond one VPS.** If this ever needs to scale past a single machine, Postgres and Redis should move to managed services (e.g. AWS RDS + ElastiCache, or equivalents) so the app tier stays fully stateless and horizontally scalable behind any load balancer (Nginx, an ALB, etc.) — no code changes required, only `DATABASE_URL`/`REDIS_URL` pointing at the managed instances.

Graceful shutdown (`SIGTERM`/`SIGINT` in `server.ts`) closes the HTTP server, disconnects Prisma and Redis, and exits — required so a rolling restart under either path drains in-flight requests instead of dropping them.

## Environment variables

See `.env.example`. Required vars fail fast at boot with a clear error (via `src/config/index.ts`); Cloudinary/SMTP/Redis are optional and degrade gracefully when absent (local-disk uploads, console-logged "emails", no-op caching/in-memory rate limiting, respectively).

## Deployment notes

- Run `npx prisma migrate deploy` (never `migrate dev`) before starting the API container in any real environment.
- `.env` is git-ignored; only `.env.example` is committed.
