-- Add discount fields to supplier_lpo_items table
-- Migration: 0018_add_discount_fields_to_supplier_lpo_items.sql

-- Add discount_percent column
ALTER TABLE supplier_lpo_items 
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0;

-- Add discount_amount column  
ALTER TABLE supplier_lpo_items 
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN supplier_lpo_items.discount_percent IS 'Discount percentage for the LPO item (0-100)';
COMMENT ON COLUMN supplier_lpo_items.discount_amount IS 'Fixed discount amount for the LPO item';
