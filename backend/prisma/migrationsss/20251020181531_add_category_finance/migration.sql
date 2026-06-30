/*
  Warnings:

  - Changed the type of `category` on the `Finance` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."CategoryFinance" AS ENUM ('AlquilerL1', 'AlquilerF1', 'Alarma', 'Sueldos', 'MateriaPrima', 'Impuestos', 'VEP', 'Contadora', 'Arca', 'Eenvios', 'Publicidad', 'Otro');

-- AlterTable
ALTER TABLE "public"."Finance" DROP COLUMN "category",
ADD COLUMN     "category" "public"."CategoryFinance" NOT NULL;
