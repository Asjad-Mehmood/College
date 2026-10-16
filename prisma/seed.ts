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
// Section codes like the college uses (CD1, CD2, …).
const PROGRAMS = [
  { name: "FSc Pre-Engineering", code: "PE", sections: ["CD1", "CD2", "CD3"] },
  { name: "FSc Pre-Medical", code: "PM", sections: ["CD4", "CD5", "CD6"] },
  { name: "ICS", code: "ICS", sections: ["CD7", "CD8"] },
  { name: "BSCS", code: "CS", sections: ["CD 54", "CD 55"] },
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

  await prisma.program.createMany({ data: PROGRAMS.map((p) => ({ name: p.name })), skipDuplicates: true });
  await prisma.section.createMany({
    data: PROGRAMS.flatMap((p) => p.sections.map((name, i) => ({ name, year: i % 2 === 0 ? ("FIRST" as const) : ("SECOND" as const) }))),
    skipDuplicates: true,
  });

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

  await seedViolations(students.map((s) => s.rollNo), created[0].id);
  await seedTrips(created[0].id);

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
      const written = !fine && habitual.has(s.rollNo) && rand() < 0.35;
      records.push({
        rollNo: s.rollNo,
        lateDate: new Date(`${ymd}T00:00:00Z`),
        arrivedAt,
        minutesLate,
        reason: pick(REASONS),
        actionTaken: fine ? ("FINE" as const) : written ? ("WRITTEN_WARNING" as const) : ("VERBAL_WARNING" as const),
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

const INCIDENTS: Record<string, string[]> = {
  "Uniform / dress code": ["Came without college uniform.", "Not wearing the college ID card and blazer."],
  "Mobile phone in class": ["Using mobile phone during the lecture.", "Phone rang in class; was on social media."],
  "Bunking class": ["Found in the canteen during the 3rd period.", "Left college after the 2nd period without permission."],
  "Littering / smoking on campus": ["Caught smoking behind the science block."],
  "Misbehaviour with staff": ["Argued rudely with the lab attendant."],
  "Damage to college property": ["Wrote on the classroom desk and wall."],
  "Unfair means in exam": ["Found with written notes during the monthly test."],
  "Fighting / violence": ["Got into a fight with a classmate in the ground."],
};

async function seedViolations(rolls: string[], adminId: number) {
  if ((await prisma.violation.count()) > 0) return;
  const types = await prisma.violationType.findMany();
  if (types.length === 0) return;
  const data = [];
  for (let i = 0; i < 28; i++) {
    const type = pick(types.filter((t) => INCIDENTS[t.name]));
    const day = Math.floor(rand() * 40);
    const ymd = localDate(new Date(Date.now() - day * 86_400_000));
    const severe = type.severity === "SEVERE";
    const action = severe
      ? pick(["SUSPENSION", "PARENT_MEETING", "REFERRED_TO_COMMITTEE"] as const)
      : type.severity === "MAJOR"
        ? pick(["WRITTEN_WARNING", "FINE", "PARENT_CALLED"] as const)
        : pick(["VERBAL_WARNING", "VERBAL_WARNING", "WRITTEN_WARNING", "FINE"] as const);
    const fine = action === "FINE" ? Math.max(200, Number(type.defaultFineAmount)) : 0;
    data.push({
      rollNo: i < 6 ? rolls[i % 3] : pick(rolls),
      typeId: type.id,
      severity: type.severity,
      incidentDate: new Date(`${ymd}T00:00:00Z`),
      incidentTime: `${String(9 + Math.floor(rand() * 5)).padStart(2, "0")}:${pick(["05", "20", "35", "50"])}`,
      location: pick(["Classroom", "Canteen", "Corridor", "Ground", "Laboratory"]),
      description: pick(INCIDENTS[type.name]),
      reportedBy: pick(["Prof. Asif (Physics)", "Ms. Nadia (English)", "Mr. Kamran (Chemistry)", "Gate staff"]),
      actionTaken: action,
      suspensionDays: action === "SUSPENSION" ? 3 : null,
      fineAmount: fine,
      finePaid: fine > 0 && day > 10,
      parentNotified: rand() < 0.7,
      status: day > 14 ? ("CLOSED" as const) : ("OPEN" as const),
      closedAt: day > 14 ? new Date() : null,
      closingNote: day > 14 ? "Parent met the Discipline In-Charge; undertaking signed." : null,
      recordedById: adminId,
    });
  }
  await prisma.violation.createMany({ data });
  console.log(`Seeded ${data.length} violations.`);
}

async function seedTrips(adminId: number) {
  if ((await prisma.trip.count()) > 0) return;
  const day = (offset: number) => new Date(`${localDate(new Date(Date.now() + offset * 86_400_000))}T00:00:00Z`);

  const upcoming = await prisma.trip.create({
    data: {
      title: "Study tour to Lahore Museum & Badshahi Mosque",
      type: "STUDY_TOUR",
      destination: "Lahore Museum, Mall Road and Badshahi Mosque",
      purpose: "History and Pakistan Studies field visit for first-year students.",
      itinerary: "08:00 Depart college\n09:30 Lahore Museum guided tour\n12:30 Lunch\n14:00 Badshahi Mosque & Fort\n17:00 Return",
      departDate: day(9),
      departTime: "08:00",
      returnDate: day(9),
      returnTime: "17:30",
      meetingPoint: "College main gate",
      programs: ["FSc Pre-Engineering", "ICS"],
      seats: 45,
      feeAmount: 800,
      feeDeadline: day(5),
      consentDeadline: day(5),
      inChargeName: "Prof. Asif Mehmood",
      inChargePhone: "03001234567",
      createdById: adminId,
      staff: { create: [{ name: "Ms. Nadia Iqbal", phone: "03211234567", role: "Female staff escort" }, { name: "Mr. Kamran Ali", role: "Assistant" }] },
      vehicles: { create: [{ name: "Coaster LEA-1234", driverName: "Muhammad Rafiq", driverPhone: "03331112233", seats: 26 }, { name: "Coaster LEB-5678", driverName: "Ghulam Abbas", seats: 26 }] },
    },
    include: { vehicles: true },
  });
  const pool = await prisma.student.findMany({
    where: { program: { in: ["FSc Pre-Engineering", "ICS"] }, status: "ACTIVE" },
    orderBy: { rollNo: "asc" },
    take: 32,
  });
  let i = 0;
  for (const s of pool) {
    i += 1;
    await prisma.tripParticipant.create({
      data: {
        tripId: upcoming.id,
        rollNo: s.rollNo,
        consent: i % 4 === 0 ? "PENDING" : i % 13 === 0 ? "REFUSED" : "RECEIVED",
        feePaid: i % 3 === 0 ? 0 : 800,
        receiptNo: i % 3 === 0 ? null : `TR-${1000 + i}`,
        vehicleId: i <= 20 ? upcoming.vehicles[0].id : null,
        medicalNotes: i === 5 ? "Asthma — carries inhaler" : null,
      },
    });
  }

  const past = await prisma.trip.create({
    data: {
      title: "Industrial visit to Nestlé factory",
      type: "INDUSTRIAL_VISIT",
      destination: "Nestlé Pakistan, Sheikhupura Road",
      departDate: day(-20),
      departTime: "08:30",
      returnDate: day(-20),
      returnTime: "15:00",
      programs: ["BSCS"],
      seats: 30,
      feeAmount: 0,
      inChargeName: "Mr. Kamran Ali",
      status: "RETURNED",
      departedAt: new Date(Date.now() - 20 * 86_400_000),
      returnedAt: new Date(Date.now() - 20 * 86_400_000 + 6 * 3_600_000),
      createdById: adminId,
    },
  });
  const bscs = await prisma.student.findMany({ where: { program: "BSCS" }, take: 18, orderBy: { rollNo: "asc" } });
  for (const [n, s] of bscs.entries()) {
    const went = n !== 4;
    await prisma.tripParticipant.create({
      data: {
        tripId: past.id,
        rollNo: s.rollNo,
        consent: "RECEIVED",
        departedAt: went ? past.departedAt : null,
        returnedAt: went ? past.returnedAt : null,
      },
    });
  }
  console.log("Seeded 2 trips.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
