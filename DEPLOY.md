# SafeSpace — Deployment & Continuous Updates Guide

---

## Deploying to Netlify (first time)

### What you need before you start
- GitHub account (free)
- Netlify account (free)
- Supabase project created with schema.sql + schema_additions.sql run
- Resend account with API key
- Google Cloud project with Gmail API + OAuth credentials
- Twilio account with UK number (for centre inbound line)

---

### Step 1 — Push code to GitHub

```bash
# Unpack the archive
tar -xzf safespace-final-v2.tar.gz
cd safespace

# Initialise git
git init
git add .
git commit -m "SafeSpace initial release"

# Create a new repo on github.com (call it 'safespace')
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/safespace.git
git branch -M main
git push -u origin main
```

---

### Step 2 — Connect to Netlify

1. Go to **app.netlify.com** → Add new site → **Import from Git**
2. Click **GitHub** → Authorize → select your `safespace` repo
3. Netlify detects the settings from `netlify.toml` automatically:
   - Build command: `npm run build`
   - Publish directory: `.next`
4. **Do not deploy yet** — add environment variables first

---

### Step 3 — Set environment variables in Netlify

Netlify dashboard → **Site configuration → Environment variables → Add variable**

Add each of these:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `NEXTAUTH_SECRET` | Run: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your Netlify URL e.g. `https://safespace-xyz.netlify.app` |
| `RESEND_API_KEY` | resend.com → API Keys |
| `EMAIL_FROM` | `noreply@yourdomain.co.uk` |
| `NEXT_PUBLIC_APP_URL` | Same as NEXTAUTH_URL |
| `NEXT_PUBLIC_CENTRE_CODE` | `BST` (or your centre code) |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → OAuth credentials |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth credentials |
| `GOOGLE_WORKSPACE_DOMAIN` | `yourdomain.co.uk` |
| `GOOGLE_VOICE_PLAN` | `premier` |
| `TWILIO_ACCOUNT_SID` | twilio.com → Console |
| `TWILIO_AUTH_TOKEN` | twilio.com → Console |
| `TWILIO_PHONE_NUMBER` | Your Twilio UK number |
| `TWILIO_RECORD_CALLS` | `true` |
| `NODE_OPTIONS` | `--max-old-space-size=3072` |

> **Important:** `NODE_OPTIONS` must be set or the build will run out of memory
> during TypeScript checking.

---

### Step 4 — Deploy

Click **Deploy site** in Netlify. The first build takes 3–5 minutes.

When it completes you'll get a URL like `https://safespace-abc123.netlify.app`.

---

### Step 5 — Update OAuth redirect URI

Go to Google Cloud Console → OAuth credentials → your client → Edit.

Add to **Authorised redirect URIs**:
```
https://safespace-abc123.netlify.app/api/gmail/callback
```

---

### Step 6 — Run the database schema

In Supabase → SQL Editor, run in order:

1. `supabase/schema.sql` — full database schema
2. `supabase/schema_additions.sql` — Phase 3/4 additions

---

### Step 7 — Create your first staff account

In Supabase → Authentication → Users → **Invite user** → enter your email.

After accepting the invite, run this in the SQL Editor:

```sql
-- Replace with your actual user UUID from Auth → Users
INSERT INTO staff (id, full_name, role, centre_id)
VALUES (
  'paste-your-uuid-here',
  'Your Name',
  'director',
  '00000000-0000-0000-0000-000000000001'
);
```

---

### Step 8 — Set up a custom domain (recommended)

1. Buy `safespace-basingstoke.co.uk` (or similar)
2. Netlify → Domain management → Add custom domain
3. Update your DNS records as shown
4. Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` env vars to the new domain
5. Update the Google OAuth redirect URI to the new domain

---

### Step 9 — Point Twilio webhook to your app

In twilio.com → Phone Numbers → your number → Configure:

- **Voice webhook:** `https://yourdomain.co.uk/api/calls/inbound`
- **HTTP method:** POST
- **Recording status callback:** `https://yourdomain.co.uk/api/calls/recording`

---

### Step 10 — Switch from demo data to Supabase

In each of these files, change the import:

```typescript
// FROM (demo data):
import { store } from '@/lib/store';

// TO (real Supabase database):
import { store } from '@/lib/db';
```

Files to update:
- `src/app/page.tsx`
- `src/components/SharingPage.tsx`
- `src/components/BillingPage.tsx`
- `src/components/SafeguardingPage.tsx`
- `src/components/NACCCPage.tsx`
- `src/components/WaitingListPage.tsx`
- `src/components/CommLogPage.tsx`
- `src/components/CallsPage.tsx`
- `src/components/GmailPage.tsx`
- `src/app/admin/page.tsx`
- `src/app/portal/[token]/page.tsx`

After changing, commit and push — Netlify redeploys automatically.

---

## Pushing updates (continuous deployment)

**This is the best part — every change you make deploys automatically.**

### How it works

Netlify watches your GitHub repo. The moment you push code to the `main` branch, Netlify:
1. Pulls the latest code
2. Runs `npm run build`
3. Deploys in ~3 minutes
4. Your live site updates with zero downtime

You never need to manually redeploy.

### The update workflow

```bash
# 1. Make changes to the code in Claude (download the updated archive)
# 2. Unpack and copy changed files into your local repo
# 3. Then:

git add .
git commit -m "Description of what changed"
git push origin main

# Netlify picks it up and deploys automatically
```

### When Claude builds new features

Each time we build something new here, you'll get a `.tar.gz` archive.
To apply the update:

```bash
# Option A — replace specific files (cleaner)
# Copy just the changed files from the new archive into your repo
# Then commit and push

# Option B — full replace (easier for big updates)
tar -xzf safespace-new-version.tar.gz
cp -r safespace/src/* your-repo/src/
cp -r safespace/supabase/* your-repo/supabase/
git add .
git commit -m "Update: [description of what changed]"
git push origin main
```

---

## Can Claude push updates directly?

Not to your live Netlify site directly — Claude doesn't have your GitHub credentials.

However, the workflow is close to that. Here's the most streamlined approach:

### Option 1 — GitHub web upload (no terminal needed)

1. Claude builds the update and you download the archive
2. Go to your GitHub repo in the browser
3. Navigate to the changed file (e.g. `src/app/page.tsx`)
4. Click the pencil icon → paste the new content → commit
5. Netlify deploys automatically

Works fine for single-file changes.

### Option 2 — GitHub CLI on your machine (recommended)

Install [GitHub Desktop](https://desktop.github.com/) — a visual app, no command line.

1. Clone your repo in GitHub Desktop once
2. Download the archive from Claude
3. Copy the changed files into the repo folder on your computer
4. GitHub Desktop shows you exactly what changed
5. Write a commit message and click Push — done
6. Netlify deploys in 3 minutes

### Option 3 — GitHub Actions (fully automated, zero manual steps)

Ask Claude to build a GitHub Action that watches for new archives in a specific folder and automatically commits them. This is a ~30-minute setup and then updates are completely hands-off.

---

## Monitoring your deployment

### Netlify dashboard
- **Deploys tab** — shows every deployment with build logs
- **Functions tab** — shows API route invocations and errors
- **Analytics** — traffic and performance

### Supabase dashboard
- **Table editor** — browse your live data
- **Logs** — API calls and errors
- **Auth → Users** — manage staff accounts

### Key things to watch
- Build failures appear immediately in the Netlify Deploys tab with the exact error
- Database errors appear in Supabase Logs
- Email delivery issues appear in Resend dashboard

---

## Rollback

If a deployment breaks something:

1. Netlify → Deploys tab → click any previous successful deploy
2. Click **Publish deploy** → it's live again in 30 seconds

Your database is unaffected by rollbacks — only the code changes.

---

## Environment per centre (when you open a second centre)

Each centre needs its own case code in the database but can share the same deployment.
Add the new centre in the SQL Editor:

```sql
INSERT INTO centres (name, code, address, phone, email)
VALUES ('SafeSpace Winchester', 'WIN', '...', '...', '...');
```

Staff are then assigned to a centre via their staff record. The director sees all centres in the admin panel. No code changes needed.

---

## Security checklist before going live with real families

- [ ] `NEXTAUTH_SECRET` is a random 32-byte string (not the example)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is not exposed in client-side code
- [ ] Google OAuth redirect URI is set to your production domain only
- [ ] Twilio webhook URL is HTTPS (Netlify provides this automatically)
- [ ] `SUPER_ADMIN_KEY` env var is set for the `/admin` route
- [ ] Test a full login → case creation → session → share link cycle end-to-end
- [ ] Commission a basic penetration test before handling live family data
- [ ] Add your privacy policy and data processing notice to the login page

---

*SafeSpace deployment guide · Keep this document confidential*
