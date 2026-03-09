-- CreateTable
CREATE TABLE IF NOT EXISTS "TableFlowConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "preset" TEXT NOT NULL DEFAULT 'standard',
    "reviewThresholdMin" INTEGER NOT NULL DEFAULT 10,
    "urgencyWarningMin" INTEGER NOT NULL DEFAULT 30,
    "tableTurnTargetMin" INTEGER NOT NULL DEFAULT 60,
    "staleTicketAlertMin" INTEGER NOT NULL DEFAULT 20,
    "kdsPrepTimeWarningMin" INTEGER NOT NULL DEFAULT 15,
    "autoRefreshSec" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableFlowConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TableFlowConfig_tenantId_key" ON "TableFlowConfig"("tenantId");

-- AddForeignKey
ALTER TABLE "TableFlowConfig" ADD CONSTRAINT "TableFlowConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
