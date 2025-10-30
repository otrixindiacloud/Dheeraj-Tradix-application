-- Add transfer-specific fields to stock_movements table
ALTER TABLE stock_movements 
ADD COLUMN IF NOT EXISTS transfer_number TEXT,
ADD COLUMN IF NOT EXISTS from_location TEXT,
ADD COLUMN IF NOT EXISTS to_location TEXT,
ADD COLUMN IF NOT EXISTS transfer_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS requested_by TEXT,
ADD COLUMN IF NOT EXISTS reason TEXT;
