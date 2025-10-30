-- Migration: Add storage_location column to inventory_items table
-- Description: Adds storage_location field to inventory_items table to support location tracking

BEGIN;

-- Add storage_location column to inventory_items table
ALTER TABLE inventory_items 
ADD COLUMN storage_location VARCHAR(255);

-- Add comment to the column
COMMENT ON COLUMN inventory_items.storage_location IS 'Storage location for the inventory item (e.g., Warehouse A, Shelf B2)';

COMMIT;
