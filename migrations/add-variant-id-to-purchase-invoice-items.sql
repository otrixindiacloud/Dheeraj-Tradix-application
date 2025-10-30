-- Add variant_id column to purchase_invoice_items table
-- This column is optional and references inventory_variants table

ALTER TABLE purchase_invoice_items 
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES inventory_variants(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_variant_id 
ON purchase_invoice_items(variant_id);

-- Add comment for documentation
COMMENT ON COLUMN purchase_invoice_items.variant_id IS 'Optional reference to inventory variant if item has variants';

