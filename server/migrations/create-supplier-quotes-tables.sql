-- Create supplier_quotes table
CREATE TABLE IF NOT EXISTS supplier_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    revision INTEGER DEFAULT 1,
    parent_quote_id UUID,
    revision_reason TEXT,
    superseded_at TIMESTAMP,
    superseded_by UUID REFERENCES users(id),
    is_superseded BOOLEAN DEFAULT false,
    enquiry_id UUID REFERENCES enquiries(id),
    supplier_id UUID REFERENCES suppliers(id) NOT NULL,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired')),
    priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    quote_date TIMESTAMP DEFAULT NOW(),
    valid_until TIMESTAMP,
    response_date TIMESTAMP,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'BHD' CHECK (currency IN ('BHD', 'AED', 'USD', 'EUR', 'GBP')),
    terms TEXT,
    notes TEXT,
    payment_terms TEXT,
    delivery_terms TEXT,
    rfq_number VARCHAR(100),
    evaluation_score DECIMAL(3, 1) CHECK (evaluation_score >= 0 AND evaluation_score <= 10),
    competitive_rank INTEGER CHECK (competitive_rank > 0),
    approval_status VARCHAR(50) DEFAULT 'Pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    supplier_quotation_document TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create supplier_quote_items table
CREATE TABLE IF NOT EXISTS supplier_quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_quote_id UUID REFERENCES supplier_quotes(id) ON DELETE CASCADE NOT NULL,
    line_number INTEGER NOT NULL,
    item_description TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit_of_measure VARCHAR(50),
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    specification TEXT,
    brand VARCHAR(100),
    model VARCHAR(100),
    warranty VARCHAR(100),
    lead_time VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_supplier_quotes_supplier_id ON supplier_quotes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes_status ON supplier_quotes(status);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes_quote_number ON supplier_quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes_valid_until ON supplier_quotes(valid_until);
CREATE INDEX IF NOT EXISTS idx_supplier_quote_items_quote_id ON supplier_quote_items(supplier_quote_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quote_items_line_number ON supplier_quote_items(supplier_quote_id, line_number);
