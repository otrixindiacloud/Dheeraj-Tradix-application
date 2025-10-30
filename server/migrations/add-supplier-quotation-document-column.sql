-- Add supplier_quotation_document column to supplier_quotes table
-- This migration adds a new column to store supplier quotation documents

ALTER TABLE supplier_quotes 
ADD COLUMN IF NOT EXISTS supplier_quotation_document TEXT;

-- Add comment to the column
COMMENT ON COLUMN supplier_quotes.supplier_quotation_document IS 'File path or URL to supplier''s quotation document';
