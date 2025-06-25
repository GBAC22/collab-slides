/*
  Warnings:

  - Added the required column `slideType` to the `Slide` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Slide" ADD COLUMN     "bulletPoints" JSONB,
ADD COLUMN     "data" JSONB,
ADD COLUMN     "imagePrompt" TEXT,
ADD COLUMN     "slideType" TEXT NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;
