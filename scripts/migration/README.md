# Moving data from the MeDo Supabase project to the personal one

| | Project | Where the keys live |
|---|---|---|
| Old (MeDo, gets paused if unpaid) | `myjmzlvwquakgfxkehhk` | `.env` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| New (personal) | `awlopzbkhmigjkboxwhv` | `.env` → `*_NEW` keys; DB password and service-role key in `.env.local` (gitignored) |

The app uses the `*_NEW` keys when they are set, otherwise the old ones.

## Pull the latest data from MeDo again (new site is live)

Both sites can change, so compare first and only add what is new. Nothing in the new database is overwritten.

```powershell
# 1. Export MeDo (read-only; needs an admin login)
$env:ADMIN_EMAIL="admin@miaoda.com"; $env:ADMIN_PASSWORD="<admin password>"
node scripts/migration/export-data.mjs                     # -> backup/<old-timestamp>

# 2. Snapshot the new database's tables to backup/<new-snapshot>/tables/<table>.json
#    (psql: select json_agg(t order by t.id) from public.<table> t)

# 3. Compare: baseline = the previous MeDo export that the new DB was last synced from
node scripts/migration/diff-sync.mjs backup/<baseline> backup/<old-timestamp> backup/<new-snapshot> backup/sync-plan.json

# 4. Add the rows that exist only on MeDo (insert-only, one transaction)
node scripts/migration/apply-sync.mjs backup/sync-plan.json
```

- `diff-sync` reports rows **added**, **edited** and **deleted** on MeDo since the baseline, and flags **conflicts**
  (the same row changed on both sites). `apply-sync` only inserts the added rows. Edits, deletions and conflicts are
  listed for a human to decide.
- After a sync, the MeDo export you used becomes the baseline for the next one.
  Last sync: 2026-09-30, baseline `backup/2026-09-30T10-27-34-630Z`.
- `import-data.mjs` is for loading an **empty** project. Do not re-run it against the live database: it upserts every
  row and would overwrite edits made on the new site.
- Receipt files: the export downloads them into `backup/<timestamp>/storage/receipts`. None have existed so far. If a
  later export has some, upload that folder to the new project's `receipts` bucket, keeping the same paths.

`backup/` is gitignored because it contains real financial and user data.

## Setting up a fresh project from scratch

```powershell
psql "<connection string>" -f supabase/schema.sql
psql "<connection string>" -f supabase/migrations/00006_user_management_sql_rpcs.sql
```

Then run the import above. If the direct `db.<ref>.supabase.co` host fails to resolve (it is IPv6-only), use the
**Session pooler** connection string from Supabase → Connect.

## Passwords

Supabase's API cannot export password hashes, so migrated users get a temporary password and the app makes them pick
a new one on first login. Admins can reset anyone's password from **Users → 🔑**. User management runs through SQL
functions (`00006_user_management_sql_rpcs.sql`), so the new project needs no Edge Function or service-role key.
