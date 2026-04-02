-- AlterTable
ALTER TABLE "customer_reviews" ALTER COLUMN "requestSentAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "respondedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "reviewedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "lastCompletedAppointmentAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "nextAppointmentAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "inactiveAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "reactivatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "post_sale_actions" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "customers_barbershopId_postSaleStatus_idx" ON "customers"("barbershopId", "postSaleStatus");

-- CreateIndex
CREATE INDEX "customers_barbershopId_lastCompletedAppointmentAt_idx" ON "customers"("barbershopId", "lastCompletedAppointmentAt");

-- CreateIndex
CREATE INDEX "customers_barbershopId_nextAppointmentAt_idx" ON "customers"("barbershopId", "nextAppointmentAt");

-- RenameForeignKey
ALTER TABLE "customer_reviews" RENAME CONSTRAINT "customer_reviews_appointment_fkey" TO "customer_reviews_appointmentId_fkey";

-- RenameForeignKey
ALTER TABLE "customer_reviews" RENAME CONSTRAINT "customer_reviews_barbershop_fkey" TO "customer_reviews_barbershopId_fkey";

-- RenameForeignKey
ALTER TABLE "customer_reviews" RENAME CONSTRAINT "customer_reviews_customer_fkey" TO "customer_reviews_customerId_fkey";

-- RenameForeignKey
ALTER TABLE "post_sale_actions" RENAME CONSTRAINT "post_sale_actions_appointment_fkey" TO "post_sale_actions_appointmentId_fkey";

-- RenameForeignKey
ALTER TABLE "post_sale_actions" RENAME CONSTRAINT "post_sale_actions_barbershop_fkey" TO "post_sale_actions_barbershopId_fkey";

-- RenameForeignKey
ALTER TABLE "post_sale_actions" RENAME CONSTRAINT "post_sale_actions_customer_fkey" TO "post_sale_actions_customerId_fkey";

-- RenameIndex
ALTER INDEX "customer_reviews_appt_idx" RENAME TO "customer_reviews_appointmentId_idx";

-- RenameIndex
ALTER INDEX "customer_reviews_barbershop_customer_idx" RENAME TO "customer_reviews_barbershopId_customerId_idx";

-- RenameIndex
ALTER INDEX "post_sale_actions_appt_idx" RENAME TO "post_sale_actions_appointmentId_idx";

-- RenameIndex
ALTER INDEX "post_sale_actions_barbershop_customer_idx" RENAME TO "post_sale_actions_barbershopId_customerId_idx";
