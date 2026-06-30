/*
  Warnings:

  - The values [Cliente] on the enum `CategoryClient` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CategoryClient_new" AS ENUM ('Price', 'Mayorista');
ALTER TABLE "public"."Client" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN "category" TYPE "CategoryClient_new" USING ("category"::text::"CategoryClient_new");
ALTER TYPE "CategoryClient" RENAME TO "CategoryClient_old";
ALTER TYPE "CategoryClient_new" RENAME TO "CategoryClient";
DROP TYPE "public"."CategoryClient_old";
ALTER TABLE "Client" ALTER COLUMN "category" SET DEFAULT 'Price';
COMMIT;
