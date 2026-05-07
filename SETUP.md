# SafeSpace — Production Setup Guide

## What you need (all free tiers work to start)

| Service | Purpose | Time to set up |
|---|---|---|
| Supabase | Database + auth + file storage | 5 min |
| Resend | Transactional email | 3 min |
| Netlify | Hosting | Already done |
| Custom domain | Professional URL (optional) | 10 min |

---

## Step 1 — Supabase

1. Go to **supabase.com** → New project
2. Name: `safespace-production`
3. Choose **United Kingdom** region (GDPR requirement)
4. Set a strong database password — save it somewhere safe
5. Wait ~2 minutes for the project to spin up

### Run the schema

1. In Supabase dashboard → **SQL Editor**
2. Open the file `supabase/schema.sql` from this project
3. Paste the entire contents and click **Run**
4. You should see: "Success. No rows returned"

### Get your keys

Settings → API:
- Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret)

### Set up file storage

Storage → New bucket:
1. Name: `documents` | Private | 20MB max
2. Name: `recordings` | Private | 500MB max

### Create your first staff account

Authentication → Users → Invite user:
- Enter your email address
- They'll receive a magic link to set their password

Then in SQL Editor, run:
```sql
-- After the user accepts the invite, run this to give them a staff profile
-- Replace the UUID with their actual user ID from Auth → Users
insert into staff (id, full_name, role, centre_id) values
  ('paste-user-uuid-here', 'Your Name', 'director',
   '00000000-0000-0000-0000-000000000001');
```

---

## Step 2 — Resend (email)

1. Go to **resend.com** → Sign up
2. Add your domain (or use the free Resend test domain to start)
3. API Keys → Create API key → copy it → `RESEND_API_KEY`
4. Set `EMAIL_FROM` to `noreply@yourdomain.com`

> **To start without a custom domain:** Use `onboarding@resend.dev` as EMAIL_FROM
> and add your email to Resend's "Verified addresses" to receive test emails.

---

## Step 3 — Environment variables

### For local development

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXTAUTH_SECRET=run-this: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CENTRE_CODE=BST
```

### For Netlify (production)

Netlify dashboard → Site settings → Environment variables → Add:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXTAUTH_SECRET          (generate: openssl rand -base64 32)
NEXTAUTH_URL             (your Netlify URL, e.g. https://safespace-xyz.netlify.app)
RESEND_API_KEY
EMAIL_FROM
NEXT_PUBLIC_APP_URL      (same as NEXTAUTH_URL)
NEXT_PUBLIC_CENTRE_CODE  BST
```

---

## Step 4 — Switch from demo data to production

The app currently uses an in-memory store (`src/lib/store.ts`).
To switch to real Supabase data, update the import in each component:

```typescript
// Change this in: src/app/page.tsx, src/components/SharingPage.tsx,
//                 src/components/BillingPage.tsx, src/components/SafeguardingPage.tsx,
//                 src/components/NACCCPage.tsx, src/app/portal/[token]/page.tsx

// FROM:
import { store } from '@/lib/store';

// TO:
import { store } from '@/lib/db';
```

That's the entire data layer swap. All component code stays the same.

---

## Step 5 — Deploy to Netlify

```bash
git add .
git commit -m "Production: Supabase + auth + email wired up"
git push origin main
```

Netlify will auto-deploy. Your app will be live at your Netlify URL.

---

## Step 6 — Add staff accounts

For each team member:

1. Supabase → Authentication → Users → Invite user (enter their work email)
2. They receive a magic link, click it, set up their account
3. You then run this SQL to give them a role:

```sql
-- Get their UUID from Auth → Users, then:
insert into staff (id, full_name, role, centre_id) values
  ('their-uuid', 'Jane Smith', 'supervisor',
   '00000000-0000-0000-0000-000000000001');

-- Roles: director | manager | supervisor | admin
```

---

## Step 7 — Custom domain (optional but recommended)

1. Buy a domain (e.g. `safespace-basingstoke.co.uk`)
2. Netlify → Domain management → Add custom domain
3. Update DNS records as instructed (usually takes <1 hour)
4. Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` env vars to your new domain

---

## Data retention (GDPR)

Under GDPR and children's social care guidance, case records should be:
- Retained for **7 years** after case closure (or until child turns 25, whichever is later)
- Then flagged for deletion review

Set a calendar reminder to review archived cases annually.

---

## Monthly maintenance checklist

- [ ] Review and close any open safeguarding incidents
- [ ] Chase overdue invoices (Billing page)
- [ ] Check DBS expiry dates for all staff
- [ ] Submit any signed NACCC reports
- [ ] Revoke any expired share links
- [ ] Check Supabase dashboard for storage usage

---

## Costs at scale

| Users / cases | Supabase | Resend | Netlify | Total |
|---|---|---|---|---|
| <500MB / <50 cases | Free | Free | Free | **£0/mo** |
| 1–5GB / 50–200 cases | ~£20/mo | ~£8/mo | ~£18/mo | **~£46/mo** |
| 5GB+ / 200+ cases | ~£50/mo | ~£15/mo | ~£36/mo | **~£100/mo** |

---

## Support

If you get stuck:
- Supabase docs: docs.supabase.com
- Resend docs: resend.com/docs
- Netlify docs: docs.netlify.com

---

## Google Voice setup (phone call logging)

### Prerequisites
- Google Workspace Business Standard or above
- Google Voice licence assigned to each staff member in Google Admin
- Same OAuth credentials used for Gmail

### Step 1 — Enable Google Voice API
1. Google Cloud Console → APIs & Services → Library
2. Search "Google Voice API" → Enable
3. Add scope to your OAuth consent screen:
   - `https://www.googleapis.com/auth/contacts.readonly` (caller name resolution)
4. No new credentials needed — same Client ID and Secret as Gmail

### Step 2 — Staff connect
Each staff member goes to the Gmail settings page in SafeSpace and reconnects their Google account. The updated OAuth flow will request the Voice scope automatically. They'll see a new permission:
> "View your Google Voice call history"

### Step 3 — Twilio centre number (optional but recommended)

For calls to the centre's main number:

1. Sign up at **twilio.com** → Buy a UK phone number (~£1/month)
2. Configure the number's webhook:
   - Voice URL: `https://yourdomain.co.uk/api/calls/inbound`
   - HTTP: POST
3. Add to Netlify env vars:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxx
   TWILIO_PHONE_NUMBER=+441256000000
   TWILIO_RECORD_CALLS=true
   NEXT_PUBLIC_CENTRE_NUMBER=+441256000000
   ```

### How it works once live

| Call type | Detection | Log method |
|---|---|---|
| Staff Google Voice (inbound/outbound) | Polled every 15 min | Automatic |
| Centre Twilio number (inbound) | Real-time webhook | Automatic |
| Call from unknown number | Either method | Manual tag in UI |
| Staff mobile (no Voice) | N/A | Manual log button |

### Call recording consent
The Twilio inbound webhook announces: *"This call may be recorded for quality and legal purposes."*
Recordings are stored in your Supabase `recordings` bucket with the same 15-minute pre-signed URL access control as session recordings.

---

## Step 8 — Google Voice (automatic call logging)

Google Voice for Workspace auto-logs calls to and from your staff's Google numbers.

1. **Enable Google Voice** in your Google Workspace admin console
   - Admin console → Apps → Google Workspace → Google Voice
   - Assign Voice licences to each staff member
   - Assign a UK number to each staff member

2. **Existing OAuth covers it** — the Gmail OAuth connection already requests
   `contacts.readonly` scope. To enable Voice history polling, uncomment the
   Voice scope line in `src/lib/gmail.ts` once Google Voice API exits beta.

3. **How it works**
   - Every 15 minutes: app polls each connected staff member's Voice call history
   - Calls matched to cases via stored contact numbers → auto-logged
   - Unmatched calls appear in the call review queue for manual tagging
   - Staff can also click any number in the app to open their phone app (click-to-call)
   - After each call, a log prompt captures duration and summary

---

## Step 9 — Twilio (centre main number + IVR)

The centre's published number routes through Twilio so all inbound calls are
captured regardless of which staff member answers.

1. **Buy a UK number** at twilio.com
   - Phone Numbers → Buy a Number → UK → Local → search your area code
   - Cost: ~£1/month

2. **Set the webhook** on your Twilio number
   - Voice → Configure → Webhook URL: `https://yourdomain.com/api/calls/ivr`
   - HTTP Method: POST
   - Status callback: `https://yourdomain.com/api/calls/ivr`

3. **Add env vars** to Netlify:
   ```
   TWILIO_ACCOUNT_SID    (from Twilio console dashboard)
   TWILIO_AUTH_TOKEN     (from Twilio console dashboard)
   TWILIO_PHONE_NUMBER   (the number you purchased, e.g. +441256000000)
   TWILIO_RECORD_CALLS   true
   STAFF_NUMBER_1        (Sarah Chen's mobile)
   STAFF_NUMBER_2        (James Okafor's mobile)
   STAFF_NUMBER_3        (Maria Torres's mobile)
   NEXT_PUBLIC_CENTRE_NUMBER  (formatted for display, e.g. +44 1256 000000)
   ```

4. **What callers hear**
   - Consent announcement (legally required for recording in UK)
   - IVR menu: press 1 for Sarah, 2 for James, 3 for Maria, 0 for voicemail
   - Call is recorded and linked to the case record automatically
   - Voicemails are transcribed and logged

5. **Adding contact numbers to cases**
   - Open any case → Overview tab → Contact phone numbers section
   - Add the social worker's direct number, Cafcass officer, solicitor etc.
   - These numbers are used for matching — the more you add, the better auto-matching works

---

## Call matching logic

Auto-matching works in this priority order:

| Match type | Confidence | Example |
|---|---|---|
| Stored contact number exact match | High | SW number saved on case → matches every call |
| Previously tagged number (learned) | High | Once manually tagged, future calls auto-match |
| Google Voice contacts match | Medium | Number in staff's Google Contacts |

**Tip:** After tagging an unmatched call manually, the app saves that number
to the case. All future calls from that number auto-match — the system gets
smarter over time.
