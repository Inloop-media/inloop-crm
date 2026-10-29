# Inloop CRM — Setup

Lead management for Inloop Media: website leads, pipeline board, assignment, notes and history.
Next.js 16 + Supabase (Postgres + Google sign-in), hosted on Vercel.

## 1. Supabase project

1. [supabase.com](https://supabase.com) → **New project** (region: Mumbai / `ap-south-1`). Save the database password somewhere safe.
2. **SQL Editor → New query** → paste [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Project Settings → API** — you'll need the **Project URL**, the **anon public** key and the **service_role** key.

## 2. Google sign-in

1. [console.cloud.google.com](https://console.cloud.google.com) (signed in with an inloopmedia.com admin) → create a project "Inloop CRM".
2. **APIs & Services → OAuth consent screen** → User type **Internal** → app name "Inloop CRM" → save.
   (Internal = only inloopmedia.com accounts, no Google review needed.)
3. **Credentials → Create credentials → OAuth client ID** → **Web application**
   - Authorised redirect URI: `https://<your-project>.supabase.co/auth/v1/callback` (Supabase shows the exact URL in step 4)
   - Copy the **Client ID** and **Client secret**.
4. Supabase → **Authentication → Sign In / Providers → Google** → enable → paste Client ID + secret → save.
5. Supabase → **Authentication → URL Configuration**
   - Site URL: your CRM URL (e.g. `https://crm.inloopmedia.com`)
   - Redirect URLs: add `http://localhost:3000/auth/callback` and `https://<your-crm-domain>/auth/callback`

## 3. Environment variables

Copy `.env.example` to `.env.local` (local) and add the same keys in Vercel → Settings → Environment Variables:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (server only) |
| `ADMIN_EMAILS` | Your email(s) — become admin on first sign-in |
| `ALLOWED_DOMAIN` | `inloopmedia.com` |
| `CRM_INTAKE_SECRET` | Long random string, shared with the website |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | The same OAuth client pasted into Supabase (step 2.3) — used to book meetings |
| `MEETING_GUEST_EMAIL` | Inloop guest on every discovery call invite (e.g. `arushi@inloopmedia.com`) |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook — brief is posted when a proposal meeting is booked |

## 4. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 → **Continue with Google** → you land on Leads as admin.
Add the rest of the team under **Team** (name, Google email, role).

## Access & groups

| Access | Can |
|---|---|
| Admin | Everything, including Team & Groups |
| Ops | Every lead, assigning, proposals, commercials — not Team & Groups |
| Member | Whatever their groups allow |

| Group type | Members can |
|---|---|
| Sales executives | Get leads assigned, see only those, set status from New Lead up to Discovery Call, book the discovery call |
| Creative strategists | See shared briefs, pick one up, upload the 4 documents, send them to the CRL bot |
| Other | Nothing extra (a label) |

Admins create groups and add people under **Team**. Lead IDs (`IM-1`, `IM-2`…) come from one counter, so
website and hand-added leads continue the same sequence.

## Website → CRM

The website's `/api/lead` sends each form submission to `POST /api/leads` with header
`x-intake-secret: <CRM_INTAKE_SECRET>` and the same JSON the form posts
(`firstName, lastName, phone, email, company, location, service, budget, message, newsletter`).

The website sends every enquiry to both the Google Sheet and the CRM. In the website's Vercel env add
`CRM_INTAKE_URL` = `https://<your-crm-domain>/api/leads` and `CRM_INTAKE_SECRET` = the same value as here.
The sheet and the CRM number leads separately, so the same lead can have different `IM-` numbers in each.

## Meetings (Google Calendar + Meet)

One-time setup:

1. Supabase → **SQL Editor** → paste [`supabase/migrations/002_meetings.sql`](supabase/migrations/002_meetings.sql) → **Run**.
2. Google Cloud (same project as step 2) → **APIs & Services → Library → Google Calendar API → Enable**.
3. **OAuth consent screen → Data access → Add scope** `.../auth/calendar.events` → save.
4. Fill `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MEETING_GUEST_EMAIL`, `SLACK_WEBHOOK_URL` in `.env.local` / Vercel and restart.

Each person then clicks **Connect your calendar** in the sidebar once. Meetings are created from their own Google account.

| Meeting | Who books it | Rule | Invite goes to |
|---|---|---|---|
| Discovery call | The executive the lead is assigned to (or an admin) | Status must be **Discovery Call**; status stays Discovery Call | Client + `MEETING_GUEST_EMAIL` |
| Proposal meeting | Ops / admin | Only after status **Client Brief Shared to Ops Team** | Client only. Brief is posted to Slack. Executives never see it |

30 minutes, Google Meet link, India time. Cancelling a meeting in the CRM cancels it in Google Calendar and emails the guests.

## Proposal pipeline (briefs → CRL → commercials → proposal deck)

Run [`supabase/migrations/003_groups_proposals.sql`](supabase/migrations/003_groups_proposals.sql) once (after 002).
It adds the groups, the new statuses, the proposal tables, the job queue and the private `lead-docs` storage bucket.

1. Admin books the **proposal meeting** on a lead (needs the brief filled in). The status becomes
   **Proposal Meeting Scheduled** and the brief is shared with everyone in a Creative strategists group (+ Slack).
2. A strategist opens **Briefs**, clicks **Pick up**, uploads the 4 documents — reference links (PDF), creatives,
   brand strategy, brand identity (PDF) — and clicks **Send to CRL bot**.
3. The **CRM worker on the Mac** runs the CRL bot and sends the live CRL link back to the lead.
4. The admin is asked (dashboard + Slack) to **enter the commercials** on the lead.
5. The worker runs the **proposal bot** (proposal deck); the link / files land on the same lead.

### The Mac worker

The Mac asks the CRM for work every 20 seconds (outgoing requests only — no ports to open). If the Mac is off,
jobs wait in the queue and run when it's back.

- CRM env: `WORKER_SECRET` (long random string) and `CRM_URL` (the CRM's public URL, used for links in Slack).
- Mac: `inloop-crl/crl-bot/.env` → `CRM_URL`, the same `WORKER_SECRET`, optional `PROPOSAL_BOT_CMD`.
- Start it: double-click `inloop-crl/crl-bot/start-crm-worker.command` (or `./run-crm-worker.sh`).

**Proposal bot contract** — `PROPOSAL_BOT_CMD` is run with the job folder as its argument
(`~/Desktop/inloop-proposals/IM-12-brand/`), which contains `brief.md`, `job.json` (lead, brief, commercials,
CRL link) and `docs/` (all uploaded files + `links.txt`). When done it writes `result.json`:

```json
{ "deck_url": "https://…", "files": ["proposal-deck.pdf"] }
```

`files` are paths inside the job folder; they're uploaded and attached to the lead. Exit non-zero to report a failure.

## Group updates (Slack-like feed inside the CRM)

Run [`supabase/migrations/004_group_updates.sql`](supabase/migrations/004_group_updates.sql) once (after 003).
It creates the **Inloop CRLs** group, which receives every live CRL link.

Under **Team → Groups**, "Posts here" picks which updates a group gets: CRL live links, proposal deck ready,
new briefs, proposal meetings (with the brief), bot failures. Members read them under **Updates** (unread count in
the sidebar); admin / ops can read every group. Slack is optional — if `SLACK_WEBHOOK_URL` is set, the same updates
also go there.
