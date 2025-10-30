CREATE TABLE IF NOT EXISTS issue_return (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_issue_id uuid REFERENCES stock_issue(id) ON DELETE CASCADE,
    issue_number varchar(64) NOT NULL,
    issue_date date NOT NULL,
    customer_id uuid REFERENCES customers(id),
    supplier_id uuid REFERENCES suppliers(id),
    issue_reason text,
    status varchar(32) DEFAULT 'Draft',
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issue_return_item (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_return_id uuid NOT NULL REFERENCES issue_return(id) ON DELETE CASCADE,
    serial_no integer NOT NULL DEFAULT 1,
    item_id uuid,
    item_description text NOT NULL DEFAULT '',
    quantity_issued numeric(10,2) NOT NULL DEFAULT 0,
    unit_cost numeric(10,2) NOT NULL DEFAULT 0,
    total_cost numeric(12,2) NOT NULL DEFAULT 0,
    issue_reason text,
    condition_notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_return_stock_issue_id ON issue_return(stock_issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_return_item_issue_return_id ON issue_return_item(issue_return_id);
