-- Migration: Add goods_receipt_id column to material_receipt table
-- This links material receipts back to their source goods receipt

-- Add the goods_receipt_id column
ALTER TABLE material_receipt 
ADD COLUMN goods_receipt_id UUID REFERENCES goods_receipt_headers(id);

-- Add index for better query performance
CREATE INDEX idx_material_receipt_goods_receipt_id ON material_receipt(goods_receipt_id);

-- Add comment
COMMENT ON COLUMN material_receipt.goods_receipt_id IS 'Foreign key reference to the source goods receipt that this material receipt was created from';
