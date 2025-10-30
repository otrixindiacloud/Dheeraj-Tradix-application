-- Update purchase invoice items table to have better default values for tax and discount fields
-- This migration ensures that discount and tax values are properly handled

-- Update default values for tax and discount fields
ALTER TABLE purchase_invoice_items 
ALTER COLUMN tax_rate SET DEFAULT 10.00,
ALTER COLUMN tax_amount SET DEFAULT 0.00,
ALTER COLUMN discount_rate SET DEFAULT 5.00,
ALTER COLUMN discount_amount SET DEFAULT 0.00;

-- Update existing records that have zero values to have default discount and tax rates
-- Only update records where the values are exactly 0 (not NULL)
UPDATE purchase_invoice_items 
SET 
  tax_rate = 10.00,
  discount_rate = 5.00
WHERE 
  tax_rate = 0.00 AND 
  discount_rate = 0.00 AND
  quantity > 0 AND
  unit_price > 0;

-- Recalculate tax and discount amounts for updated records
UPDATE purchase_invoice_items 
SET 
  tax_amount = ROUND((quantity * unit_price - discount_amount) * tax_rate / 100, 2),
  discount_amount = ROUND(quantity * unit_price * discount_rate / 100, 2)
WHERE 
  tax_rate = 10.00 AND 
  discount_rate = 5.00 AND
  quantity > 0 AND
  unit_price > 0;

-- Add comments for documentation
COMMENT ON COLUMN purchase_invoice_items.tax_rate IS 'Tax rate percentage (e.g., 10.00 for 10%)';
COMMENT ON COLUMN purchase_invoice_items.tax_amount IS 'Calculated tax amount based on net amount';
COMMENT ON COLUMN purchase_invoice_items.discount_rate IS 'Discount rate percentage (e.g., 5.00 for 5%)';
COMMENT ON COLUMN purchase_invoice_items.discount_amount IS 'Calculated discount amount based on gross amount';
