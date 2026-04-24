# Dossy World

Next.js 16 (App Router) app migrated from Vercel to Replit.

## Run
- Workflow: `Start application` runs `npm run dev` on port 5000 (host 0.0.0.0).
- Build: `npm run build` / Start: `npm run start`.

## Notes
- `next.config.mjs` allows `*.replit.dev`/`*.replit.app` dev origins.
- Storage uses a JSON file at `.data/db.json` (see `lib/db.ts`).
- Optional env vars: `JWT_SECRET`, `MPESA_*` (M-Pesa integration in `lib/mpesa.ts`).

## Game engine
- `lib/game-engine.ts` runs one round at a time. Each round secretly rolls `will_fill` against `house_edge_percentage`.
- Fill rounds use a pace-keeper: bots compute how far they're behind a 0→100% schedule (targeted at 80% of lifetime) and drip larger/faster to keep the vault on track to erupt before expiry. A small final top-off closes the cap if remaining < 50 KES.
- No-fill rounds keep the original gentle drip toward `bot_target_pct` then expire silently.
- Each tick can fire up to 4 catch-up bot drips so polling cadence (~1s on the homepage) is enough to fill 10000 KES vaults within the default 90s lifetime.

## Admin access
- Hidden gateway URL: `/ops-control-9f3a2b7c` (login form for admins).
- The `/admin/*` panel redirects unauthenticated/non-admin users to the gateway.
- Default seeded admin — username `admin`, password `Dossy@Admin2026!`.
- SQL schema (`scripts/dossy_world_mysql_schema.sql`) inserts the same admin user (bcrypt hash already updated to match).
- Re-seed at any time with: `npx tsx scripts/seed-admin.ts`.
