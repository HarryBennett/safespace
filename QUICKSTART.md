# SafeSpace — Quick Start Card

## The 6 things you do manually. Everything else is automatic.

---

### 1 · Create three accounts (15 min)

| Service | URL | What to do |
|---|---|---|
| **Supabase** | supabase.com | New project → name it `safespace-production` → region **West EU (Ireland)** |
| **Resend** | resend.com | Sign up → API Keys → Create key → copy it |
| **GitHub** | github.com | New repository → name `safespace` → Private |

---

### 2 · Put the code on GitHub (5 min)

1. Install **GitHub Desktop** → desktop.github.com
2. Clone your new `safespace` repo
3. Unzip `safespace-v3.tar.gz` → copy contents into the cloned folder
4. GitHub Desktop → commit message: `Initial release` → **Commit** → **Push**

---

### 3 · Connect Netlify and set env vars (10 min)

1. **app.netlify.com** → Add new site → Import from Git → GitHub → select `safespace`
2. Do NOT deploy yet — go to **Site configuration → Environment variables**
3. Add every variable from the table below
4. Then click **Deploy site**

#### Required env vars

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role ⚠ keep secret |
| `NEXTAUTH_SECRET` | Any 32+ character random string |
| `NEXTAUTH_URL` | Your Netlify URL e.g. `https://safespace-abc.netlify.app` |
| `NEXT_PUBLIC_APP_URL` | Same as NEXTAUTH_URL |
| `RESEND_API_KEY` | Resend → API Keys |
| `EMAIL_FROM` | `noreply@yourdomain.co.uk` |
| `NODE_OPTIONS` | `--max-old-space-size=3072` |
| `NEXT_PUBLIC_CENTRE_CODE` | `BST` |
| `CRON_SECRET` | Any 20+ character random string |

---

### 4 · Run the database schema (5 min)

Supabase → **SQL Editor** → run these two files in order:

1. Paste contents of `supabase/schema.sql` → **Run**
2. Paste contents of `supabase/schema_additions.sql` → **Run**

Both should say: *Success. No rows returned.*

---

### 5 · Create your account (3 min)

1. Supabase → Authentication → Users → **Invite user** → your email
2. Click the link in the email
3. Supabase → SQL Editor → run:

```sql
INSERT INTO staff (id, full_name, role, centre_id)
VALUES (
  'paste-your-uuid-from-auth-users',
  'Your Name',
  'director',
  '00000000-0000-0000-0000-000000000001'
);
```

Go to your Netlify URL → sign in → you're in (demo data visible).

---

### 6 · Switch to live data (2 min)

In your repo folder on your computer, run:

```bash
node switch-to-production.js --apply
```

Then in GitHub Desktop: commit → push → Netlify redeploys in ~3 min.
Demo data gone. Real database active.

---

## Verify everything works

Run this before going live with real families:

```bash
# Create a .env.local file with your values, then:
node verify-setup.js
```

All green = ready. Anything red = fix it first.

---

## Optional but recommended

**Custom domain** — buy `safespace-yourtown.co.uk` (~£10/yr), add in Netlify → Domain management, update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` env vars.

**Court bundle PDF** — deploy Gotenberg on railway.app (free tier, ~£4/mo), add `GOTENBERG_URL` env var. Without it, the bundle downloads as HTML (still printable to PDF from browser).

**Google Voice + Gmail** — Google Cloud Console → enable Gmail API → create OAuth credentials → add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars.

**Twilio inbound number** — buy a UK number at twilio.com → point webhook to `https://yourdomain/api/calls/inbound` → add Twilio env vars.

---

## Every future update from Claude

```
Download new archive → copy files into repo folder → GitHub Desktop commit + push
Netlify auto-deploys in ~3 minutes. Zero server management.
```

---

*SafeSpace v3 · CONFIDENTIAL*
