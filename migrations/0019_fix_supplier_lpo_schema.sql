-- Fix Supplier LPO Schema - Add missing columns and constraints
-- Migration: 0019_fix_supplier_lpo_schema.sql

-- Add missing columns to supplier_lpos table
ALTER TABLE supplier_lpos 
ADD COLUMN IF NOT EXISTS "approval_status" varchar(50) DEFAULT 'Not Required',
ADD COLUMN IF NOT EXISTS "requires_approval" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "created_by" uuid REFERENCES users(id),
ADD COLUMN IF NOT EXISTS "updated_by" uuid REFERENCES users(id),
ADD COLUMN IF NOT EXISTS "approved_by" uuid REFERENCES users(id),
ADD COLUMN IF NOT EXISTS "approved_at" timestamp,
ADD COLUMN IF NOT EXISTS "approval_notes" text,
ADD COLUMN IF NOT EXISTS "sent_to_supplier_at" timestamp,
ADD COLUMN IF NOT EXISTS "confirmed_by_supplier_at" timestamp,
ADD COLUMN IF NOT EXISTS "supplier_confirmation_reference" varchar(255);

-- Add missing columns to supplier_lpo_items table
ALTER TABLE supplier_lpo_items 
ADD COLUMN IF NOT EXISTS "discount_percent" decimal(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "discount_amount" decimal(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "urgency" varchar(50) DEFAULT 'Normal',
ADD COLUMN IF NOT EXISTS "delivery_status" varchar(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS "requested_delivery_date" timestamp,
ADD COLUMN IF NOT EXISTS "confirmed_delivery_date" timestamp,
ADD COLUMN IF NOT EXISTS "special_instructions" text;

-- Update enum values to include Pending status
-- Note: This might require recreating the enum if it's already in use
-- For now, we'll add a check constraint to ensure valid status values
ALTER TABLE supplier_lpos 
ADD CONSTRAINT check_supplier_lpo_status 
CHECK (status IN ('Draft', 'Pending', 'Sent', 'Confirmed', 'Received', 'Cancelled'));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_supplier_lpos_status" ON "supplier_lpos"("status");
CREATE INDEX IF NOT EXISTS "idx_supplier_lpos_supplier_id" ON "supplier_lpos"("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_lpos_created_by" ON "supplier_lpos"("created_by");
CREATE INDEX IF NOT EXISTS "idx_supplier_lpos_approval_status" ON "supplier_lpos"("approval_status");
CREATE INDEX IF NOT EXISTS "idx_supplier_lpo_items_lpo_id" ON "supplier_lpo_items"("supplier_lpo_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_lpo_items_delivery_status" ON "supplier_lpo_items"("delivery_status");

-- Add comments for documentation
COMMENT ON COLUMN supplier_lpos.approval_status IS 'Approval status: Not Required, Pending, Approved, Rejected';
COMMENT ON COLUMN supplier_lpos.requires_approval IS 'Whether this LPO requires approval before sending';
COMMENT ON COLUMN supplier_lpos.created_by IS 'User who created this LPO';
COMMENT ON COLUMN supplier_lpos.updated_by IS 'User who last updated this LPO';
COMMENT ON COLUMN supplier_lpos.approved_by IS 'User who approved this LPO';
COMMENT ON COLUMN supplier_lpos.approved_at IS 'When this LPO was approved';
COMMENT ON COLUMN supplier_lpos.approval_notes IS 'Notes from the approval process';
COMMENT ON COLUMN supplier_lpos.sent_to_supplier_at IS 'When this LPO was sent to supplier';
COMMENT ON COLUMN supplier_lpos.confirmed_by_supplier_at IS 'When supplier confirmed this LPO';
COMMENT ON COLUMN supplier_lpos.supplier_confirmation_reference IS 'Supplier confirmation reference number';

COMMENT ON COLUMN supplier_lpo_items.discount_percent IS 'Discount percentage for the LPO item (0-100)';
COMMENT ON COLUMN supplier_lpo_items.discount_amount IS 'Fixed discount amount for the LPO item';
COMMENT ON COLUMN supplier_lpo_items.urgency IS 'Urgency level: Low, Normal, High, Urgent';
COMMENT ON COLUMN supplier_lpo_items.delivery_status IS 'Delivery status: Pending, Partial, Complete';
COMMENT ON COLUMN supplier_lpo_items.requested_delivery_date IS 'Requested delivery date for this item';
COMMENT ON COLUMN supplier_lpo_items.confirmed_delivery_date IS 'Confirmed delivery date for this item';
COMMENT ON COLUMN supplier_lpo_items.special_instructions IS 'Special instructions for this item';
