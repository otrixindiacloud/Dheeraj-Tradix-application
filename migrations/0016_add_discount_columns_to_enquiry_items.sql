-- Add discount columns to enquiry_items table
-- Migration: 0016_add_discount_columns_to_enquiry_items.sql

-- Add discount_percent column
ALTER TABLE enquiry_items 
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2);

-- Add discount_amount column  
ALTER TABLE enquiry_items 
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2);

-- Add comment for documentation
COMMENT ON COLUMN enquiry_items.discount_percent IS 'Discount percentage for the enquiry item (0-100)';
COMMENT ON COLUMN enquiry_items.discount_amount IS 'Fixed discount amount for the enquiry item';
