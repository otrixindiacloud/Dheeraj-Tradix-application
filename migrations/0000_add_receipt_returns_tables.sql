-- Create receipt_returns table (header table)
CREATE TABLE IF NOT EXISTS "receipt_returns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "return_number" varchar(255) NOT NULL UNIQUE,
  "goods_receipt_id" uuid REFERENCES "goods_receipts"("id"),
  "supplier_id" uuid REFERENCES "suppliers"("id"),
  "return_date" timestamp NOT NULL,
  "return_reason" text NOT NULL,
  "status" varchar(50) DEFAULT 'Draft',
  "total_return_value" decimal(12, 2) DEFAULT '0',
  "debit_note_number" varchar(255),
  "debit_note_generated" boolean DEFAULT false,
  "notes" text,
  "created_by" varchar(255),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create receipt_returns_items table (lines table)
CREATE TABLE IF NOT EXISTS "receipt_returns_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "receipt_return_id" uuid NOT NULL REFERENCES "receipt_returns"("id") ON DELETE CASCADE,
  "item_id" uuid REFERENCES "inventory_items"("id"),
  "item_description" text NOT NULL,
  "quantity_returned" integer NOT NULL,
  "unit_cost" decimal(10, 2) NOT NULL,
  "total_cost" decimal(12, 2) NOT NULL,
  "return_reason" text NOT NULL,
  "condition_notes" text,
  "serial_no" integer,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_receipt_returns_return_number" ON "receipt_returns"("return_number");
CREATE INDEX IF NOT EXISTS "idx_receipt_returns_goods_receipt_id" ON "receipt_returns"("goods_receipt_id");
CREATE INDEX IF NOT EXISTS "idx_receipt_returns_supplier_id" ON "receipt_returns"("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_receipt_returns_status" ON "receipt_returns"("status");
CREATE INDEX IF NOT EXISTS "idx_receipt_returns_return_date" ON "receipt_returns"("return_date");
CREATE INDEX IF NOT EXISTS "idx_receipt_returns_items_receipt_return_id" ON "receipt_returns_items"("receipt_return_id");
CREATE INDEX IF NOT EXISTS "idx_receipt_returns_items_item_id" ON "receipt_returns_items"("item_id");

-- Add comments to tables
COMMENT ON TABLE "receipt_returns" IS 'Header table for goods receipt returns';
COMMENT ON TABLE "receipt_returns_items" IS 'Line items table for goods receipt returns';
