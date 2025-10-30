-- Migration: Create material_receipt and material_receipt_items tables
-- Description: These tables store data from the Receipt Wizard when users submit receipts
-- Created: 2025-10-12

-- Create material_receipt table (header table)
CREATE TABLE IF NOT EXISTS "material_receipt" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "receipt_number" varchar(50) UNIQUE NOT NULL,
  "supplier_lpo_id" uuid REFERENCES "supplier_lpos"("id"),
  "supplier_id" uuid REFERENCES "suppliers"("id"),
  "receipt_date" timestamp DEFAULT now(),
  "received_by" varchar(255),
  "status" varchar(50) DEFAULT 'Pending',
  "notes" text,
  "invoice_number" varchar(50),
  "invoice_date" timestamp,
  "supplier_name" varchar(255),
  "payment_terms" text,
  "due_date" timestamp,
  "supplier_address" text,
  "supplier_contact_person" varchar(255),
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create material_receipt_items table (line items table)
CREATE TABLE IF NOT EXISTS "material_receipt_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "material_receipt_id" uuid NOT NULL REFERENCES "material_receipt"("id") ON DELETE CASCADE,
  "serial_no" integer,
  "item_code" varchar(100),
  "item_description" text NOT NULL,
  "barcode" varchar(100),
  "supplier_code" varchar(100),
  "quantity" decimal(10, 2) NOT NULL DEFAULT 0,
  "unit_cost" decimal(10, 2) NOT NULL DEFAULT 0,
  "discount_percent" decimal(5, 2) DEFAULT 0,
  "discount_amount" decimal(10, 2) DEFAULT 0,
  "net_total" decimal(12, 2) DEFAULT 0,
  "vat_percent" decimal(5, 2) DEFAULT 0,
  "vat_amount" decimal(10, 2) DEFAULT 0,
  "total_price" decimal(12, 2) DEFAULT 0,
  "item_name" varchar(255),
  "description" text,
  "unit_price" decimal(10, 2) DEFAULT 0,
  "received_quantity" decimal(10, 2) DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_material_receipt_receipt_number" ON "material_receipt"("receipt_number");
CREATE INDEX IF NOT EXISTS "idx_material_receipt_supplier_lpo_id" ON "material_receipt"("supplier_lpo_id");
CREATE INDEX IF NOT EXISTS "idx_material_receipt_supplier_id" ON "material_receipt"("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_material_receipt_status" ON "material_receipt"("status");
CREATE INDEX IF NOT EXISTS "idx_material_receipt_items_material_receipt_id" ON "material_receipt_items"("material_receipt_id");

-- Add comments for documentation
COMMENT ON TABLE "material_receipt" IS 'Material receipt header records from Receipt Wizard submissions';
COMMENT ON TABLE "material_receipt_items" IS 'Material receipt line items from Receipt Wizard submissions';
COMMENT ON COLUMN "material_receipt"."receipt_number" IS 'Unique receipt number for tracking';
COMMENT ON COLUMN "material_receipt"."status" IS 'Receipt status: Pending, Partial, Completed, Discrepancy';
COMMENT ON COLUMN "material_receipt_items"."material_receipt_id" IS 'Foreign key reference to material_receipt header';
