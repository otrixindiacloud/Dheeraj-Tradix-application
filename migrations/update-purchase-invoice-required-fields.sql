-- Migration: Update Purchase Invoice Required Fields
-- Description: Make supplier_invoice_number and payment_terms required fields
-- Date: 2024-01-XX

-- First, update any existing NULL values to have default values
UPDATE purchase_invoices 
SET supplier_invoice_number = 'TEMP-' || id::text 
WHERE supplier_invoice_number IS NULL;

UPDATE purchase_invoices 
SET payment_terms = 'Net 30' 
WHERE payment_terms IS NULL;

-- Now alter the columns to be NOT NULL
ALTER TABLE purchase_invoices 
ALTER COLUMN supplier_invoice_number SET NOT NULL;

ALTER TABLE purchase_invoices 
ALTER COLUMN payment_terms SET NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN purchase_invoices.supplier_invoice_number IS 'Supplier invoice reference number - required for reconciliation';
COMMENT ON COLUMN purchase_invoices.payment_terms IS 'Payment terms (e.g., Net 30, Net 15) - required for payment tracking';
