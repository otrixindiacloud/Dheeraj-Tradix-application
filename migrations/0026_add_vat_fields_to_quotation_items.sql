-- Add VAT fields to quotation_items table
-- Migration: 0026_add_vat_fields_to_quotation_items.sql

-- Add vat_percent column
ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS vat_percent DECIMAL(5,2);

-- Add vat_amount column  
ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(12,2);

-- Add comments for documentation
COMMENT ON COLUMN quotation_items.vat_percent IS 'VAT percentage for the quotation item (0-100)';
COMMENT ON COLUMN quotation_items.vat_amount IS 'Fixed VAT amount for the quotation item';
