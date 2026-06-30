import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.invoiceAfip.deleteMany({
    where: {
      numero: {
        gte: 67,
      },
    },
  });

  console.log(`🧾 Facturas eliminadas: ${result.count}`);
}

main()
  .catch((e) => {
    console.error("❌ Error al borrar facturas:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
