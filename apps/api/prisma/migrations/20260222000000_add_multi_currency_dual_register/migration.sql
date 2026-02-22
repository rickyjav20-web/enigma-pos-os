-- Migration: Multi-Currency + Dual Cash Register Support
-- Adds Currency model + new fields to RegisterSession, CashTransaction, PurchaseOrder

-- 1. Currency table
CREATE TABLE "Currency" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "code"         TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "symbol"       TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isBase"       BOOLEAN NOT NULL DEFAULT false,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Currency_tenantId_code_key" ON "Currency"("tenantId", "code");

ALTER TABLE "Currency" ADD CONSTRAINT "Currency_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. RegisterSession new fields
ALTER TABLE "RegisterSession"
    ADD COLUMN IF NOT EXISTS "registerType"      TEXT NOT NULL DEFAULT 'PHYSICAL',
    ADD COLUMN IF NOT EXISTS "linkedSessionId"   TEXT,
    ADD COLUMN IF NOT EXISTS "startingBreakdown" JSONB,
    ADD COLUMN IF NOT EXISTS "declaredBreakdown" JSONB;

-- 3. CashTransaction new fields
ALTER TABLE "CashTransaction"
    ADD COLUMN IF NOT EXISTS "currency"     TEXT DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS "amountLocal"  DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "exchangeRate" DOUBLE PRECISION;

-- 4. PurchaseOrder new fields
ALTER TABLE "PurchaseOrder"
    ADD COLUMN IF NOT EXISTS "currency"          TEXT DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS "totalAmountLocal"  DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "exchangeRate"      DOUBLE PRECISION;
