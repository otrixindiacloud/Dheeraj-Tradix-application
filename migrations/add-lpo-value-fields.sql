-- Add LPO value and currency fields to goods_receipt_headers table
-- This migration adds the missing lpoValue and lpoCurrency fields

-- Add lpoValue column
ALTER TABLE goods_receipt_headers 
ADD COLUMN IF NOT EXISTS lpo_value DECIMAL(12,2);

-- Add lpoCurrency column  
ALTER TABLE goods_receipt_headers 
ADD COLUMN IF NOT EXISTS lpo_currency VARCHAR(10) DEFAULT 'BHD';

-- Update existing records to populate lpoValue from joined supplier_lpos table
-- This will copy the totalAmount from the related LPO to the lpoValue field
UPDATE goods_receipt_headers 
SET lpo_value = supplier_lpos.total_amount,
    lpo_currency = COALESCE(supplier_lpos.currency, 'BHD')
FROM supplier_lpos 
WHERE goods_receipt_headers.supplier_lpo_id = supplier_lpos.id 
  AND goods_receipt_headers.lpo_value IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN goods_receipt_headers.lpo_value IS 'LPO value for reference - copied from supplier_lpos.total_amount';
COMMENT ON COLUMN goods_receipt_headers.lpo_currency IS 'LPO currency - copied from supplier_lpos.currency';
