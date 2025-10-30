-- Add VAT and discount fields to requisition_items table
ALTER TABLE requisition_items 
ADD COLUMN vat_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN vat_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0;

