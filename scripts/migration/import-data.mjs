// Import a backup made by export-data.mjs into the NEW Supabase project's database.
//
// Prerequisites (once, on a fresh project):
//   psql <new db> -f supabase/schema.sql
//   psql <new db> -f supabase/migrations/00006_user_management_sql_rpcs.sql
//
// Connection details come from .env.local (NEW_DB_HOST, NEW_DB_PORT, NEW_DB_USER,
// NEW_DB_NAME, NEW_DB_PASSWORD). Requires psql on PATH.
//
// Usage (PowerShell):
//   $env:TEMP_PASSWORD="<temporary password for migrated users>"
//   $env:ADMIN_EMAIL="admin@miaoda.com"; $env:ADMIN_PASSWORD="<keeps this user's real password>"   # optional
//   node scripts/migration/import-data.mjs backup/<timestamp>
//
// Passwords can't be read from the old project, so every user except ADMIN_EMAIL gets
// TEMP_PASSWORD and is forced to choose a new one at first login. User ids are kept,
// so every created_by / user_id reference still matches.
//
// Re-runnable, for pulling the latest data from the old project later: existing users
// (and their passwords) are left alone; all other rows are upserted by id, so rows
// added only in the new project are kept. Rows deleted in the old project are NOT
// deleted here.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = { ...loadEnv(path.join(ROOT, '.env')), ...loadEnv(path.join(ROOT, '.env.local')), ...process.env };
const backupDir = process.argv[2];
const { TEMP_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD } = env;

for (const k of ['NEW_DB_HOST', 'NEW_DB_USER', 'NEW_DB_PASSWORD', 'VITE_SUPABASE_URL_NEW']) {
  if (!env[k]) {
    console.error(`Missing ${k} (expected in .env / .env.local).`);
    process.exit(1);
  }
}
if (!backupDir || !TEMP_PASSWORD || TEMP_PASSWORD.length < 6) {
  console.error('Usage: set TEMP_PASSWORD (min 6 chars), then: node scripts/migration/import-data.mjs backup/<timestamp>');
  process.exit(1);
}

const BUCKET = 'receipts';
// Parents before children (FK order)
const DATA_TABLES = ['projects', 'categories', 'investments', 'expenses', 'activity_logs'];

const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf8'));
const read = (t) => JSON.parse(fs.readFileSync(path.join(backupDir, 'tables', `${t}.json`), 'utf8'));

const lit = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const tag = `j${crypto.randomBytes(6).toString('hex')}`;
const jsonLit = (v) => `$${tag}$${JSON.stringify(v)}$${tag}$::jsonb`;

function upsertSql(table, rows) {
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(', ');
  const updates = cols.filter((c) => c !== 'id').map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');
  return `INSERT INTO public.${table} (${colList})
SELECT ${colList} FROM jsonb_populate_recordset(NULL::public.${table}, ${jsonLit(rows)})
ON CONFLICT (id) DO UPDATE SET ${updates};\n`;
}

function usersSql(profiles) {
  return profiles
    .filter((p) => p.email)
    .map((p) => {
      const keep = ADMIN_EMAIL && ADMIN_PASSWORD && p.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      const password = keep ? ADMIN_PASSWORD : TEMP_PASSWORD;
      const meta = { username: p.username ?? p.email.split('@')[0], must_change_password: !keep };
      return `INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', ${lit(p.id)}, 'authenticated', 'authenticated', ${lit(p.email)},
  extensions.crypt(${lit(password)}, extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, ${jsonLit(meta)},
  ${lit(p.created_at)}, now(), '', '', '', '', '', '', '', ''
) ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (${lit(p.id)}, ${lit(p.id)}, ${jsonLit({ sub: p.id, email: p.email, email_verified: true })}, 'email', now(), now(), now())
ON CONFLICT (provider_id, provider) DO NOTHING;\n`;
    })
    .join('');
}

function psql(args, input) {
  const res = spawnSync('psql', [
    `host=${env.NEW_DB_HOST} port=${env.NEW_DB_PORT ?? 5432} user=${env.NEW_DB_USER} dbname=${env.NEW_DB_NAME ?? 'postgres'} sslmode=require`,
    '-v', 'ON_ERROR_STOP=1', '-X', '-q', ...args,
  ], { input, encoding: 'utf8', env: { ...process.env, PGPASSWORD: env.NEW_DB_PASSWORD }, maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0) throw new Error(res.stderr || res.error?.message || 'psql failed');
  return res.stdout;
}

function main() {
  const newUrl = env.VITE_SUPABASE_URL_NEW.replace(/\/$/, '');
  console.log(`Backup: ${backupDir} (from ${manifest.source}, ${manifest.exported_at})`);
  console.log(`Target: ${newUrl}`);

  const profiles = read('profiles');
  const oldPrefix = `${manifest.source}/storage/v1/object/public/${BUCKET}/`;
  const newPrefix = `${newUrl}/storage/v1/object/public/${BUCKET}/`;

  let sql = 'BEGIN;\n';
  sql += usersSql(profiles);
  // Overwrites the default row the on_auth_user_created trigger inserted
  sql += upsertSql('profiles', profiles);
  for (const table of DATA_TABLES) {
    let rows = read(table);
    if (table === 'expenses') {
      rows = rows.map((r) =>
        r.attachment_url?.startsWith(oldPrefix) ? { ...r, attachment_url: newPrefix + r.attachment_url.slice(oldPrefix.length) } : r,
      );
    }
    sql += upsertSql(table, rows);
  }
  sql += 'COMMIT;\n';

  psql([], sql);
  console.log('  Import committed.');

  const counts = psql(['-tA', '-F', '\t', '-c', ['profiles', ...DATA_TABLES]
    .map((t) => `SELECT '${t}', count(*) FROM public.${t}`).join(' UNION ALL ')]);
  console.log('\nVerification (backup → new database):');
  let ok = true;
  for (const line of counts.trim().split('\n')) {
    const [table, count] = line.split('\t');
    const expected = manifest.tables[table];
    // New project may legitimately have extra rows after go-live
    const match = Number(count) >= expected;
    ok &&= match;
    console.log(`  ${match ? 'OK  ' : 'LOW '} ${table.padEnd(14)} ${expected} → ${count}`);
  }
  const files = manifest.storage?.[BUCKET]?.files ?? 0;
  if (files > 0) console.log(`\nNote: ${files} receipt file(s) in ${backupDir}/storage must be uploaded separately (see scripts/migration/README.md).`);
  console.log(ok ? '\nImport complete.' : '\nImport finished with missing rows — check above.');
}

try {
  main();
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
