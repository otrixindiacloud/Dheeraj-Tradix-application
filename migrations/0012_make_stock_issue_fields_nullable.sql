-- Migration: Make stock_issue.item_id and stock_issue.quantity nullable for wizard support
-- Description: Updates the stock_issue table to support wizard with multiple items in stock_issue_items table

BEGIN;

-- Make item_id nullable (for wizard with multiple items)
ALTER TABLE stock_issue ALTER COLUMN item_id DROP NOT NULL;

-- Make quantity nullable (for wizard with multiple items)
ALTER TABLE stock_issue ALTER COLUMN quantity DROP NOT NULL;

-- Verify stock_issue_items table exists (should already exist from schema)
-- If it doesn't exist, create it
CREATE TABLE IF NOT EXISTS stock_issue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_issue_id UUID NOT NULL REFERENCES stock_issue(id) ON DELETE CASCADE,
  item_id UUID,
  item_description TEXT,
  quantity_issued INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(10, 2) DEFAULT 0,
  total_cost NUMERIC(10, 2) DEFAULT 0,
  issue_reason TEXT,
  condition_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on stock_issue_id for faster queries
CREATE INDEX IF NOT EXISTS idx_stock_issue_items_stock_issue_id ON stock_issue_items(stock_issue_id);

-- Create index on item_id for faster queries
CREATE INDEX IF NOT EXISTS idx_stock_issue_items_item_id ON stock_issue_items(item_id);

COMMIT;

-- Comments for documentation
COMMENT ON TABLE stock_issue IS 'Material Issue table - stores header details for stock/material issues';
COMMENT ON TABLE stock_issue_items IS 'Material Issue Items table - stores line items for each stock/material issue';
COMMENT ON COLUMN stock_issue.item_id IS 'Legacy field - nullable to support wizard with multiple items in stock_issue_items';
COMMENT ON COLUMN stock_issue.quantity IS 'Legacy field - nullable to support wizard with multiple items in stock_issue_items';
