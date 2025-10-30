-- Create customer_po_upload table
CREATE TABLE IF NOT EXISTS customer_po_upload (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    quotation_id UUID NOT NULL,
    po_number VARCHAR(64),
    file_url VARCHAR(256), -- Path to uploaded PO file
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by VARCHAR(128)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_po_upload_customer_id ON customer_po_upload(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_po_upload_quotation_id ON customer_po_upload(quotation_id);
CREATE INDEX IF NOT EXISTS idx_customer_po_upload_po_number ON customer_po_upload(po_number);
