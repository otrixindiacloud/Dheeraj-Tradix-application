-- Add discount fields to quotation_items
ALTER TABLE quotation_items
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2);

ALTER TABLE quotation_items
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2);

COMMENT ON COLUMN quotation_items.discount_percentage IS 'Discount percentage for the quotation item (0-100)';
COMMENT ON COLUMN quotation_items.discount_amount IS 'Fixed discount amount for the quotation item';


