-- Add discount and VAT fields to supplier_quote_items
ALTER TABLE supplier_quote_items
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0;

ALTER TABLE supplier_quote_items
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;

ALTER TABLE supplier_quote_items
ADD COLUMN IF NOT EXISTS vat_percent DECIMAL(5,2) DEFAULT 0;

ALTER TABLE supplier_quote_items
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN supplier_quote_items.discount_percent IS 'Discount percentage for the supplier quote item (0-100)';
COMMENT ON COLUMN supplier_quote_items.discount_amount IS 'Fixed discount amount for the supplier quote item';
COMMENT ON COLUMN supplier_quote_items.vat_percent IS 'VAT percentage for the supplier quote item (0-100)';
COMMENT ON COLUMN supplier_quote_items.vat_amount IS 'Fixed VAT amount for the supplier quote item';
