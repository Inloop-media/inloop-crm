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

## 4. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 → **Continue with Google** → you land on Leads as admin.
Add the rest of the team under **Team** (name, Google email, role).

## Roles

| Role | Can |
|---|---|
| Admin | Everything, including the Team page |
| Ops | See and assign every lead, add leads by hand |
| Executive | See and update only the leads assigned to them |

## Website → CRM

The website's `/api/lead` sends each form submission to `POST /api/leads` with header
`x-intake-secret: <CRM_INTAKE_SECRET>` and the same JSON the form posts
(`firstName, lastName, phone, email, company, location, service, budget, message, newsletter`).
