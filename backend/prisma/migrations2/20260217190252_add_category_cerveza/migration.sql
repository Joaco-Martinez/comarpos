/*
  Warnings:

  - The values [Cerveza] on the enum `CategoryProduct` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."CategoryProduct_new" AS ENUM ('Bombones', 'Alfajores', 'Cajas', 'Chocolates', 'Peluches', 'Cervezas');
ALTER TABLE "public"."Product" ALTER COLUMN "category" TYPE "public"."CategoryProduct_new" USING ("category"::text::"public"."CategoryProduct_new");
ALTER TYPE "public"."CategoryProduct" RENAME TO "CategoryProduct_old";
ALTER TYPE "public"."CategoryProduct_new" RENAME TO "CategoryProduct";
DROP TYPE "public"."CategoryProduct_old";
COMMIT;
