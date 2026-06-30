import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedAdmin() {
  const password = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: {
      email: "admin@comarpos.com",
    },
    update: {
      name: "Administrador",
      role: Role.ADMIN,
      password,
    },
    create: {
      email: "admin@comarpos.com",
      password,
      name: "Administrador",
      role: Role.ADMIN,
    },
  });

  return admin;
}

async function main() {
  console.log("🌱 Iniciando seed...");

  const admin = await seedAdmin();

  console.log("");
  console.log("✅ Seed finalizado correctamente");
  console.log("");
  console.log("🔐 Usuario admin creado/actualizado:");
  console.log(`ID: ${admin.id}`);
  console.log("Email: admin@comarpos.com");
  console.log("Password: admin123");
  console.log("");
}

main()
  .catch((error) => {
    console.error("❌ Error ejecutando seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });