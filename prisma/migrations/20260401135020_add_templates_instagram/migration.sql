-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "instagramPostId" TEXT,
ADD COLUMN     "templateId" TEXT,
ALTER COLUMN "channel" SET DEFAULT 'instagram';

-- AlterTable
ALTER TABLE "integrations" ADD COLUMN     "instagramBusinessId" TEXT,
ADD COLUMN     "instagramPageAccessToken" TEXT,
ADD COLUMN     "instagramPageId" TEXT;

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'post',
    "imageUrl" TEXT NOT NULL,
    "thumbUrl" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "barbershops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
