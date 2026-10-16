# Campus Portal

Discipline and student-affairs management for the college. The first module handles **late arrivals**
(gate check-in and the Discipline Office). Further modules, such as trip management and discipline violations, will be added
as their own sections.

The product name lives in `src/lib/app.ts`. The college's own name is set in Settings.

Built with Next.js 16, Prisma 7 and Neon Postgres, and deployed on Vercel.

## What it does

| Screen | Who | Purpose |
| --- | --- | --- |
| **Gate check-in** (`/gate`) | Gate staff, Discipline In-Charge | Scan or type a roll number. The screen shows the student's photo, the month's strike count and minutes late. Choose a reason with keys **1–5** and save with **Enter**. Gate staff can then message the parent on WhatsApp/SMS and print a classroom entry slip. |
| **Dashboard** (`/dashboard`) | In-Charge, Principal | Late today vs yesterday, habitual offenders, lates this month, pending fines, a 30-day trend and a by-program breakdown. |
| **Late records** (`/records`) | In-Charge, Principal | Searchable ledger filtered by date range, program, section, strike level, habitual offenders or unpaid fines. Exports to Excel or CSV and prints to PDF. |
| **Students** (`/students`, `/students/[roll]`) | In-Charge, Principal | Student directory and discipline profile, with call/WhatsApp buttons, full history and a printable warning letter. |
| **Settings** (`/settings`) | In-Charge | Summer/winter timing switch, grace period, escalation thresholds, default fine, Excel/CSV student import and staff accounts. |

The **escalation engine** colours every count by level, and each level also gets an icon and a label:
below the habitual threshold → verbal warning; the habitual threshold (default 3) → written warning;
the critical threshold (default 5) → fine or parent meeting. Thresholds are set in Settings.

Notes:

- Times are calculated on the server in the college timezone (default `Asia/Karachi`), so device clocks don't matter.
- A student can be logged late at most once per day.
- Parent messages open WhatsApp or the SMS app with the text pre-filled. No paid gateway is needed.

## Setup

1. Set `DB_URL` to your Neon connection string, in Vercel and in `.env.local` locally (see `.env.example`).
2. Deploy. `vercel-build` runs `prisma migrate deploy` before building, which creates the tables.
3. Open the site and follow **Set up the portal** to create the Discipline In-Charge account. This only works
   while no accounts exist.
4. In **Settings**, import the student list. Use the
   [template](public/student-import-template.csv) as a guide. Headers are matched loosely, so `Roll No`,
   `roll_no` and `Student ID` all work. Then add accounts for gate staff and the Principal.

## Local development

```bash
npm install
npm run db:migrate      # apply migrations to DB_URL
npm run db:seed         # optional demo data — local databases only
npm run dev
```

The seed creates `admin`, `gate` and `principal` accounts, all with the password `password123`, plus about 120
students and six weeks of history. It refuses to run against a non-local database.

`DB_URL` may also point to a local Postgres (`localhost`/`127.0.0.1`). The app then connects over TCP
instead of Neon's WebSocket driver.

| Script | |
| --- | --- |
| `npm run db:migrate` | Create/apply a migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply pending migrations (what Vercel runs) |
| `npm run db:studio` | Browse the database |
| `npm run db:seed` | Load demo data |
