// Demo data for local development: `npm run db:seed`.
// Creates three demo accounts (password "password123"), ~150 students and
// six weeks of late records. Refuses to run against a non-local database
// unless SEED_ALLOW_REMOTE=1, because it adds accounts with known passwords.
import { config } from "dotenv";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import type { LateReason } from "../src/generated/prisma/enums";

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.DB_URL;
if (!url) throw new Error("DB_URL is not set");
const { hostname } = new URL(url);
const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
if (!isLocal && process.env.SEED_ALLOW_REMOTE !== "1") {
  console.error(
    `Refusing to seed ${hostname}: demo accounts have a known password. Set SEED_ALLOW_REMOTE=1 to override.`,
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: isLocal ? new PrismaPg({ connectionString: url }) : new PrismaNeon({ connectionString: url }),
});

function hash(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`;
}

// Deterministic pseudo-random numbers so every seed looks the same.
let state = 42;
function rand() {
  state = (state * 1664525 + 1013904223) % 2 ** 32;
  return state / 2 ** 32;
}
const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];

const FIRST = ["Ali", "Hamza", "Usman", "Bilal", "Ahmed", "Hassan", "Zain", "Saad", "Fahad", "Umar", "Ayesha", "Fatima", "Hira", "Sana", "Maryam", "Zainab", "Iqra", "Noor", "Areeba", "Mahnoor", "Talha", "Abdullah", "Haris", "Danish", "Rabia"];
const LAST = ["Raza", "Khan", "Ahmed", "Malik", "Butt", "Chaudhry", "Sheikh", "Qureshi", "Javed", "Iqbal", "Hussain", "Akhtar", "Mehmood", "Shah", "Abbasi"];
const FATHER_FIRST = ["Muhammad", "Abdul", "Ghulam", "Tariq", "Khalid", "Imran", "Nadeem", "Shahid", "Asif", "Zahid", "Rashid", "Arshad"];
const PROGRAMS = [
  { name: "FSc Pre-Engineering", code: "PE", sections: ["1st Year - A", "1st Year - B", "2nd Year - A"] },
  { name: "FSc Pre-Medical", code: "PM", sections: ["1st Year - A", "2nd Year - A", "2nd Year - B"] },
  { name: "ICS", code: "ICS", sections: ["1st Year - A", "2nd Year - A"] },
  { name: "BSCS", code: "CS", sections: ["Sem 3 - A", "Sem 5 - A"] },
] as const;
const REASONS: LateReason[] = ["TRANSPORT", "TRANSPORT", "TRAFFIC", "TRAFFIC", "MEDICAL", "WEATHER", "NO_EXCUSE", "NO_EXCUSE"];

const TZ = "Asia/Karachi";
function localDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

async function main() {
  await prisma.portalSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, collegeName: "Government Model College", collegeAddress: "Mall Road, Lahore" },
  });

  const users = [
    { username: "admin", fullName: "Prof. Tahir Mehmood", role: "ADMIN" as const },
    { username: "gate", fullName: "Rafiq Ahmed", role: "GATE" as const },
    { username: "principal", fullName: "Dr. Saima Farooq", role: "PRINCIPAL" as const },
  ];
  const created = [];
  for (const u of users) {
    created.push(
      await prisma.user.upsert({
        where: { username: u.username },
        update: {},
        create: { ...u, passwordHash: hash("password123") },
      }),
    );
  }

  const students = [];
  let n = 100;
  for (const program of PROGRAMS) {
    for (const section of program.sections) {
      for (let i = 0; i < 12; i++) {
        n += 1;
        const last = pick(LAST);
        students.push({
          rollNo: `24-${program.code}-${n}`,
          fullName: `${pick(FIRST)} ${last}`,
          fatherName: `${pick(FATHER_FIRST)} ${last}`,
          program: program.name,
          section,
          parentPhone: `03${Math.floor(rand() * 5)}${String(Math.floor(rand() * 1e8)).padStart(8, "0")}`,
          studentPhone: rand() > 0.4 ? `03${Math.floor(rand() * 5)}${String(Math.floor(rand() * 1e8)).padStart(8, "0")}` : null,
        });
      }
    }
  }
  await prisma.student.createMany({ data: students, skipDuplicates: true });

  if ((await prisma.lateRecord.count()) > 0) {
    console.log("Late records already exist; skipped generating history.");
    return;
  }

  // A handful of habitual latecomers plus occasional others.
  const habitual = new Set(students.filter(() => rand() < 0.12).map((s) => s.rollNo));
  const records = [];
  const now = new Date();
  for (let day = 42; day >= 1; day--) {
    const instant = new Date(now.getTime() - day * 86_400_000);
    const ymd = localDate(instant);
    const weekday = new Date(`${ymd}T00:00:00Z`).getUTCDay();
    if (weekday === 0) continue; // Sunday
    for (const s of students) {
      const p = habitual.has(s.rollNo) ? 0.2 : 0.025;
      if (rand() > p) continue;
      const minutesLate = 11 + Math.floor(rand() * rand() * 50);
      // College starts 08:00 PKT (03:00 UTC).
      const arrivedAt = new Date(`${ymd}T03:00:00Z`);
      arrivedAt.setUTCMinutes(minutesLate, Math.floor(rand() * 60));
      const fine = habitual.has(s.rollNo) && rand() < 0.25;
      const held = !fine && habitual.has(s.rollNo) && rand() < 0.35;
      records.push({
        rollNo: s.rollNo,
        lateDate: new Date(`${ymd}T00:00:00Z`),
        arrivedAt,
        minutesLate,
        reason: pick(REASONS),
        actionTaken: fine ? ("FINE" as const) : held ? ("ID_CONFISCATED" as const) : ("VERBAL_WARNING" as const),
        cardStatus: held ? (day > 10 && rand() < 0.7 ? ("RETURNED" as const) : ("HELD" as const)) : ("NONE" as const),
        fineAmount: fine ? 100 : 0,
        finePaid: fine && day > 7 && rand() < 0.6,
        parentNotified: rand() < 0.7,
        recordedById: pick(created.slice(0, 2)).id,
      });
    }
  }
  await prisma.lateRecord.createMany({ data: records, skipDuplicates: true });
  console.log(`Seeded ${students.length} students and ${records.length} late records.`);
  console.log('Demo logins (password "password123"): admin, gate, principal');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
