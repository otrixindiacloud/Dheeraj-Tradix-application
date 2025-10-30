-- Add VAT fields to supplier_lpo_items table
ALTER TABLE supplier_lpo_items 
ADD COLUMN vat_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN vat_amount DECIMAL(10,2) DEFAULT 0;
