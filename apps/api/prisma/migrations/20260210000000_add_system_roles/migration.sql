-- CreateTable
CREATE TABLE "SystemRole" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#8b5cf6',
    "canAccessOps" BOOLEAN NOT NULL DEFAULT false,
    "canAccessHq" BOOLEAN NOT NULL DEFAULT false,
    "canAccessKiosk" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemRole_tenantId_name_key" ON "SystemRole"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "SystemRole" ADD CONSTRAINT "SystemRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
