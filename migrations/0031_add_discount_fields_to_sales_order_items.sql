-- Add discount fields to sales_order_items table
-- Migration: 0031_add_discount_fields_to_sales_order_items.sql

-- Add discount_percentage column
ALTER TABLE sales_order_items 
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0;

-- Add discount_amount column  
ALTER TABLE sales_order_items 
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN sales_order_items.discount_percentage IS 'Discount percentage for the sales order item (0-100)';
COMMENT ON COLUMN sales_order_items.discount_amount IS 'Fixed discount amount for the sales order item';

-- Update existing records to have default values
UPDATE sales_order_items 
SET 
  discount_percentage = 0.00,
  discount_amount = 0.00
WHERE 
  discount_percentage IS NULL OR 
  discount_amount IS NULL;
