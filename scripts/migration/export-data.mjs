// Export all app data (tables + receipt files) from the current Supabase project.
//
// Uses the public anon key from .env plus an ADMIN login, because RLS hides every
// row from anonymous requests. Read-only: nothing in the source project is changed.
//
// Usage (PowerShell):
//   $env:ADMIN_EMAIL="admin@miaoda.com"; $env:ADMIN_PASSWORD="..."; node scripts/migration/export-data.mjs
//
// Output: backup/<timestamp>/{tables/*.json, storage/receipts/..., manifest.json}

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv(path.join(ROOT, '.env'));
const SUPABASE_URL = process.env.SOURCE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.SOURCE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
let ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (an account with the admin role).');
  process.exit(1);
}
// The app's login treats a bare username as <username>@miaoda.com
if (!ADMIN_EMAIL.includes('@')) ADMIN_EMAIL = `${ADMIN_EMAIL}@miaoda.com`;

// Parents before children so the import can insert in this order.
const TABLES = ['profiles', 'projects', 'categories', 'investments', 'expenses', 'activity_logs'];
const BUCKET = 'receipts';
const PAGE = 1000;

const supabase = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(ROOT, 'backup', stamp);
fs.mkdirSync(path.join(outDir, 'tables'), { recursive: true });

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

async function listAllFiles(prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      // Folders come back with id === null
      if (item.id === null) files.push(...(await listAllFiles(full)));
      else files.push(full);
    }
    if (data.length < PAGE) return files;
  }
}

async function main() {
  console.log(`Source: ${SUPABASE_URL}`);
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (authErr) throw new Error(`Login failed: ${authErr.message}`);

  const { data: me } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (me?.role !== 'admin') {
    throw new Error(`Logged in as ${ADMIN_EMAIL} but role is "${me?.role}". An admin is required to see all profiles.`);
  }

  const manifest = { source: SUPABASE_URL, exported_at: new Date().toISOString(), exported_by: ADMIN_EMAIL, tables: {}, storage: {} };

  for (const table of TABLES) {
    const rows = await fetchAll(table);
    fs.writeFileSync(path.join(outDir, 'tables', `${table}.json`), JSON.stringify(rows, null, 2));
    manifest.tables[table] = rows.length;
    console.log(`  ${table.padEnd(14)} ${rows.length} rows`);
  }

  // Files: everything listed in the bucket, plus anything referenced by expenses
  // that the listing missed (bucket is public, so those download without auth).
  const listed = await listAllFiles();
  const expenses = JSON.parse(fs.readFileSync(path.join(outDir, 'tables', 'expenses.json'), 'utf8'));
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const referenced = expenses
    .map((e) => e.attachment_url)
    .filter((u) => u?.includes(marker))
    .map((u) => decodeURIComponent(u.split(marker)[1].split('?')[0]));
  const allPaths = [...new Set([...listed, ...referenced])];

  const failed = [];
  for (const p of allPaths) {
    const { data, error } = await supabase.storage.from(BUCKET).download(p);
    if (error) {
      failed.push({ path: p, error: error.message });
      continue;
    }
    const dest = path.join(outDir, 'storage', BUCKET, ...p.split('/'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(await data.arrayBuffer()));
  }
  manifest.storage[BUCKET] = { files: allPaths.length - failed.length, failed };
  console.log(`  storage/${BUCKET}  ${allPaths.length - failed.length} files downloaded, ${failed.length} failed`);
  for (const f of failed) console.log(`    FAILED ${f.path}: ${f.error}`);

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await supabase.auth.signOut();
  console.log(`\nDone → ${outDir}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
