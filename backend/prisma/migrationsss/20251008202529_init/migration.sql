/*
  Warnings:

  - Added the required column `category` to the `Client` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clientPrice` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `wholesalePrice` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."CategoryProduct" AS ENUM ('Bombones', 'Alfajores', 'Cajas');

-- CreateEnum
CREATE TYPE "public"."CategoryClient" AS ENUM ('Mayorista', 'Cliente');

-- AlterTable
ALTER TABLE "public"."Client" ADD COLUMN     "category" "public"."CategoryClient" NOT NULL;

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "category" "public"."CategoryProduct" NOT NULL,
ADD COLUMN     "clientPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "wholesalePrice" DOUBLE PRECISION NOT NULL;
