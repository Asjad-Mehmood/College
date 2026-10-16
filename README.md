# Campus Portal

Discipline and student-affairs management for the college. Modules: **late arrivals** (gate check-in and the
Discipline Office), **discipline violations** and **trips**. New modules get their own section in the sidebar.

The product name lives in `src/lib/app.ts`. The college's own name is set in Settings.

Built with Next.js 16, Prisma 7 and Neon Postgres, and deployed on Vercel.

## What it does

| Screen | Who | Purpose |
| --- | --- | --- |
| **Gate check-in** (`/gate`) | Gate staff, Discipline In-Charge | Type a roll number, or part of a name or number, and pick from the live matches. The screen shows the student's photo, the month's strike count and minutes late. Choose a reason with keys **1–5** and save with **Enter**. The student card shows their recent lates. Gate staff can then message the parent on WhatsApp/SMS and print a classroom entry slip. The "Logged today" list shows totals, habitual count, average lateness and top reasons, with reprint pass and undo for mistaken entries. |
| **Dashboard** (`/dashboard`) | In-Charge, Principal | Greeting and quick actions (gate, record violation, find a student, late records, trips, sports); **Needs attention** list (open serious cases, cases open over a week, habitual late-comers, trips leaving within 7 days with consent or fees pending, unpaid fines); college overview (students by shift, violations, trips, sports events); lates by weekday, by section and by reason. Late today vs yesterday, habitual offenders, lates this month, pending fines, a 30-day trend and a by-program breakdown. |
| **Late records** (`/records`) | In-Charge, Principal | **By month:** a calendar of the month with each day's count (darker = more); pick a month, click a date to see that day's records, then print or export them (the day header also shows which sections they came from). Below: month figures (late arrivals, students, habitual, average minutes late, unpaid fines), the students late most often this month and a breakdown of reasons. **Search & filter:** one-tap range chips (today, yesterday, 7 days, month, all time) plus a ledger filtered by date range, program, section, strike level, habitual offenders or unpaid fines. Exports to Excel or CSV and prints to PDF. |
| **Record violation** (`/violations/new`) | In-Charge | Find the student by roll number (shows past violations) — add **several students for one incident** (each gets their own case, linked together; more can be added later from the case page, and closing can close the whole incident), choose the violation type (sets severity and suggested fine), enter date, time, place, what happened and who reported it, then the action taken (warning, fine, parent meeting, suspension with days, referral to the Discipline Committee). Then message the parent and print a notice. |
| **Violation register** (`/violations`, `/violations/[id]`) | In-Charge, Principal | The same **By month** calendar to open the cases of any date, followed by month figures (cases, minor/major/severe, unpaid fines), an **open cases** work list (oldest first, days open), **repeat offenders** and a by-type breakdown; one-tap range chips on the search view; plus search and filters (date range, type, severity, program, section, open/closed, unpaid fines), Excel/CSV export and print; filter by shift. Each case page shows the full details and the student's other cases. The In-Charge can mark the fine paid, close the case with a note (optionally attaching the student's application or undertaking), reopen, edit or delete it. **Documents** on each case: upload, view, download or remove applications, undertakings and parent letters (PDF, photo or Word, up to 3.5 MB; stored in the database). Printable letters on the letterhead: parent notice (with acknowledgement slip), **warning letter**, **show-cause notice** (with reply space and a 3-day deadline), **undertaking** (student and parent sign) and, for suspensions, a **suspension order** with the return date. The wording can be edited on screen before printing. |
| **Trips** (`/trips`, `/trips/[id]`) | In-Charge manages; Principal views | **All trips:** totals (upcoming trips, students going, consent pending, fees outstanding), Upcoming / On a trip now / Past / All tabs with search, countdown and a to-do strip on each card (consent, fees, transport), past trips as a table. **Plan a trip** shows a live summary beside the form (duration, eligible students, fee total, warnings such as return before departure or deadlines after departure). **Trip page:** header with countdown and key figures (students, consent, fees, transport, rooms — each opens its tab), icon tabs, one Print menu, a **Next steps** checklist (students → consent → fees → staff → vehicles → rooms → roll call) and the itinerary as a timeline. Plan a trip (type, destination, dates and times, meeting point, programs allowed, seats, optional fee with deadline — switch it off for college-paid trips — teacher in charge, itinerary, night stay) and add accompanying staff. **Students:** add by roll number or a whole section, listed section by section; blocked if the class isn't eligible, seats are full or the student isn't active; students with an open severe violation need a written reason to be added. Track parent consent and fee paid (with receipt no.), medical notes and emergency phone; send trip notice, consent and fee reminders on WhatsApp. **Transport:** vehicles with driver and seats; choose one bus per section — students who don't fit are held aside, then sent together to an overflow bus; individual seat changes. **Rooms** (night-stay trips): add rooms singly or in bulk (e.g. 10 rooms × 4 beds, hotel/floor, notes), fill rooms section by section without mixing sections, place students by hand, printable room list. **Roll call** on a phone at departure and on return, with a missing list; leaving or closing the trip with anyone unmarked needs a note. Printable parent permission slips, student list and bus lists; Excel export. |
| **Sports** (`/sports`, `/sports/events/[id]`, `/sports/teams/[id]`, `/sports/trials`) | In-Charge manages; Principal views | Create a **sports event** (e.g. Annual Sports Week), add **sports** to it (Badminton, Cricket…), then open a sport and pick its **players from the whole college** by searching name or roll number. Per team: manager, captain/vice-captain, jersey number, position, status, medical note, WhatsApp notice (no parent consent needed); students with an open severe violation need a written reason. The sport list is managed on the same page. **Trials** (by sport): mark candidates selected / waitlist / not selected and move them into the event's team. Achievements show on student profiles; printable team sheet. |
| **Students** (`/students`, `/students/[roll]`) | In-Charge, Principal | **Sections are created first** with the **Add section** button (a dialog: name, 1st/2nd year and **morning/evening shift** — students take their section's shift, so the gate measures lateness against the right start time); adding a student then picks the section from a dropdown. The **Programs** button opens a dialog to add or remove programs. The **By section** overview shows summary figures and groups sections by year with counts (CD1, CD2 … CD 54, in natural order); the overview shows totals per year and average class size, can be filtered by year, and each section card shows its size and program mix. A section page has previous/next section links, program and status filters with counts, search within the section, add student, a printable **class list**, Excel export, and rename / change year. Programs (Medical, ICS, DIT, I.Com, FA by default) are a managed list too, chosen from a dropdown. Search the list live by name, father's name, phone or any part of the roll number (typing `114` finds 24-PE-114; the gate and other lookups also accept just the last digits). Full searchable list and discipline profile: late arrivals and violations, unpaid fines from both, call/WhatsApp buttons and a printable warning letter. |
| **General audit** (`/audit`) | In-Charge, Principal | Nothing is listed until you search: roll number (even the last digits), name, father's name or phone. An exact roll number opens the audit straight away; otherwise click a match. The audit is a large popup with the student's profile and contact buttons on the side and tabs for **Overview** (alerts, key figures, 12-month late trend, recent activity), **Late arrivals**, **Violations** (full case details), **Fines** (paid vs outstanding from lates and violations), **Trips** (consent, fee, roll call), **Sports** (teams and achievements) and a full **Timeline**. |
| **Settings** (`/settings`) | In-Charge | **Morning and evening shifts**, each with its own summer and winter start time; one summer/winter switch for both, grace period, escalation thresholds, default fine, violation types (name, severity, default fine, active), Excel/CSV student import and staff accounts. Everyone **signs in with their email**; accounts made before email sign-in keep working with their old username and show “No email yet” in Settings — use **Set email** to switch them over. |

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
3. Open the site and follow **Set up the portal** to create the Discipline In-Charge account (signs in with email). This only works
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

The seed creates `admin@college.edu.pk`, `gate@college.edu.pk` and `principal@college.edu.pk` accounts, all with the password `password123`, plus about 120
students and six weeks of history. It refuses to run against a non-local database.

`DB_URL` may also point to a local Postgres (`localhost`/`127.0.0.1`). The app then connects over TCP
instead of Neon's WebSocket driver.

| Script | |
| --- | --- |
| `npm run db:migrate` | Create/apply a migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply pending migrations (what Vercel runs) |
| `npm run db:studio` | Browse the database |
| `npm run db:seed` | Load demo data |
