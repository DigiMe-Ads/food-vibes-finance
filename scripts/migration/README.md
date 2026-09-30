# Moving data from the MeDo Supabase project to the personal one

| | Project | Where the keys live |
|---|---|---|
| Old (MeDo, gets paused if unpaid) | `myjmzlvwquakgfxkehhk` | `.env` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| New (personal) | `awlopzbkhmigjkboxwhv` | `.env` → `*_NEW` keys; DB password in `.env.local` (gitignored) |

The app uses the `*_NEW` keys when they are set, otherwise the old ones.

## Pull the latest data from MeDo again

Safe to repeat as often as you like while the old app is still in use.

```powershell
# 1. Export everything from the old project (read-only; needs an admin login)
$env:ADMIN_EMAIL="admin@miaoda.com"; $env:ADMIN_PASSWORD="<admin password>"
node scripts/migration/export-data.mjs

# 2. Load it into the new project
$env:TEMP_PASSWORD="<temporary password for any NEW users>"
node scripts/migration/import-data.mjs backup/<timestamp printed by step 1>
```

What the import does:

- **Rows** (projects, categories, investments, expenses, activity logs, profiles) are upserted by id. New and edited
  rows from MeDo come across, and rows created only in the new project are kept.
- **Rows deleted in MeDo are not deleted** in the new project. Remove them by hand if needed.
- **Users** that already exist in the new project are left alone, so their passwords are not reset. Users added in
  MeDo since the last sync are created with `TEMP_PASSWORD` and must choose their own password at first login.
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` keep that one account's real password.
- It prints a row-count check at the end.
- Receipt files: the export downloads them into `backup/<timestamp>/storage/receipts`. None existed at the first
  migration. If a later export has some, upload that folder to the new project's `receipts` bucket (Supabase
  dashboard → Storage), keeping the same paths. The import already rewrites `attachment_url` to the new project.

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
