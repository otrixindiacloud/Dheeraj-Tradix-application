-- Remove approval_status column from supplier_lpos table
-- Migration: 0021_remove_approval_status_from_supplier_lpos.sql

-- Drop the approval_status column from supplier_lpos table
ALTER TABLE supplier_lpos DROP COLUMN IF EXISTS approval_status;

-- Drop the index if it exists
DROP INDEX IF EXISTS idx_supplier_lpos_approval_status;

-- Update the comment to reflect the change
COMMENT ON TABLE supplier_lpos IS 'Supplier LPO table without approval status column';
