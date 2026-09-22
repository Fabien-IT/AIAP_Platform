-- Add a nullable reference field used to link ledger transactions to contributions.
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "reference" TEXT;
CREATE INDEX IF NOT EXISTS "Transaction_reference_idx" ON "Transaction"("reference");
