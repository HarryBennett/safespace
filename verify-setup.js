#!/usr/bin/env node
/**
 * SafeSpace — verify-setup.js
 *
 * Run this after setting your environment variables to confirm
 * everything is configured correctly before going live.
 *
 * Usage:
 *   node verify-setup.js
 *
 * Requires a .env.local file in the safespace directory, OR
 * environment variables already set in your shell.
 */

// Load .env.local if present
const fs   = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
  console.log('  Loaded .env.local\n');
}

// ── Colour helpers ────────────────────────────────────────────────────────────
const green  = s => `\x1b[32m${s}\x1b[0m`;
const red    = s => `\x1b[31m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const bold   = s => `\x1b[1m${s}\x1b[0m`;
const dim    = s => `\x1b[2m${s}\x1b[0m`;

let passed = 0;
let failed = 0;
let warned = 0;

function ok(label, detail = '')  { console.log(`  ${green('✓')} ${label}${detail ? dim('  ' + detail) : ''}`); passed++; }
function fail(label, detail = '') { console.log(`  ${red('✗')} ${label}${detail ? '\n    ' + red(detail) : ''}`); failed++; }
function warn(label, detail = '') { console.log(`  ${yellow('⚠')} ${label}${detail ? dim('  ' + detail) : ''}`); warned++; }
function section(title) { console.log(`\n${bold(title)}`); console.log('  ' + '─'.repeat(50)); }

// ── 1. Required environment variables ────────────────────────────────────────
section('1. Environment variables');

const REQUIRED = [
  ['NEXT_PUBLIC_SUPABASE_URL',    'Supabase project URL',        v => v.startsWith('https://') && v.includes('.supabase.co')],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY','Supabase anon key',          v => v.length > 50],
  ['SUPABASE_SERVICE_ROLE_KEY',   'Supabase service role key',   v => v.length > 50],
  ['NEXTAUTH_SECRET',             'Auth secret (32+ chars)',      v => v.length >= 32],
  ['NEXTAUTH_URL',                'App URL',                      v => v.startsWith('https://') || v.startsWith('http://localhost')],
  ['NEXT_PUBLIC_APP_URL',         'App URL (public)',             v => v.length > 5],
  ['RESEND_API_KEY',              'Resend email API key',        v => v.startsWith('re_')],
  ['EMAIL_FROM',                  'Sender email address',        v => v.includes('@')],
  ['NODE_OPTIONS',                'Build memory setting',        v => v.includes('3072')],
  ['NEXT_PUBLIC_CENTRE_CODE',     'Centre code e.g. BST',        v => v.length >= 2 && v.length <= 6],
];

const OPTIONAL = [
  ['GOOGLE_CLIENT_ID',            'Gmail + Voice OAuth',         v => v.includes('.apps.googleusercontent.com')],
  ['GOOGLE_CLIENT_SECRET',        'Gmail + Voice OAuth',         v => v.length > 10],
  ['GOOGLE_WORKSPACE_DOMAIN',     'Your Workspace domain',       v => v.includes('.')],
  ['TWILIO_ACCOUNT_SID',          'Twilio (centre number)',       v => v.startsWith('AC')],
  ['TWILIO_AUTH_TOKEN',           'Twilio auth',                  v => v.length > 20],
  ['TWILIO_PHONE_NUMBER',         'Twilio UK number',            v => v.startsWith('+44') || v.startsWith('+1')],
  ['CRON_SECRET',                 'Invoice chase cron security',  v => v.length >= 16],
];

for (const [key, label, validate] of REQUIRED) {
  const val = process.env[key];
  if (!val) {
    fail(`${key} — ${label}`, `Missing. Set this in Netlify env vars.`);
  } else if (!validate(val)) {
    fail(`${key} — ${label}`, `Value looks wrong: "${val.slice(0, 30)}..."`);
  } else {
    ok(`${key}`, label);
  }
}

console.log('');
for (const [key, label, validate] of OPTIONAL) {
  const val = process.env[key];
  if (!val) {
    warn(`${key} — ${label}`, 'Not set (optional — some features won\'t work)');
  } else if (!validate(val)) {
    warn(`${key} — ${label}`, 'Value may be incorrect');
  } else {
    ok(`${key}`, label);
  }
}

// ── 2. Supabase connection ────────────────────────────────────────────────────
section('2. Supabase connection');

async function checkSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { warn('Skipped — Supabase credentials not set'); return; }

  try {
    // Test basic connectivity
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.ok || res.status === 404) {
      ok('Supabase REST API reachable');
    } else {
      fail('Supabase REST API unreachable', `Status ${res.status}`);
      return;
    }

    // Check core tables exist
    const tables = ['cases', 'sessions', 'notes', 'staff', 'centres', 'share_links', 'invoices', 'safeguarding_incidents', 'waiting_list', 'communication_log'];
    for (const table of tables) {
      const r = await fetch(`${url}/rest/v1/${table}?limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Range': '0-0/*' },
      });
      if (r.status === 200 || r.status === 206) {
        ok(`Table: ${table}`);
      } else if (r.status === 404 || r.status === 400) {
        fail(`Table: ${table}`, 'Not found — run supabase/schema.sql');
      } else {
        warn(`Table: ${table}`, `Status ${r.status}`);
      }
    }

    // Check additions tables
    const additionTables = ['waiting_list', 'communication_log', 'session_feedback', 'dbs_records', 'staff_audit_log', 'invoice_chase_log'];
    for (const table of additionTables) {
      const r = await fetch(`${url}/rest/v1/${table}?limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (r.status === 200 || r.status === 206) {
        ok(`Table: ${table} (additions)`);
      } else {
        fail(`Table: ${table}`, 'Not found — run supabase/schema_additions.sql');
      }
    }

    // Check at least one centre exists
    const centreRes = await fetch(`${url}/rest/v1/centres?limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    const centres = await centreRes.json();
    if (Array.isArray(centres) && centres.length > 0) {
      ok(`Centre record found: ${centres[0].name}`);
    } else {
      warn('No centre record found', 'Schema seed may not have run — check schema.sql');
    }

    // Check at least one staff record exists
    const staffRes = await fetch(`${url}/rest/v1/staff?limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    const staff = await staffRes.json();
    if (Array.isArray(staff) && staff.length > 0) {
      ok(`Staff record found: ${staff[0].full_name} (${staff[0].role})`);
    } else {
      warn('No staff records found', 'Create your first account via Auth → Invite user');
    }

  } catch (err) {
    fail('Could not reach Supabase', err.message);
  }
}

// ── 3. Email check ────────────────────────────────────────────────────────────
async function checkEmail() {
  section('3. Email (Resend)');
  const key = process.env.RESEND_API_KEY;
  if (!key || key === 're_placeholder') { warn('Skipped — RESEND_API_KEY not set'); return; }

  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 200) {
      const data = await res.json();
      const domains = data.data || [];
      if (domains.length > 0) {
        ok(`Resend connected — ${domains.length} domain(s): ${domains.map(d => d.name).join(', ')}`);
      } else {
        warn('Resend connected but no domains configured', 'Add your domain at resend.com/domains');
      }
    } else if (res.status === 401) {
      fail('Resend API key invalid', 'Check RESEND_API_KEY');
    } else {
      warn(`Resend API returned ${res.status}`, 'Check your key');
    }
  } catch (err) {
    warn('Could not reach Resend API', err.message);
  }
}

// ── 4. Build check ────────────────────────────────────────────────────────────
function checkBuild() {
  section('4. Build configuration');

  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
  ok(`Next.js version: ${pkg.dependencies?.next || 'unknown'}`);

  const netlifyToml = fs.existsSync(path.join(__dirname, 'netlify.toml'))
    ? fs.readFileSync(path.join(__dirname, 'netlify.toml'), 'utf-8') : '';
  if (netlifyToml.includes('npm run build') || netlifyToml.includes('next build')) {
    ok('netlify.toml — build command set');
  } else {
    fail('netlify.toml — build command missing');
  }

  const tsconfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'tsconfig.json'), 'utf-8'));
  if (tsconfig.compilerOptions?.skipLibCheck) {
    ok('tsconfig.json — skipLibCheck enabled (required for build speed)');
  } else {
    warn('tsconfig.json — skipLibCheck not set', 'Add "skipLibCheck": true to compilerOptions');
  }

  const nodeOpts = process.env.NODE_OPTIONS || '';
  if (nodeOpts.includes('3072')) {
    ok(`NODE_OPTIONS — ${nodeOpts}`);
  } else {
    fail('NODE_OPTIONS — --max-old-space-size=3072 not set', 'Build will run out of memory on Netlify');
  }

  // Check switch-to-production hasn't been run yet (still on demo store)
  const mainPage = fs.readFileSync(path.join(__dirname, 'src/app/page.tsx'), 'utf-8');
  if (mainPage.includes("from '@/lib/store'")) {
    warn('Still using demo store', "Run: node switch-to-production.js --apply");
  } else if (mainPage.includes("from '@/lib/db'")) {
    ok('Using Supabase data layer');
  }
}

// ── 5. Summary ────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + bold('═'.repeat(54)));
  console.log(bold('  SafeSpace — Setup Verification'));
  console.log(bold('═'.repeat(54)));

  checkBuild();
  await checkSupabase();
  await checkEmail();

  console.log('\n' + bold('═'.repeat(54)));
  console.log(bold('  Results'));
  console.log('  ' + '─'.repeat(50));
  console.log(`  ${green('✓')} ${passed} passed`);
  if (warned > 0) console.log(`  ${yellow('⚠')} ${warned} warnings`);
  if (failed > 0) console.log(`  ${red('✗')} ${failed} failed`);
  console.log(bold('═'.repeat(54)) + '\n');

  if (failed > 0) {
    console.log(red('  ✗ Fix the failures above before deploying to production.\n'));
    process.exit(1);
  } else if (warned > 0) {
    console.log(yellow('  ⚠ Warnings above are non-blocking but should be reviewed.\n'));
    console.log(green('  ✓ Core setup looks good — safe to deploy.\n'));
  } else {
    console.log(green('  ✓ Everything looks good — ready to deploy!\n'));
  }
}

main().catch(err => { console.error(red('\nUnexpected error: ' + err.message)); process.exit(1); });
