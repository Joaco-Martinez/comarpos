/*
  Warnings:

  - The `from` column on the `StockMovement` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `to` column on the `StockMovement` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `userId` on table `StockMovement` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `type` on the `StockMovement` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."StockMovement" DROP CONSTRAINT "StockMovement_userId_fkey";

-- AlterTable
ALTER TABLE "public"."StockMovement" ALTER COLUMN "userId" SET NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "public"."MovementType" NOT NULL,
DROP COLUMN "from",
ADD COLUMN     "from" "public"."Location",
DROP COLUMN "to",
ADD COLUMN     "to" "public"."Location";

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
