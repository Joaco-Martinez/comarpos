import "../config/timezone";
// src/scripts/renovarTokenAfip.ts
import "dotenv/config";
import prisma from "../prisma";
import { generarTokenAFIP } from "../afip/wsaa.service";

async function main() {
  console.log("🔑 Iniciando renovación de token AFIP desde Railway Cron...");

  await generarTokenAFIP();

  console.log("✅ Token AFIP renovado correctamente.");

  await prisma.$disconnect();

  process.exit(0);
}

main().catch(async (error) => {
  console.error("❌ Error renovando token AFIP desde Railway Cron:", error);

  await prisma.$disconnect();

  process.exit(1);
});