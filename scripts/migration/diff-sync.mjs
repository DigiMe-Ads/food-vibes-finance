// Three-way comparison for syncing the old (MeDo) project into the live new one.
//
//   baseline = backup taken at migration time (both sides were identical then)
//   old      = a fresh export-data.mjs backup of the MeDo project
//   new      = a snapshot of the new database's tables (same JSON layout)
//
// Reports, per table, what changed on the OLD side since baseline and whether the
// NEW side also touched the same row (a conflict). Read-only: writes plan.json only.
//
// Usage: node scripts/migration/diff-sync.mjs <baselineDir> <oldDir> <newDir> [planOut.json]

import fs from 'node:fs';
import path from 'node:path';

const [baseDir, oldDir, newDir, planOut] = process.argv.slice(2);
if (!baseDir || !oldDir || !newDir) {
  console.error('Usage: node scripts/migration/diff-sync.mjs <baselineDir> <oldDir> <newDir> [planOut.json]');
  process.exit(1);
}

const TABLES = ['profiles', 'projects', 'categories', 'investments', 'expenses', 'activity_logs'];

const load = (dir, t) => new Map(JSON.parse(fs.readFileSync(path.join(dir, 'tables', `${t}.json`), 'utf8')).map(r => [r.id, r]));

// Postgres/PostgREST format the same value differently (numeric as number vs string,
// timestamps with different offsets/precision), so compare normalised values.
const norm = (k, v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).getTime();
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && k === 'amount') return String(Number(v));
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
};
const changedFields = (a, b) => Object.keys({ ...a, ...b }).filter(k => norm(k, a[k]) !== norm(k, b[k]));

const plan = { insert: {}, update: {}, conflicts: {}, deletedInOld: {}, newOnlyRows: {}, newEdits: {} };

for (const t of TABLES) {
  const base = load(baseDir, t), old = load(oldDir, t), neu = load(newDir, t);
  const ins = [], upd = [], conf = [], del = [], newOnly = [], newEdits = [];

  for (const [id, o] of old) {
    const b = base.get(id), n = neu.get(id);
    if (!b) {
      // Created on the old site after migration
      if (!n) ins.push(o);
      else if (changedFields(o, n).length) conf.push({ id, kind: 'same id exists in new with different values', old: o, new: n });
      continue;
    }
    const oldChanged = changedFields(b, o);
    if (oldChanged.length === 0) continue;
    if (!n) { conf.push({ id, kind: 'edited in old, deleted in new', fields: oldChanged, old: o }); continue; }
    const newChanged = changedFields(b, n);
    if (newChanged.length === 0) upd.push({ id, fields: oldChanged, from: Object.fromEntries(oldChanged.map(k => [k, b[k]])), to: Object.fromEntries(oldChanged.map(k => [k, o[k]])), row: o });
    else if (changedFields(o, n).length === 0) { /* both sides made the same edit */ }
    else conf.push({ id, kind: 'edited on both sides', oldFields: oldChanged, newFields: newChanged, old: o, new: n, base: b });
  }
  for (const [id, b] of base) if (!old.has(id)) del.push({ id, stillInNew: neu.has(id), row: b });
  for (const [id, n] of neu) {
    if (!base.has(id) && !old.has(id)) newOnly.push(n);
    else if (base.has(id) && changedFields(base.get(id), n).length) newEdits.push({ id, fields: changedFields(base.get(id), n) });
  }

  Object.assign(plan.insert, { [t]: ins });
  Object.assign(plan.update, { [t]: upd });
  Object.assign(plan.conflicts, { [t]: conf });
  Object.assign(plan.deletedInOld, { [t]: del });
  Object.assign(plan.newOnlyRows, { [t]: newOnly });
  Object.assign(plan.newEdits, { [t]: newEdits });

  console.log(`${t.padEnd(14)} base ${String(base.size).padStart(4)} | old ${String(old.size).padStart(4)} | new ${String(neu.size).padStart(4)}  →  ` +
    `add ${ins.length}, update ${upd.length}, conflicts ${conf.length}, deleted-in-old ${del.length}  (new-site only: ${newOnly.length} added, ${newEdits.length} edited)`);
}

if (planOut) {
  fs.writeFileSync(planOut, JSON.stringify(plan, null, 2));
  console.log(`\nPlan written to ${planOut}`);
}
