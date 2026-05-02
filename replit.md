# Dossy World

## Overview

Vault-filling game with M-Pesa payments (PayHero STK Push), JWT auth, and a JSON file-based database. Migrated from Vercel/Next.js to a Replit pnpm workspace (Vite + React frontend + Express backend).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend**: Vite + React + Tailwind CSS (`artifacts/dossy-world`)
- **Backend**: Express 5 (`artifacts/api-server`, port 8080)
- **Routing**: wouter (client-side), Vite proxy `/api` → `localhost:8080`
- **Auth**: JWT in HTTP-only cookies (bcryptjs + jsonwebtoken), cookie-parser on Express; Google OAuth2 (`/api/auth/google`)
- **Database**: JSON file at `.data/db.json` (MySQL schema at `artifacts/api-server/dossy_world_mysql.sql`)
- **Payments**: PayHero M-Pesa STK Push (`PAYHERO_BASIC_AUTH`, `PAYHERO_CHANNEL_ID`)
- **CSS theme**: Neon gaming theme via oklch CSS variables

## Key Commands

- `pnpm --filter @workspace/dossy-world run dev` — run frontend locally
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Architecture

### Frontend (`artifacts/dossy-world`)
- `src/App.tsx` — all routes via wouter: `/`, `/crypto`, `/history`, `/admin/*`, `/ops-control-9f3a2b7c`
- `src/context/auth-context.tsx` — auth context with `apiBase()` helper (BASE_URL-aware)
- `src/pages/` — GamePage, HistoryPage, CryptoPage, OpsGatewayPage, admin pages
- `src/components/auth/` — AuthModal (with Google button), UserDropdown (upcoming payout)
- `src/components/wallet/` — DepositModal, WithdrawModal (both use `apiBase()`)
- `src/index.css` — neon gaming theme (oklch CSS vars)

### Backend (`artifacts/api-server`)
- `src/app.ts` — Express app with CORS (credentials), cookie-parser
- `src/routes/auth.ts` — login, register, logout, `/auth/me`, `/auth/google-status`
- `src/routes/auth-google.ts` — Google OAuth2 callback flow
- `src/routes/game.ts` — current round, buy, fairness
- `src/routes/wallet.ts` — deposit (M-Pesa STK Push), withdraw
- `src/routes/user.ts` — profile, transactions, buys, `/user/upcoming-payout`
- `src/routes/admin.ts` — admin CRUD
- `src/lib/db.ts` — JSON file DB at `.data/db.json`; phone normalization fix in `findUserByPhone`
- `src/lib/auth.ts` — JWT auto-generated to `.data/.jwt-secret` if `JWT_SECRET` env not set
- `src/lib/game-engine.ts` — vault game logic, bot scheduler, round management

## Features

- **Phone login bug fix** — `findUserByPhone` now normalises `0712...` → `254712...` before comparison
- **Google login** — `/api/auth/google` → Google → `/api/auth/google/callback` → JWT cookie. Requires `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` env vars; button shown only when configured
- **Upcoming Payout** — user dropdown shows staked amount + expected payout in current active round (replaces Withdraw button; poll every 5 s)
- **Crypto page** — `/crypto` route shows BTC, USDT TRC20, USDT BEP20 wallet addresses with QR codes. Addresses set via `VITE_BTC_ADDRESS`, `VITE_USDT_TRC20_ADDRESS`, `VITE_USDT_BEP20_ADDRESS` env vars
- **WhatsApp icon** — floating green button on game page linking to `VITE_WHATSAPP_GROUP_URL`
- **MySQL schema** — `artifacts/api-server/dossy_world_mysql.sql` — all tables for live MySQL server

## Environment Variables

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Signs JWT tokens. Auto-generated to `.data/.jwt-secret` if not set |
| `ADMIN_DEFAULT_PASSWORD` | Seeds admin user. Falls back to `Dossy@Admin2026!` |
| `PAYHERO_BASIC_AUTH` | PayHero API basic auth (base64) |
| `PAYHERO_CHANNEL_ID` | PayHero channel ID for STK Push |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (optional — disables button if missing) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `APP_BASE_URL` | Full URL of the API server (for Google OAuth redirect URI) |
| `FRONTEND_URL` | Full URL of the frontend (Google OAuth post-login redirect) |
| `VITE_BTC_ADDRESS` | Bitcoin deposit address shown on Crypto page |
| `VITE_USDT_TRC20_ADDRESS` | USDT TRC20 deposit address |
| `VITE_USDT_BEP20_ADDRESS` | USDT BEP20 deposit address |
| `VITE_WHATSAPP_GROUP_URL` | WhatsApp group invite link for floating button |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME` | MySQL connection (for future migration) |

## Security Notes

- `.data/` is gitignored — JWT secret file and DB are not committed
- CORS restricted to `*.replit.dev` and `*.repl.co` domains
- Google button only appears when `GOOGLE_CLIENT_ID` is configured (no dead endpoints)
