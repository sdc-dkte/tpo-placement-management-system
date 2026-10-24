-- AlterTable
ALTER TABLE "AcademicImportBatch" ADD COLUMN     "processingStartedAt" TIMESTAMP(3),
ADD COLUMN     "processingToken" TEXT;
