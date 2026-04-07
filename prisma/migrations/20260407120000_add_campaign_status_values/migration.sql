-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'GENERATING';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- AlterTable: add credits column to ai_call_logs
ALTER TABLE "ai_call_logs" ADD COLUMN IF NOT EXISTS "credits" INTEGER NOT NULL DEFAULT 1;
