-- Migration: Create inventory_levels table to support modular inventory storage
-- Description: Adds inventory_levels table with unique constraint per item/location and supporting indexes

BEGIN;

CREATE TABLE IF NOT EXISTS inventory_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  storage_location VARCHAR(255) NOT NULL,
  quantity_available INTEGER DEFAULT 0,
  quantity_reserved INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 0,
  max_stock_level INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT inventory_levels_item_location_unique UNIQUE (inventory_item_id, storage_location)
);

CREATE INDEX IF NOT EXISTS idx_inventory_levels_item ON inventory_levels(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_levels_location ON inventory_levels(storage_location);
CREATE INDEX IF NOT EXISTS idx_inventory_levels_low_stock ON inventory_levels(inventory_item_id, storage_location) WHERE quantity_available <= reorder_level;

COMMIT;
