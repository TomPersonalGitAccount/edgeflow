# ReverseCacheFlow

## Security Rules
- NEVER hardcode secrets, API keys, tokens, or passwords in source code
- Always read secrets from environment variables (`import.meta.env` in Astro, `env` bindings in Workers)
- Auth checks must be fail-closed: if a required secret is missing, return 500 — never skip auth
- Use timing-safe comparison for webhook signature verification
- Never commit `.env` files — use `.dev.vars` for local Wrangler dev (also gitignored)
- Never put secrets in URLs, query parameters, or filenames
- Store production secrets via `wrangler secret put`, never in config files
- Always include a `.gitignore` that excludes `.env*`, `.dev.vars`, `credentials.json`, `token.json`, `*.pem`, `*.key`

## Project Structure
- `packages/edge-worker/` — Multi-tenant Cloudflare Worker (the caching proxy)
- `packages/dashboard/` — Astro SSR app on Cloudflare Pages (auth, billing, domain management)
- `packages/shared/` — Shared types and utilities
- `packages/landing/` — Landing page (not yet created)

## Stack
- Auth: Clerk
- Payments: Stripe Checkout + Billing Portal
- Database: Cloudflare D1
- KV: Tenant config + usage counters
- Hosting: Cloudflare Workers + Pages

## GitHub
- Always use TomPersonalGitAccount, never CleverTommy
- Always switch GitHub account from Claude's shell (`gh auth switch --user TomPersonalGitAccount`)
