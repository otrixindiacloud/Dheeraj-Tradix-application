-- Add discount field to sales_orders table
-- Migration: 0032_add_discount_field_to_sales_orders.sql

-- Add discount_amount column to sales_orders table
ALTER TABLE sales_orders 
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN sales_orders.discount_amount IS 'Total discount amount for the sales order';

-- Update existing records to have default values
UPDATE sales_orders 
SET discount_amount = 0.00
WHERE discount_amount IS NULL;
