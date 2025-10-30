-- Add supplier_code column to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_code VARCHAR(100) UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_supplier_code ON suppliers(supplier_code);

