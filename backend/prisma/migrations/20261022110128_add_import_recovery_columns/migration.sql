-- AlterTable
ALTER TABLE "AcademicImportBatch" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "ImportBatchStatus" NOT NULL DEFAULT 'PROCESSING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AcademicImportRow" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "rowData" JSONB,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Backfill statuses for historical import batches.
UPDATE "AcademicImportBatch"
SET "status" = CASE
  WHEN "totalRows" > 0
       AND "successfulRows" + "failedRows" = "totalRows"
       AND "failedRows" > 0
    THEN 'COMPLETED_WITH_ERRORS'::"ImportBatchStatus"
  WHEN "totalRows" > 0
       AND "successfulRows" + "failedRows" = "totalRows"
    THEN 'COMPLETED'::"ImportBatchStatus"
  ELSE 'FAILED'::"ImportBatchStatus"
END;
