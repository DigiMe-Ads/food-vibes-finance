// Applies the INSERT part of a plan produced by diff-sync.mjs to the new database.
// Insert-only (ON CONFLICT DO NOTHING) in one transaction: it can add rows that were
// created on the old site, but never modifies or deletes anything already there.
// Edits/conflicts in the plan are NOT applied — review those by hand.
//
// Usage: node scripts/migration/apply-sync.mjs backup/sync-plan.json

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2];
}

const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
// Parents before children (FK order)
const TABLES = ['profiles', 'projects', 'categories', 'investments', 'expenses', 'activity_logs'];

const pending = TABLES.flatMap(t => [...plan.update[t], ...plan.conflicts[t]].map(() => t));
if (pending.length) console.warn(`Note: ${pending.length} edit(s)/conflict(s) in the plan are not applied by this script.`);

const tag = `j${crypto.randomBytes(6).toString('hex')}`;
let sql = 'BEGIN;\n';
for (const t of TABLES) {
  const rows = plan.insert[t];
  if (!rows.length) continue;
  const cols = Object.keys(rows[0]).map(c => `"${c}"`).join(', ');
  sql += `INSERT INTO public.${t} (${cols})
SELECT ${cols} FROM jsonb_populate_recordset(NULL::public.${t}, $${tag}$${JSON.stringify(rows)}$${tag}$::jsonb)
ON CONFLICT (id) DO NOTHING;\n`;
}
sql += 'COMMIT;\n' + TABLES.map(t => `SELECT '${t}', count(*) FROM public.${t}`).join(' UNION ALL ') + ';\n';

const res = spawnSync('psql', [
  `host=${env.NEW_DB_HOST} port=${env.NEW_DB_PORT ?? 5432} user=${env.NEW_DB_USER} dbname=${env.NEW_DB_NAME ?? 'postgres'} sslmode=require`,
  '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-tA', '-F', '\t',
], { input: sql, encoding: 'utf8', env: { ...process.env, PGPASSWORD: env.NEW_DB_PASSWORD } });

if (res.status !== 0) {
  console.error(res.stderr || 'psql failed — nothing was changed (transaction rolled back).');
  process.exit(1);
}
for (const t of TABLES) console.log(`  ${t.padEnd(14)} +${plan.insert[t].length} planned`);
console.log('\nRow counts now:\n' + res.stdout.trim().split('\n').map(l => '  ' + l.replace('\t', ': ')).join('\n'));
