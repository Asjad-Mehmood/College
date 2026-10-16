# Campus Portal

Discipline and student-affairs management for the college. Modules: **late arrivals** (gate check-in and the
Discipline Office), **discipline violations** and **trips**. New modules get their own section in the sidebar.

The product name lives in `src/lib/app.ts`. The college's own name is set in Settings.

Built with Next.js 16, Prisma 7 and Neon Postgres, and deployed on Vercel.

## What it does

| Screen | Who | Purpose |
| --- | --- | --- |
| **Gate check-in** (`/gate`) | Gate staff, Discipline In-Charge | Type a roll number. The screen shows the student's photo, the month's strike count and minutes late. Choose a reason with keys **1–5** and save with **Enter**. Gate staff can then message the parent on WhatsApp/SMS and print a classroom entry slip. |
| **Dashboard** (`/dashboard`) | In-Charge, Principal | Late today vs yesterday, habitual offenders, lates this month, pending fines, a 30-day trend and a by-program breakdown. |
| **Late records** (`/records`) | In-Charge, Principal | **By month:** a calendar of the month with each day's count (darker = more); pick a month, click a date to see that day's records, then print or export them. **Search & filter:** ledger filtered by date range, program, section, strike level, habitual offenders or unpaid fines. Exports to Excel or CSV and prints to PDF. |
| **Record violation** (`/violations/new`) | In-Charge | Find the student by roll number (shows past violations), choose the violation type (sets severity and suggested fine), enter date, time, place, what happened and who reported it, then the action taken (warning, fine, parent meeting, suspension with days, referral to the Discipline Committee). Then message the parent and print a notice. |
| **Violation register** (`/violations`, `/violations/[id]`) | In-Charge, Principal | The same **By month** calendar to open the cases of any date, plus search and filters (date range, type, severity, program, section, open/closed, unpaid fines), Excel/CSV export and print. Each case page shows the full details and the student's other cases. The In-Charge can mark the fine paid, close the case with a note, reopen, edit or delete it. Printable parent notice on the letterhead, with an acknowledgement slip. |
| **Trips** (`/trips`, `/trips/[id]`) | In-Charge manages; Principal views | Plan a trip (type, destination, dates and times, meeting point, programs allowed, seats, optional fee with deadline — switch it off for college-paid trips — teacher in charge, itinerary, night stay) and add accompanying staff. **Students:** add by roll number or a whole section, listed section by section; blocked if the class isn't eligible, seats are full or the student isn't active; students with an open severe violation need a written reason to be added. Track parent consent and fee paid (with receipt no.), medical notes and emergency phone; send trip notice, consent and fee reminders on WhatsApp. **Transport:** vehicles with driver and seats; choose one bus per section — students who don't fit are held aside, then sent together to an overflow bus; individual seat changes. **Rooms** (night-stay trips): add rooms singly or in bulk (e.g. 10 rooms × 4 beds, hotel/floor, notes), fill rooms section by section without mixing sections, place students by hand, printable room list. **Roll call** on a phone at departure and on return, with a missing list; leaving or closing the trip with anyone unmarked needs a note. Printable parent permission slips, student list and bus lists; Excel export. |
| **Students** (`/students`, `/students/[roll]`) | In-Charge, Principal | **By section** overview (CD1, CD2 … CD 54, in natural order) with counts; open a section to see its students. Full searchable list and discipline profile: late arrivals and violations, unpaid fines from both, call/WhatsApp buttons and a printable warning letter. |
| **Settings** (`/settings`) | In-Charge | Summer/winter timing switch, grace period, escalation thresholds, default fine, violation types (name, severity, default fine, active), Excel/CSV student import and staff accounts. |

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
