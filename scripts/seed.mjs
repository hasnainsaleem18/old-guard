import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// A few known-scam numbers so the agent's "checkReportedSeller" tool has
// real data to find. In production this table would grow from user reports.
const reported = [
  { number: "03001234567", reports: 7, reason: "Took advance for an iPhone, blocked buyer." },
  { number: "03211234567", reports: 4, reason: "Fake PS5 listing, never delivered." },
  { number: "03451239876", reports: 12, reason: "Repeated bike advance-payment scam." },
];

for (const r of reported) {
  await prisma.reportedNumber.upsert({
    where: { number: r.number },
    update: { reports: r.reports, reason: r.reason },
    create: r,
  });
}

console.log(`Seeded ${reported.length} reported numbers.`);
await prisma.$disconnect();
