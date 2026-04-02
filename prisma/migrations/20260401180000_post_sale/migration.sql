-- Post-sale feature migration

-- Enums
CREATE TYPE "PostSaleStatus" AS ENUM ('RECENTE', 'EM_RISCO', 'INATIVO', 'REATIVADO', 'NAO_CONTATAR');
CREATE TYPE "PostSaleChurnReason" AS ENUM ('SEM_INTERESSE', 'MUDOU_DE_REGIAO', 'PRECO', 'CONCORRENTE', 'ATENDIMENTO_PONTUAL', 'SEM_RETORNO', 'OUTRO');

-- Customers extensions
ALTER TABLE "customers" ADD COLUMN "postSaleStatus" "PostSaleStatus" NOT NULL DEFAULT 'RECENTE';
ALTER TABLE "customers" ADD COLUMN "doNotContact" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "customers" ADD COLUMN "reviewOptOut" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "customers" ADD COLUMN "lastCompletedAppointmentAt" TIMESTAMP;
ALTER TABLE "customers" ADD COLUMN "nextAppointmentAt" TIMESTAMP;
ALTER TABLE "customers" ADD COLUMN "inactiveAt" TIMESTAMP;
ALTER TABLE "customers" ADD COLUMN "reactivatedAt" TIMESTAMP;
ALTER TABLE "customers" ADD COLUMN "churnReason" "PostSaleChurnReason";
ALTER TABLE "customers" ADD COLUMN "preferredProfessionalId" TEXT;

-- New table: post_sale_actions
CREATE TABLE "post_sale_actions" (
    "id" TEXT PRIMARY KEY,
    "barbershopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "actionType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "post_sale_actions_barbershop_fkey" FOREIGN KEY ("barbershopId") REFERENCES "barbershops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "post_sale_actions_customer_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "post_sale_actions_appointment_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "post_sale_actions_barbershop_customer_idx" ON "post_sale_actions" ("barbershopId", "customerId");
CREATE INDEX "post_sale_actions_appt_idx" ON "post_sale_actions" ("appointmentId");

-- New table: customer_reviews
CREATE TABLE "customer_reviews" (
    "id" TEXT PRIMARY KEY,
    "barbershopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "requestStatus" TEXT NOT NULL,
    "requestSentAt" TIMESTAMP,
    "respondedAt" TIMESTAMP,
    "reviewedAt" TIMESTAMP,
    "reviewUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_reviews_barbershop_fkey" FOREIGN KEY ("barbershopId") REFERENCES "barbershops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "customer_reviews_customer_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "customer_reviews_appointment_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "customer_reviews_barbershop_customer_idx" ON "customer_reviews" ("barbershopId", "customerId");
CREATE INDEX "customer_reviews_appt_idx" ON "customer_reviews" ("appointmentId");
