-- Add tax and discount fields to goods_receipt_items table
-- This migration adds the missing fields needed for proper purchase invoice generation

-- Add tax and discount fields to goods_receipt_items table
ALTER TABLE goods_receipt_items 
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS discount_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0.00;

-- Add comments for documentation
COMMENT ON COLUMN goods_receipt_items.tax_rate IS 'Tax rate percentage (e.g., 10.00 for 10%)';
COMMENT ON COLUMN goods_receipt_items.tax_amount IS 'Calculated tax amount based on net amount';
COMMENT ON COLUMN goods_receipt_items.discount_rate IS 'Discount rate percentage (e.g., 5.00 for 5%)';
COMMENT ON COLUMN goods_receipt_items.discount_amount IS 'Calculated discount amount based on gross amount';

-- Update existing records to have default values
UPDATE goods_receipt_items 
SET 
  tax_rate = 0.00,
  tax_amount = 0.00,
  discount_rate = 0.00,
  discount_amount = 0.00
WHERE 
  tax_rate IS NULL OR 
  tax_amount IS NULL OR 
  discount_rate IS NULL OR 
  discount_amount IS NULL;
