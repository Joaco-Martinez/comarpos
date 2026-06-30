-- ComarPOS multi-tenant migration ("init_multitenant")
--
-- IMPORTANT — NOT applied automatically. This file was hand-written (not
-- generated via `prisma migrate dev` per explicit instructions) because the
-- schema diff is large and the existing production database already has
-- rows that need a default Business assigned (legacy "Grupo VJ" data).
--
-- Strategy:
--   1) Create all brand-new tables (Business, Supplier, PurchaseOrder, etc).
--   2) Insert one default Business row representing the existing data
--      ("Grupo VJ", subdomain 'grupovj', status ACTIVE) so existing rows
--      have something to point `businessId` at. This is the ONLY place
--      "Grupo VJ" is referenced, and only as a one-time data backfill, not
--      as hardcoded application logic.
--   3) Add `businessId` columns as NULLABLE to every existing table that
--      needs isolation, backfill them with the default Business id, then
--      add NOT NULL + FK constraints.
--   4) Adjust unique constraints (Product.sku, ArcaConfig.scope, Client.dni,
--      Client.gmail, Remito fullNumber/pointOfSale+number) to be scoped by
--      businessId.
--   5) Add SUPER_ADMIN to the Role enum, make User.businessId nullable
--      (already nullable by design for SUPER_ADMIN users).
--   6) Add Product.ivaPorcentaje / SaleItem.ivaPorcentajeSnapshot with a
--      default of 21 (current hardcoded AFIP rate) so historical data is
--      consistent with what was actually invoiced.
--   7) Migrate Purchase.providerName (free text) into the new Supplier
--      model: for each distinct non-null providerName per (future) business,
--      create a Supplier row and backfill Purchase.supplierId, then drop the
--      providerName column.
--
-- This file documents the full set of DDL statements needed. Review and
-- adapt before running against a real database — table/constraint names
-- assume the existing schema exactly as found in this repo at migration
-- time (see `prisma/migrations/20260629134104_aaaa` as the prior head).
--
-- To apply for real once reviewed (see README at bottom of this file for
-- the exact commands).

-- =====================================================================
-- STEP 0: new enum values / new enums
-- =====================================================================
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

CREATE TYPE "BusinessPlan" AS ENUM ('BASICO', 'PRO', 'ENTERPRISE');
CREATE TYPE "BusinessStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECIBIDA_PARCIAL', 'RECIBIDA_TOTAL', 'CANCELADA');
CREATE TYPE "SupplierAccountMovementType" AS ENUM ('DEBT', 'PAYMENT', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE');
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- =====================================================================
-- STEP 1: Business table + default Business backfill row
-- =====================================================================
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "cuit" TEXT,
    "rubro" TEXT,
    "plan" "BusinessPlan" NOT NULL DEFAULT 'BASICO',
    "status" "BusinessStatus" NOT NULL DEFAULT 'TRIAL',
    "modulosActivos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "fechaAlta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proximoVencimiento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");
CREATE UNIQUE INDEX "Business_subdomain_key" ON "Business"("subdomain");
CREATE INDEX "Business_subdomain_idx" ON "Business"("subdomain");
CREATE INDEX "Business_slug_idx" ON "Business"("slug");
CREATE INDEX "Business_status_idx" ON "Business"("status");

-- One-time data backfill: represent the pre-existing single-tenant data
-- (formerly "Grupo VJ" / "VonKonig") as the first real Business row, so
-- legacy rows can be assigned a businessId. After this migration, Grupo VJ
-- is just a normal Business — nothing in app code references it specially.
INSERT INTO "Business" (id, name, slug, subdomain, status, plan, "updatedAt")
VALUES (gen_random_uuid()::text, 'Grupo VJ', 'grupo-vj', 'grupovj', 'ACTIVE', 'PRO', CURRENT_TIMESTAMP);
-- (capture the id for reuse below via a DO block in a real run; shown here
-- as a placeholder variable :default_business_id for readability)

-- =====================================================================
-- STEP 2: add businessId columns (nullable first), backfill, then NOT NULL
-- =====================================================================
-- Pattern repeated per table. Example for "User":
--   ALTER TABLE "User" ADD COLUMN "businessId" TEXT;
--   UPDATE "User" SET "businessId" = (SELECT id FROM "Business" WHERE slug = 'grupo-vj')
--     WHERE role <> 'SUPER_ADMIN';
--   -- User.businessId stays NULLABLE (SUPER_ADMIN has none) — no NOT NULL added.
--   ALTER TABLE "User" ADD CONSTRAINT "User_businessId_fkey"
--     FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE;
--
-- For all OTHER tables (Product, ProductCategory, Client, Sale, SaleItem,
-- Purchase, PurchaseItem, BusinessLocation, ArcaConfig, InvoiceAfip,
-- Finance, StockMovement, Alert, ProductStats, Remito, Invoice, BoxContent,
-- SalePayment, ProductComponent, CbteCounter, AccountMovement):
--   ALTER TABLE "<Table>" ADD COLUMN "businessId" TEXT;
--   UPDATE "<Table>" SET "businessId" = (SELECT id FROM "Business" WHERE slug = 'grupo-vj');
--   ALTER TABLE "<Table>" ALTER COLUMN "businessId" SET NOT NULL;
--   ALTER TABLE "<Table>" ADD CONSTRAINT "<Table>_businessId_fkey"
--     FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE;
--   CREATE INDEX "<Table>_businessId_idx" ON "<Table>"("businessId");
--
-- See migration_fresh_install.sql in this same folder for the exact
-- CREATE TABLE / ADD COLUMN / FK statements generated by
-- `prisma migrate diff --from-empty` against the final schema — use it as
-- the authoritative column list/types/FK actions, just translated from
-- CREATE TABLE into ALTER TABLE ADD COLUMN form for tables that already
-- exist in production.

-- =====================================================================
-- STEP 3: scoped unique constraints
-- =====================================================================
-- ArcaConfig.scope: drop old single global unique, recreate per-business
-- (the column itself stays unique since 1 business = 1 ArcaConfig row,
-- but ArcaConfig also gets its own businessId unique constraint):
--   ALTER TABLE "ArcaConfig" DROP CONSTRAINT IF EXISTS "ArcaConfig_scope_key";
--   UPDATE "ArcaConfig" SET scope = (SELECT id FROM "Business" WHERE slug = 'grupo-vj');
--   CREATE UNIQUE INDEX "ArcaConfig_scope_key" ON "ArcaConfig"("scope");
--   CREATE UNIQUE INDEX "ArcaConfig_businessId_key" ON "ArcaConfig"("businessId");
--
-- Product.sku: drop global unique, recreate as (businessId, sku):
--   ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_sku_key";
--   CREATE UNIQUE INDEX "Product_businessId_sku_key" ON "Product"("businessId", "sku");
--
-- ProductCategory.slug: same pattern -> (businessId, slug)
-- Client.dni / Client.gmail: same pattern -> (businessId, dni) / (businessId, gmail)
-- Remito.fullNumber (was globally unique) -> (businessId, fullNumber)
-- Remito (pointOfSale, number) (was globally unique) -> (businessId, pointOfSale, number)
-- CbteCounter (ptoVta, cbteTipo) -> (businessId, ptoVta, cbteTipo)
-- InvoiceAfip (puntoVenta, tipoComprobante, numero) -> add businessId to the composite

-- =====================================================================
-- STEP 4: IVA fields
-- =====================================================================
-- ALTER TABLE "Product" ADD COLUMN "ivaPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 21;
-- ALTER TABLE "SaleItem" ADD COLUMN "ivaPorcentajeSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 21;
-- (default of 21 matches what was hardcoded in wsfe-base.service.ts before
-- this change, so historical SaleItems remain consistent.)

-- =====================================================================
-- STEP 5: Supplier model + migrate Purchase.providerName -> Supplier
-- =====================================================================
-- CREATE TABLE "Supplier" (...);  -- see migration_fresh_install.sql
-- ALTER TABLE "Purchase" ADD COLUMN "supplierId" TEXT;
-- INSERT INTO "Supplier" (id, "businessId", name, "updatedAt")
--   SELECT gen_random_uuid()::text, p."businessId", p."providerName", CURRENT_TIMESTAMP
--   FROM (SELECT DISTINCT "businessId", "providerName" FROM "Purchase" WHERE "providerName" IS NOT NULL) p;
-- UPDATE "Purchase" pu SET "supplierId" = s.id
--   FROM "Supplier" s
--   WHERE s."businessId" = pu."businessId" AND s.name = pu."providerName";
-- ALTER TABLE "Purchase" DROP COLUMN "providerName";

-- =====================================================================
-- STEP 6: PurchaseOrder / PurchaseOrderItem / SupplierAccountMovement /
-- CashSession — brand-new tables, no backfill needed.
-- See migration_fresh_install.sql for full CREATE TABLE statements.
-- =====================================================================

-- README — how to actually run this when ready
-- ------------------------------------------------------------------
-- This hand-written file is intentionally NOT wired up as a clean,
-- directly-runnable migration because it depends on per-environment
-- decisions (slug/subdomain for the default Business, whether to keep
-- providerName temporarily, etc). Recommended path once you have a real
-- DATABASE_URL:
--
--   1. Take a full DB backup / snapshot first.
--   2. Run `npx prisma migrate diff --from-url "$DATABASE_URL" \
--        --to-schema-datamodel prisma/schema.prisma --script` to get an
--      accurate diff against your *actual* current database (this
--      repo's hand-written file is a guide, not a guarantee — column
--      order/exact prior migration state may differ slightly).
--   3. Manually insert the "INSERT INTO Business..." backfill step and
--      the "UPDATE ... SET businessId = ..." backfill steps from this
--      file into the generated script, in the right place (after table
--      creation, before NOT NULL/FK constraints are added).
--   4. Run `npx prisma migrate resolve --applied 20260629173445_init_multitenant`
--      after manually applying the reviewed SQL, OR place the reviewed
--      SQL into this exact migration.sql file and run
--      `npx prisma migrate deploy`.
--
-- Do NOT run `npx prisma migrate dev` blindly against production data —
-- it will try to generate its own (likely destructive, since it doesn't
-- know about the Business backfill) migration.
