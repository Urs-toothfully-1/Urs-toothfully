# keepalive is no longer scheduled

Hobby allows two cron jobs; this was the third and the least useful one. Its
only job was to touch the database so Supabase does not pause the project after
a week of inactivity — but `/api/cron/daily` and `/api/cron/backup` both query
the database every day, which already covers that.

The route is kept so it can be called by hand, or re-added to `vercel.json`
on a plan that allows more crons.
