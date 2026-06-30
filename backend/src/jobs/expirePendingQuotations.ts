import "../config/timezone";
import "dotenv/config";
import prisma from "../prisma";
import { saleService } from "../services/sale.service";

async function main() {
  const limit = Number(process.env.EXPIRE_QUOTATIONS_LIMIT ?? 100);

  console.log("[expirePendingQuotations] Iniciando job...");
  console.log(`[expirePendingQuotations] Límite: ${limit}`);

  const result = await saleService.expirePendingQuotations(limit);

  console.log("[expirePendingQuotations] Resultado:");
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error("[expirePendingQuotations] Error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });