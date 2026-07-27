# Database backups (Supabase Free tier)

The Free tier has no automated backups, so we take our own logical backups with
the Prisma client — no `pg_dump` or Postgres tools required.

## Manual backup (anytime)

```bash
npm run db:backup
```

Writes a timestamped `full-db-<ts>.json` to `Desktop/Urs_toothfully/backups`
containing every table. **Copy that file off this machine** (Google Drive /
Dropbox / USB) — a backup that only lives on the same PC isn't really a backup.

## Automated weekly backup (Windows Task Scheduler)

A task named **"Toothfully DB Backup"** runs every **Sunday 2:00 AM** (IST) via
`scripts/run-backup.cmd`. It uses "start when available", so if the PC is off at
2 AM it runs the next time it's on.

Manage it:

```powershell
# see status / last run
Get-ScheduledTaskInfo -TaskName "Toothfully DB Backup"

# run it now
Start-ScheduledTask -TaskName "Toothfully DB Backup"

# remove it
Unregister-ScheduledTask -TaskName "Toothfully DB Backup" -Confirm:$false
```

## Restore

```bash
# dry run — shows what would be restored, changes nothing
node scripts/restore-db.mjs backups/full-db-<ts>.json

# actually restore (upserts every row by id, in FK-safe order)
./node_modules/.bin/dotenvx run -f .env -- node scripts/restore-db.mjs backups/full-db-<ts>.json --confirm
```

Point it at the right database with the `dotenvx -f` flag (`.env` = prod,
`.env.local` = local). Restoring into an empty/fresh Supabase project rebuilds
everything; restoring into a populated one overwrites matching rows.

## Note

These are **snapshots** — they capture the moment you run them, not continuous.
For point-in-time recovery, Supabase Pro's PITR add-on is the only option.
