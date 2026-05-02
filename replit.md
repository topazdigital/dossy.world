# Dossy World

## Overview

Vault-filling game with M-Pesa payments (PayHero STK Push), JWT auth, and a JSON file-based database. Migrated from Vercel/Next.js to a Replit pnpm workspace (Vite + React frontend + Express backend).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend**: Vite + React + Tailwind CSS (artifacts/dossy-world)
- **Backend**: Express 5 (artifacts/api-server, port 8080)
- **Routing**: wouter (client-side), Vite proxy `/api` → `localhost:8080`
- **Auth**: JWT in HTTP-only cookies (bcryptjs + jsonwebtoken), cookie-parser on Express
- **Database**: JSON file at `.data/db.json` (no PostgreSQL)
- **Payments**: PayHero M-Pesa STK Push (`PAYHERO_BASIC_AUTH`, `PAYHERO_CHANNEL_ID`)
- **CSS theme**: Neon gaming theme via oklch CSS variables

## Key Commands

- `pnpm --filter @workspace/dossy-world run dev` — run frontend locally
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Architecture

### Frontend (`artifacts/dossy-world`)
- `src/App.tsx` — all routes via wouter, including admin sub-routes via AdminLayout
- `src/context/auth-context.tsx` — auth context with `apiBase()` helper (BASE_URL-aware)
- `src/pages/` — GamePage, HistoryPage, OpsGatewayPage (login), admin pages
- `src/components/` — game, wallet, UI components
- `src/index.css` — neon gaming theme (oklch CSS vars for both :root and .dark)

### Backend (`artifacts/api-server`)
- `src/app.ts` — Express app with CORS (credentials), cookie-parser
- `src/routes/` — auth, game, wallet, user, admin routes
- `src/lib/db.ts` — JSON file DB at `.data/db.json`
- `src/lib/game-engine.ts` — vault game logic, bot scheduler, round management
- Admin access via `/ops-control-9f3a2b7c` route (secret URL)

## API Pattern

Frontend calls use `${apiBase()}/api/...` where `apiBase()` strips trailing slash from `import.meta.env.BASE_URL`. Vite dev server proxies `/api` → `http://localhost:8080`.

## Environment Variables

- `PAYHERO_BASIC_AUTH` — PayHero API basic auth (base64 encoded)
- `PAYHERO_CHANNEL_ID` — PayHero channel ID for STK Push
- `JWT_SECRET` — secret for signing JWT tokens
- `PORT` — assigned by Replit per artifact
- `BASE_PATH` — assigned by Replit per artifact
