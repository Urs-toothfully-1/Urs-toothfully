This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Hosting: Vercel now, Railway next

The code runs on both. On Railway it builds from `Dockerfile` (Chromium for PDFs,
IST timezone) via `railway.json`, applies database migrations before each deploy,
and runs the scheduled jobs itself (`lib/scheduler.ts`, only when
`RAILWAY_ENVIRONMENT` is set):

| Job | When (IST) | On Vercel |
|---|---|---|
| Reminders, automations, digest | 21:00 daily | `vercel.json` cron |
| Database backup email | 01:30 daily | `vercel.json` cron |
| WhatsApp queue (send + retry) | every 2 min | only at 21:00 |

### Move-day checklist (Vercel → Railway)

1. **Railway → New project → Deploy from GitHub repo** `Urs-toothfully-1/Urs-toothfully`, branch `main`.
2. **Region:** Settings → Region → **Asia Southeast (Singapore)**, closest to Supabase (Mumbai).
3. **Variables:** copy every Production variable from Vercel → Settings → Environment Variables.
   These must be **identical**:
   - `WHATSAPP_TOKEN_KEY`: decrypts the saved WhatsApp token. A different value stops WhatsApp.
   - `JWT_SECRET`: a different value logs everyone out (they just log in again).
   - `DATABASE_URL`, `DIRECT_URL`, `CRON_SECRET`.

   Also copy whichever exist: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CLINIC_NAME`,
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `SMTP_USER`, `SMTP_APP_PASSWORD`, `SMTP_FROM_NAME`, `BACKUP_EMAIL_TO`,
   `ANTHROPIC_API_KEY`, `CHATBOT_AI_MODEL`, `TURNSTILE_SECRET_KEY`, `WHATSAPP_PROVIDER`,
   `WHATSAPP_CRON_SECRET`, `APP_TIMEZONE`, `SECURE_COOKIES`. Don't copy `VERCEL*` variables.
4. Deploy. The logs should show `[scheduler] started`. Open the `*.up.railway.app` URL, log in,
   open a patient and print a prescription PDF.
5. **Domain:** Railway → Settings → Networking → Custom domain → `urstoothfully.org`, then point the
   DNS record at your registrar to the value Railway shows. Same domain means the Meta webhook,
   Google login and shared links keep working unchanged.
6. **As soon as the domain points to Railway, turn off Vercel's crons**, or the 21:00 jobs run twice:
   Vercel → project → Settings → Cron Jobs → Disable (delete the project once Railway has run fine for a few days).

Keep **1 replica** (`railway.json`): the scheduler remembers its last runs in memory.

 
