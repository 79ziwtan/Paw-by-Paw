# Waffle

**Live demo:** https://trainwithwaffle.netlify.app · **Source:** https://github.com/79ziwtan/Paw-by-Paw

## Build guide

Requires Node 22+ and Docker (running).

```bash
npm install
npm run db:start                 # starts local Supabase in Docker, applies migrations + demo data
npx supabase status              # copy the ANON_KEY
cp .env.example .env.local       # paste the key into VITE_SUPABASE_ANON_KEY
npm run dev                      # http://localhost:5173
```

Production build: `npm run build` (output in `dist/`). One Netlify site serves both: the landing page (`landing/index.html`) at `/` and the trainer app at `/app` (sign-in at `/login`; owner links at `/u/…` and `/o/…`). In `npm run dev`, `/` just opens the app; to view the landing page locally, open `landing/index.html` in a browser.

To wipe the database back to the demo data: `npm run db:reset`.

**Trainer flow (mid-fidelity prototype):** Calendar → tap appointment → Dog summary card → Log session (about a minute) → (optional) share update.
The calendar (Month / Week / Day, built on FullCalendar) shows real **appointments** (dog, trainer, start time, length, location, notes). Tap an empty time slot to book at that time. Book one with **+ New appointment**, and change or cancel it from **Edit** on the dog summary card (once a session is logged for it, it can't be cancelled or moved to another dog until that session is deleted); trainers see their own by default (**Mine**), owners and admins see everyone's (**All**). Opening an appointment leads to the dog summary card and **Log session**, and the logged session links back to its appointment. The demo data has appointments this week and next. Google Calendar sync is **coming soon** (the button is shown but disabled).

**Send** (owner profile links) opens the owner's link in a new tab so you can share it. Texting it to the owner isn't built yet.

## Logging in

All accounts use the password `password123`.

| Email | Name | Role |
|---|---|---|
| `owner@waffle.test` | OrgOwner | Business owner: sees everything, including the Org tab and Activity |
| `admin@waffle.test` | OrgAdmin | Admin at the Main location: clients, packages and session counts, Activity for their location |
| `trainer@waffle.test` | OrgTrainer | Trainer at the Main location: dogs, plans, session logs, homework and owner updates |
