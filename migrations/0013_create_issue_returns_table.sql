-- Migration: Create issue_returns table
-- Description: Adds the issue_returns table to track return requests for stock issues

BEGIN;

CREATE TABLE IF NOT EXISTS issue_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number VARCHAR(64) NOT NULL,
  stock_issue_id UUID NOT NULL REFERENCES stock_issue(id) ON DELETE CASCADE,
  return_type VARCHAR(64) NOT NULL,
  priority VARCHAR(32) NOT NULL,
  description TEXT NOT NULL,
  returned_by VARCHAR(128) NOT NULL,
  return_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(32) DEFAULT 'Open',
  resolution TEXT,
  assigned_to VARCHAR(128),
  estimated_resolution TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_issue_returns_return_number ON issue_returns(return_number);
CREATE INDEX IF NOT EXISTS idx_issue_returns_stock_issue_id ON issue_returns(stock_issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_returns_status ON issue_returns(status);
CREATE INDEX IF NOT EXISTS idx_issue_returns_priority ON issue_returns(priority);

COMMIT;
