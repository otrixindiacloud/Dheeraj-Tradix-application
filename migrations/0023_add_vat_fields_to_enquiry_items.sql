-- Add VAT columns to enquiry_items table
-- Migration: 0023_add_vat_fields_to_enquiry_items.sql

-- Add vat_percent column
ALTER TABLE enquiry_items 
ADD COLUMN IF NOT EXISTS vat_percent DECIMAL(5,2);

-- Add vat_amount column  
ALTER TABLE enquiry_items 
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2);

-- Add comment for documentation
COMMENT ON COLUMN enquiry_items.vat_percent IS 'VAT percentage for the enquiry item (0-100)';
COMMENT ON COLUMN enquiry_items.vat_amount IS 'Fixed VAT amount for the enquiry item';
