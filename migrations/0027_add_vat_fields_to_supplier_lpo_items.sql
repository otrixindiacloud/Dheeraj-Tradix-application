-- Add VAT fields to supplier_lpo_items table
-- Migration: 0027_add_vat_fields_to_supplier_lpo_items.sql

-- Add vat_percent column
ALTER TABLE supplier_lpo_items 
ADD COLUMN IF NOT EXISTS vat_percent DECIMAL(5,2) DEFAULT 0;

-- Add vat_amount column  
ALTER TABLE supplier_lpo_items 
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2) DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN supplier_lpo_items.vat_percent IS 'VAT percentage for the LPO item (0-100)';
COMMENT ON COLUMN supplier_lpo_items.vat_amount IS 'Fixed VAT amount for the LPO item';

