# Paw by Paw — Design Outline

A trainer-first CRM built around the **dog**, not the sale. It replaces scattered notes, GHL-style tabs, and hand-written texts with one structured record of each dog's training, and turns that record into clear updates for owners.

Status: draft v0.1, November 2026. Sources: `Paw by Paw/` (feature doc, PRD and user stories, wireframes, interview notes with three trainers: Interviewee A (multi-city business owner with staff), Interviewee B (independent trainer) and Interviewee C (technical advisor), and the discovery deck).

---

## 1. Problem and target segment

**Problem.** Training doesn't move in a straight line, is specific to each behavior, and often covers several dogs per household. Generic CRMs model a linear sales pipeline. Trainers end up keeping dog history in their heads, in Word or PDF docs, or spread across separate tabs (Interviewee A: "finding payment info, consult notes, or even a dog's name takes too many steps"). Owners get unstructured text "report cards" they can't act on.

**Primary user.** Dog trainers running multi-session programs: independent trainers and small teams.

**Secondary user.** Dog owners, who receive updates and homework.

> ⚠️ **Open decision: segment.** Interviewee A runs a multi-city business with staff. Our PRD targets independent and small trainers. **Default chosen here:** build the UI for a small team (1–10 trainers), but include organizations, locations and roles in the data model from day one so the larger business case doesn't force a rewrite. Confirm this with 2–3 more trainer interviews.

---

## 2. Personas and roles

| Role | Who | Can do |
|---|---|---|
| `owner` | Business owner | Everything, including staff, locations, transfers and billing status |
| `admin` | Front desk / manager | Manage households, payments and assignments; read all dogs in their locations |
| `trainer` | Staff trainer | Read and write dogs in their locations; log sessions; send updates |
| Dog owner | The client (no account) | Opens an update link, sees external notes and homework, checks off tasks |

Solo trainers are simply an organization with one `owner` user.

---

## 3. MVP feature set (revised from interviews)

The core loop is the same as the PRD: **set up household → plan → log session → (optionally) update owner**. Changes from interviews are marked **[new]** or **[changed]**.

### F1. Households and dog profiles
- A household has owner name and phone, plus unlimited dogs, each with its own plan, logs and flags (US1).
- **[new] Presenting problem and goal** fields on each dog. Interviewee A: goals change ("dog's original problem didn't exist").
- **[new] Payment status** on the household: a green or red dot for *current / overdue*, plus a simple **package** (e.g. "6-session package, 4 used"). This is not a POS.

### F2. Flexible per-dog training plans
- Trainer-defined stages; add, rename, reorder, delete; statuses *not started / in progress / complete*; reopen with a reason; full stage history (US3, US4).
- **[new] Plan templates (the organization's own).** A template is a reusable curriculum (e.g. *Foundations 1 → Foundations 2 → Freedom 1*). Applying one **copies** its stages into the dog's plan, and from then on the copy is fully editable. This satisfies both Interviewee A (pre-formatted class structures he can break up and rearrange) and Interviewee B (every dog is different).

### F3. Session log with behavior tracking
- Preset and custom behavior tags, notes, and timestamp; target is under 2 minutes (US5).
- **[changed] The 3 Ds replace the 1–5 rating.** For each behavior worked on, the trainer can optionally record **Duration, Distance, Distraction**, plus a session-level **"Takes food? Y/N"** (stress check). Units vary by behavior, so these are stored as flexible JSON (see §5). The overall 1–5 rating stays as an optional quick field.
- **[new] Internal vs external notes.** Internal notes never leave the trainer app. Only external notes can pre-fill an owner update.
- **[new] Voice dictation.** Rely on the phone keyboard's built-in dictation (free, works everywhere). Add a mic button using the Web Speech API where supported (Chrome and Safari; not Firefox).
- Safety flags: severity *low/med/high* and a note; pinned in red on the profile and dog list; resolving moves a flag to history (US6).

### F4. Summary card ("at a glance")  **[new as its own feature]**
Interviewee A's main request: one screen with **dog, owner, payment dot, goal, active flags, current stage and the last 2 sessions** (3 Ds and external notes). This sits at the top of the Dog Profile and on a **Today** list (see §7). It is not full scheduling; it's a list of who you're seeing today.

### F5. Owner updates with homework  **[changed: optional, lighter]**
- From a saved log, the trainer can optionally send an update: what we worked on (pre-filled from **external** notes), plan progress, and 2–3 homework tasks (US7).
- The owner opens an SMS link: no app, no login. They see the update and can check off tasks, and completion shows up on the trainer's profile (US8).
- Deprioritized because Interviewee A said clients skew older and less tech-savvy, homework is usually given verbally, and his existing tool already sends reminders. A no-login link is still the lowest-friction option, so it stays in the MVP, but it is **skippable** and is not the key success metric.

### Deferred
| Phase | Feature | Why |
|---|---|---|
| Next | AI summary of the last 2 sessions | Structured logs make it easy; Interviewee A rated it "most useful" |
| Next | Progress charts (3 Ds over time) | Needs weeks of data |
| Next | Automated homework reminders | Only if owner engagement proves out |
| Next | Calendar sync (Google Calendar import for the Today list) | Avoids building scheduling |
| Next | Offline logging (queued saves) | Validate whether trainers log without signal |
| Future | Scheduling, POS (selling leashes), payroll and multi-city tax | Existing tools cover these; out of scope |
| Future | Owner app with messaging and video | Validate the link first |
| Future | Shared cross-organization template library | Needs data from many trainers |

---

## 4. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **React + TypeScript + Vite** | Responsive, mobile-first; target iPhone, Android, iPad and desktop. Tap targets ≥ 44px |
| Routing | React Router | |
| Server state | **TanStack Query** | Caching, optimistic updates (instant-feeling saves); later, persisted mutations for offline |
| Styling | Tailwind CSS | Grayscale UI; **red is reserved for safety flags** (per the wireframes) |
| Backend | **Supabase** | Postgres, Auth, Row-Level Security, Storage (dog photos), Edge Functions |
| Types | `supabase gen types typescript` | Types generated from the database schema |
| SMS | Twilio (or similar), called from a Supabase Edge Function | API key stays server-side |
| Local dev | Supabase CLI (`supabase start`, which runs in Docker) | Migrations live in `supabase/migrations/` and are checked into git |
| Hosting | Vercel or Netlify for the frontend; Supabase cloud for the backend | Free tiers are fine for the MVP |

**Why Supabase:** the data is relational (organization → location → household → dog → plan/sessions/flags/updates). The flexible parts (3D measurements, template stages) go in `jsonb` columns. RLS enforces organization, location and role access in the database, so React talks to Supabase directly with no custom API. It's plain Postgres underneath, so there's no lock-in.

---

## 5. Data model (Postgres)

Noun–verb model → tables. All tables have `id uuid pk default gen_random_uuid()` and `created_at timestamptz default now()` (omitted below).

```
organizations ─┬─ locations ─┬─ households ─┬─ packages
               │             │              └─ dogs ─┬─ plan_stages ── stage_events
               ├─ staff ─────┘ (staff_locations)     ├─ sessions ── session_behaviors
               ├─ plan_templates                     ├─ flags
               └─ behavior_tags                      ├─ owner_updates ── homework_tasks
                                                     └─ dog_transfers
```

### Tenancy and people
| Table | Key columns |
|---|---|
| `organizations` | `name` |
| `locations` | `org_id → organizations`, `name`, `city` |
| `staff` | `id → auth.users` (pk), `org_id`, `role` enum(`owner`,`admin`,`trainer`), `display_name` |
| `staff_locations` | `staff_id`, `location_id` (pk both) — which locations a staff member can access |

### Clients
| Table | Key columns |
|---|---|
| `households` | `org_id`, `location_id`, `owner_name`, `phone` (E.164), `email?`, `payment_status` enum(`current`,`overdue`,`none`), `internal_notes` |
| `packages` | `household_id`, `name`, `sessions_total`, `sessions_used`, `paid` bool, `expires_on?` |
| `dogs` | `household_id`, `org_id` (denormalized for RLS), `location_id`, `name`, `breed`, `birth_date?`, `photo_path?`, `presenting_problem`, `goal`, `notes`, `assigned_trainer_id? → staff`, `archived_at?` |
| `dog_transfers` | `dog_id`, `from_location_id`, `to_location_id`, `by_staff_id`, `reason?` — audit log; the dog keeps its full history |

### Plans
| Table | Key columns |
|---|---|
| `plan_templates` | `org_id`, `name`, `stages jsonb` — `[{ "name": "Foundations 1", "description": "..." }, ...]` |
| `plan_stages` | `dog_id`, `position int`, `name`, `description?`, `status` enum(`not_started`,`in_progress`,`complete`), `source_template_id?` |
| `stage_events` | `stage_id`, `dog_id`, `from_status`, `to_status`, `reason?`, `by_staff_id` — append-only history; regressions = `complete → in_progress` |

Stage transitions are **state changes recorded as events** (Interviewee C's "series of state changes" option), not a fixed workflow engine. A Postgres trigger on `plan_stages.status` writes `stage_events` automatically.

### Sessions and safety
| Table | Key columns |
|---|---|
| `behavior_tags` | `org_id?` (null = system preset), `label` |
| `sessions` | `dog_id`, `staff_id`, `occurred_at`, `rating? smallint 1–5`, `takes_food? bool`, `internal_notes`, `external_notes`, `package_id?` (counts against the package) |
| `session_behaviors` | `session_id`, `tag_id → behavior_tags`, `measures jsonb`, `note?` (free text about that behavior, with or without the 3 Ds) |
| `flags` | `dog_id`, `severity` enum(`low`,`med`,`high`), `note`, `created_by`, `resolved_at?`, `resolved_by?`, `resolution_note?` |

`measures` shape (all keys optional; units vary by behavior):
```json
{
  "duration":    { "value": 30, "unit": "sec" },
  "distance":    { "value": 15, "unit": "ft" },
  "distraction": { "value": 3,  "unit": "level", "note": "other dogs across street" }
}
```

### Owner updates
| Table | Key columns |
|---|---|
| `owner_updates` | `dog_id`, `session_id?`, `worked_on`, `plan_progress`, `token_hash` (sha256), `expires_at`, `sent_at?`, `first_opened_at?`, `link_requested_at?` |
| `homework_tasks` | `dog_id`, `session_id?`, `update_id?`, `position`, `text`, `created_by?`, `completed_at?`, `completed_by?` (null + done = owner checked it off). Assigned while logging, from the dog's Homework tab, or in an owner update |

### Activity log  **[new]**
| Table | Key columns |
|---|---|
| `activity_log` | `org_id`, `location_id?`, `actor_id?`, `table_name`, `action` (`insert`/`update`/`delete`), `record_id?`, `label`, `dog_id?`, `dog_name?`, `changes text[]?`, `created_at` |

Written only by the `log_activity()` trigger (append-only; no client write policies). Owners see everything in the org; admins see their locations' entries plus org-wide ones; trainers see none. Shown on **Updates → Activity**. Every table staff edit must have the trigger; new tables also need an entry in `ACTIVITY_TABLES` (`src/features/activity/api.ts`).

### Useful views
- `dog_summary`: one row per dog with current stage, active flag count/max severity, last 2 sessions, payment status, and package remaining. This powers the dog list, Today list and summary card in **one query**, which supports the PRD's targets of loading in under 2 seconds and reaching any dog in 2 taps or fewer.

---

## 6. Security

### Row-Level Security (staff)
Enable RLS on every table. Helper functions (`security definer`, `stable`):
- `auth_org_id()` returns the caller's `staff.org_id`.
- `auth_role()` returns the caller's role.
- `can_access_location(loc uuid)` returns true for `owner`; otherwise checks `staff_locations`.

Policy pattern, using `dogs` as the example:
```sql
create policy "staff read dogs in their locations" on dogs
  for select using (org_id = auth_org_id() and can_access_location(location_id));
```
Child tables (sessions, flags, …) check access through their `dog_id`. Only `owner` can insert into `dog_transfers` or change `staff`.

### Owner link (no login)
- The URL is `https://<app>/u/<token>`, where the token is 32 random bytes encoded as base64url. **Only its sha256 hash is stored.**
- The `anon` role has **no table access**. The owner page calls two `security definer` RPCs:
  - `get_owner_update(token)` returns dog name, trainer name, `worked_on`, `plan_progress`, the stage list (names and status only) and homework. It sets `first_opened_at`. **It never returns internal notes, flags or payment info.**
  - `set_homework(token, task_id, done)`.
- Links expire after 14 days (configurable). The expired state shows **Request New Link**, which sets `link_requested_at` so the trainer sees a prompt.

### Edge Functions
- `send-owner-update`: validates that the caller can access the dog, creates the token, sends the SMS via Twilio, and sets `sent_at`.
- (Next phase) `summarize-sessions`: AI summary of the last 2 sessions, using **external and internal notes for the trainer only**.

---

## 7. Screens and wireframe changes

The wireframes (`Paw by Paw/2-DesignMockup_Wireframes.pdf`) already cover Flows A, B and C (24 frames). Changes needed for the revised scope:

| Screen | Change |
|---|---|
| **[new] Sign in** | Supabase Auth (magic link or password). The brainstorm flagged this as missing |
| **[new] Today** | First tab: only what happened today: sessions logged and homework assigned or completed (calendar sync for upcoming dogs later) |
| Dashboard / Dog List | Add a **payment dot** to dog cards; add a location filter for multi-location organizations |
| Household View | Add payment status and package ("4 of 6 used") to the owner card |
| Add Dog Profile | Add **Presenting problem** and **Goal** fields |
| Training Plan Editor (empty) | Two choices: **Start from template** or **Add your first stage** |
| **[new] Template manager** | Under Settings: create and edit organization templates |
| Dog Profile | Turn the top into the **summary card**: payment dot, goal, flag, stage, **last 2 sessions** (was 3) with 3D values |
| Log Session | Replace the required rating with an optional one; after picking a tag, show expandable **Duration / Distance / Distraction** inputs; **Takes food? Y/N** toggle; split notes into **Internal** (default) and **For owner**; mic button |
| Post-Save Prompt | Keep "Send owner update?" but default to **Not now** visually; show only if there are external notes or homework |
| Owner Update Composer | Pre-fill only from **For owner** notes |
| **[new] Settings → Staff and locations** | Owner-only: invite staff, assign locations, transfer a household |

---

## 8. Frontend structure

```
src/
  lib/supabase.ts          # createClient<Database>()
  lib/database.types.ts    # generated
  features/
    auth/
    today/
    dogs/                  # list, profile, summary card
    households/
    plans/                 # editor, templates
    sessions/              # log session, 3D inputs, flags
    updates/               # composer, preview
  owner/                   # public /u/:token page (separate, tiny bundle)
  components/ui/
supabase/
  migrations/
  functions/send-owner-update/
  seed.sql                 # demo org, dogs from the wireframes (Biscuit, Juno, ...)
```

Each feature folder owns its query hooks (`useDog(id)`, `useLogSession()`), built on TanStack Query and `supabase-js`. Mutations use optimistic updates so saving a log feels instant.

---

## 9. Success metrics (reweighted)

| Metric | Target | Note |
|---|---|---|
| **Logging consistency** (logged / held sessions) | ≥ 70% by week 4 | **Key metric**, unchanged |
| Log speed (median) | ≤ 2 min | |
| Activation (household, dog and plan in week 1) | ≥ 80% | |
| Summary-card use (profile opens before a session) | Track | New; validates F4 |
| Trainer retention (weekly logging in week 4) | ≥ 60% | |
| Update adoption | ≥ 30% (was 60%) | Lowered; updates are optional now |
| Owner opens within 48h / homework completion | Track, no target | Collect data before committing |

---

## 10. Milestones

1. **Setup:** Vite and React app, Supabase project, auth, organization/staff/location tables with RLS, seed data.
2. **F1:** households, dogs, payment status, packages, dog list and household view.
3. **F2:** plan editor, stage events and history, templates.
4. **F3:** session log with 3 Ds, internal/external notes, flags; `dog_summary` view; Dog Profile summary card.
5. **F4:** Today list.
6. **F5:** owner update composer, Edge Function and SMS, public owner page, expiry and new-link request.
7. **Test with trainers:** measure log time and logging consistency; decide on offline support and the AI summary.

## 11. Open questions
- Segment: solo/small trainers or multi-location businesses? (§1)
- Do trainers log without signal (parks, rural homes)? This decides offline priority.
- What do Interviewee A's "pre-formatted class structures" look like in practice? Get a real example to shape `plan_templates`.
- Should the 3D units be fixed per behavior tag (e.g. "Stay" is always seconds and feet)? That would make logging faster.
- Twilio cost and A2P 10DLC registration for production SMS. Use a trial or test numbers for the class demo.
