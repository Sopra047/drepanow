import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as path from "node:path";
import bcrypt from "bcryptjs";
import { normalize } from "../src/lib/normalize";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo-drepanow";

async function seedStaffUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.staffUser.upsert({
    where: { email: "admin@drepanow.ai" },
    update: {},
    create: { email: "admin@drepanow.ai", passwordHash, role: "admin" },
  });
  await prisma.staffUser.upsert({
    where: { email: "agent.foumban@minsante.cm" },
    update: {},
    create: { email: "agent.foumban@minsante.cm", passwordHash, role: "sante" },
  });
  console.log(
    `Comptes de démonstration prêts (mot de passe « ${DEMO_PASSWORD} » — à changer avant toute mise en production) :\n` +
      "  - admin@drepanow.ai (Administrateur)\n" +
      "  - agent.foumban@minsante.cm (Utilisateur santé)"
  );
}

async function main() {
  await seedStaffUsers();

  const file = path.join(__dirname, "..", "data", "registre-hraf-foumban.xlsx");
  const wb = XLSX.readFile(file);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

  const ds = normalize(rows, "Drepanow AI - Formulaire de Collecte de Donnees V1.xlsx");

  await prisma.patientRecord.deleteMany({});
  await prisma.importBatch.deleteMany({});

  const batch = await prisma.importBatch.create({
    data: { source: ds.src, rows: ds.rows, inferred: ds.inferred },
  });

  await prisma.patientRecord.createMany({
    data: ds.recs.map((r) => ({
      code: r.code,
      dateTest: r.dateTest,
      dateEnr: r.dateEnr,
      sexe: r.sexe,
      age: r.age,
      quartier: r.quartier,
      localite: r.localite,
      geno: r.geno,
      symp: r.symp,
      contexte: r.contexte,
      hopital: r.hopital,
      atcd: r.atcd,
      batchId: batch.id,
    })),
  });

  console.log(
    `Seed terminé : ${ds.recs.length} fiches exploitables sur ${ds.rows} (${ds.incomplete.length} incomplète(s) exclue(s), ${ds.inferred} localité(s) déduite(s)).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
