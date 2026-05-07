#!/usr/bin/env node
/**
 * SafeSpace — switch-to-production.js
 *
 * Swaps the in-memory demo store for the real Supabase data layer
 * across all component files in one run.
 *
 * Usage:
 *   node switch-to-production.js          # dry run — shows what will change
 *   node switch-to-production.js --apply  # applies changes
 *   node switch-to-production.js --revert # switches back to demo store
 */

const fs   = require('fs');
const path = require('path');

const APPLY  = process.argv.includes('--apply');
const REVERT = process.argv.includes('--revert');
const DRY    = !APPLY && !REVERT;

const ROOT = path.join(__dirname, 'src');

// Files that import from @/lib/store and need swapping
// The script auto-discovers these, but we list them explicitly
// so you can audit exactly what will change.
const TARGET_FILES = [
  'app/page.tsx',
  'app/admin/page.tsx',
  'app/portal/[token]/page.tsx',
  'components/BillingPage.tsx',
  'components/CallsPage.tsx',
  'components/CommLogPage.tsx',
  'components/ContactNumberManager.tsx',
  'components/GmailPage.tsx',
  'components/NACCCPage.tsx',
  'components/RotaPage.tsx',
  'components/SafeguardingPage.tsx',
  'components/SessionFeedbackForm.tsx',
  'components/SharingPage.tsx',
  'components/WaitingListPage.tsx',
].map(f => path.join(ROOT, f));

// What to swap
// In store.ts:  named exports like { store, storeExt, Case, ... }
// In db/index.ts: same { store } interface, storeExt merged in
const STORE_IMPORT  = /@\/lib\/store/g;
const DB_IMPORT     = '@/lib/db';
const DB_REVERT     = '@/lib/store';

let changed = 0;
let skipped = 0;
let missing = 0;

console.log('\n' + '─'.repeat(60));
console.log(REVERT
  ? '  SafeSpace — reverting to DEMO store (store.ts)'
  : '  SafeSpace — switching to PRODUCTION Supabase (db/index.ts)');
console.log('─'.repeat(60));
if (DRY) console.log('  DRY RUN — pass --apply to make changes\n');

for (const filePath of TARGET_FILES) {
  const rel = path.relative(path.join(__dirname, 'src'), filePath);

  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠  MISSING  ${rel}`);
    missing++;
    continue;
  }

  const original = fs.readFileSync(filePath, 'utf-8');

  let updated;
  if (REVERT) {
    updated = original.replace(/@\/lib\/db/g, DB_REVERT);
  } else {
    updated = original.replace(STORE_IMPORT, DB_IMPORT);
  }

  if (updated === original) {
    console.log(`  –  no change  ${rel}`);
    skipped++;
    continue;
  }

  // Show what changed
  const fromStr = REVERT ? '@/lib/db'    : '@/lib/store';
  const toStr   = REVERT ? '@/lib/store' : '@/lib/db';
  console.log(`  ✓  ${APPLY ? 'updated' : 'would update'}  ${rel}`);
  console.log(`       ${fromStr}  →  ${toStr}`);

  if (APPLY) {
    fs.writeFileSync(filePath, updated, 'utf-8');
  }
  changed++;
}

console.log('\n' + '─'.repeat(60));
console.log(`  ${changed} file(s) ${APPLY ? 'updated' : 'to update'} · ${skipped} unchanged · ${missing} missing`);

if (DRY && changed > 0) {
  console.log('\n  Run with --apply to make these changes:');
  console.log('  node switch-to-production.js --apply\n');
}

if (APPLY && changed > 0) {
  console.log('\n  ✅ Done. Next steps:');
  console.log('  1. git add .');
  console.log('  2. git commit -m "chore: switch to Supabase data layer"');
  console.log('  3. git push origin main');
  console.log('  → Netlify will redeploy automatically (~3 min)\n');
}

if (REVERT && changed > 0) {
  console.log('\n  ↩  Reverted to demo store. Changes NOT pushed.\n');
}
