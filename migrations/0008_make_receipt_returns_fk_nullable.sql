-- Make goods_receipt_id and supplier_id nullable in receipt_returns table
-- These fields should be optional as returns can be created without linking to a specific receipt or supplier

ALTER TABLE "receipt_returns" 
ALTER COLUMN "goods_receipt_id" DROP NOT NULL;

ALTER TABLE "receipt_returns" 
ALTER COLUMN "supplier_id" DROP NOT NULL;

-- Add comments explaining why these are nullable
COMMENT ON COLUMN "receipt_returns"."goods_receipt_id" IS 'Optional reference to the original goods receipt. Can be null for returns not linked to a specific receipt.';
COMMENT ON COLUMN "receipt_returns"."supplier_id" IS 'Optional reference to the supplier. Can be null if supplier information is stored in denormalized fields.';
