# Paw by Paw

**Live demo:** https://pawbypaw.netlify.app · **Source:** https://github.com/79ziwtan/Paw-by-Paw

## Build guide

Requires Node 22+ and Docker (running).

```bash
npm install
npm run db:start                 # starts local Supabase in Docker, applies migrations + demo data
npx supabase status              # copy the ANON_KEY
cp .env.example .env.local       # paste the key into VITE_SUPABASE_ANON_KEY
npm run dev                      # http://localhost:5173
```

Production build: `npm run build` (output in `dist/`).

To wipe the database back to the demo data: `npm run db:reset`.

**Send** (owner profile links) opens the owner's link in a new tab so you can share it. Texting it to the owner isn't built yet.

## Logging in

All accounts use the password `password123`.

| Email | Name | Role |
|---|---|---|
| `owner@pawbypaw.test` | OrgOwner | Business owner: sees everything, including the Org tab and Activity |
| `admin@pawbypaw.test` | OrgAdmin | Admin at the Main location: clients, packages and session counts, Activity for their location |
| `trainer@pawbypaw.test` | OrgTrainer | Trainer at the Main location: dogs, plans, session logs, homework and owner updates |
