-- Create the batch status enum.
CREATE TYPE "ImportBatchStatus" AS ENUM (
  'PROCESSING',
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED'
);

-- Add row statuses.
ALTER TYPE "ImportRowStatus" ADD VALUE 'PENDING';
ALTER TYPE "ImportRowStatus" ADD VALUE 'PROCESSING';