-- CreateEnum
CREATE TYPE "BusinessLocationType" AS ENUM ('BRANCH', 'WAREHOUSE', 'STORE');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('PICKUP', 'LOCAL_DELIVERY', 'TRANSPORT');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('NONE', 'PENDING', 'PREPARING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "addressApartment" TEXT,
ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressFloor" TEXT,
ADD COLUMN     "addressNotes" TEXT,
ADD COLUMN     "addressNumber" TEXT,
ADD COLUMN     "addressPostalCode" TEXT,
ADD COLUMN     "addressProvince" TEXT,
ADD COLUMN     "addressStreet" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "businessLocationId" TEXT,
ADD COLUMN     "declaredValue" DOUBLE PRECISION,
ADD COLUMN     "deliveryAddressSnapshot" TEXT,
ADD COLUMN     "deliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryDistanceKm" DOUBLE PRECISION,
ADD COLUMN     "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'PICKUP',
ADD COLUMN     "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "packagesCount" INTEGER,
ADD COLUMN     "transportCuit" TEXT,
ADD COLUMN     "transportName" TEXT;

-- CreateTable
CREATE TABLE "BusinessLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BusinessLocationType" NOT NULL DEFAULT 'BRANCH',
    "addressStreet" TEXT,
    "addressNumber" TEXT,
    "addressCity" TEXT,
    "addressProvince" TEXT,
    "addressPostalCode" TEXT,
    "addressNotes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessLocation_type_idx" ON "BusinessLocation"("type");

-- CreateIndex
CREATE INDEX "BusinessLocation_isDefault_idx" ON "BusinessLocation"("isDefault");

-- CreateIndex
CREATE INDEX "BusinessLocation_isActive_idx" ON "BusinessLocation"("isActive");

-- CreateIndex
CREATE INDEX "Sale_businessLocationId_idx" ON "Sale"("businessLocationId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessLocationId_fkey" FOREIGN KEY ("businessLocationId") REFERENCES "BusinessLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
