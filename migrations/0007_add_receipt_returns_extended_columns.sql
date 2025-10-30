-- Add extended columns to receipt_returns table
ALTER TABLE "receipt_returns" 
ADD COLUMN IF NOT EXISTS "receipt_number" varchar(64),
ADD COLUMN IF NOT EXISTS "receipt_date" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "received_by" varchar(128),
ADD COLUMN IF NOT EXISTS "expected_date" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "actual_date" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "items_expected" integer,
ADD COLUMN IF NOT EXISTS "items_received" integer,
ADD COLUMN IF NOT EXISTS "discrepancy" varchar(16),
ADD COLUMN IF NOT EXISTS "supplier_name" varchar(255),
ADD COLUMN IF NOT EXISTS "supplier_address" text,
ADD COLUMN IF NOT EXISTS "supplier_contact_person" varchar(255),
ADD COLUMN IF NOT EXISTS "supplier_lpo_number" varchar(64),
ADD COLUMN IF NOT EXISTS "customer_lpo_number" varchar(64),
ADD COLUMN IF NOT EXISTS "total_value" decimal(12, 2) DEFAULT '0',
ADD COLUMN IF NOT EXISTS "supplier_id_display" varchar(64);

-- Update return_number column length to match schema (from 32 to 64)
ALTER TABLE "receipt_returns" 
ALTER COLUMN "return_number" TYPE varchar(64);

-- Update return_reason column to match schema (from 255 to 128)
ALTER TABLE "receipt_returns" 
ALTER COLUMN "return_reason" TYPE varchar(128);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS "idx_receipt_returns_receipt_number" ON "receipt_returns"("receipt_number");

-- Add comments
COMMENT ON COLUMN "receipt_returns"."receipt_number" IS 'Reference to the original goods receipt number';
COMMENT ON COLUMN "receipt_returns"."receipt_date" IS 'Date of the original goods receipt';
COMMENT ON COLUMN "receipt_returns"."supplier_name" IS 'Denormalized supplier name for quick access';
COMMENT ON COLUMN "receipt_returns"."supplier_lpo_number" IS 'Supplier LPO reference number';
COMMENT ON COLUMN "receipt_returns"."customer_lpo_number" IS 'Customer LPO reference number';
