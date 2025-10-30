-- Create quotation_approvals table for tracking quotation approval workflow
CREATE TABLE quotation_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    approver_level VARCHAR(50) NOT NULL,
    approver_id UUID REFERENCES users(id),
    status VARCHAR(50) NOT NULL, -- "Pending", "Approved", "Rejected"
    comments TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX idx_quotation_approvals_quotation_id ON quotation_approvals(quotation_id);
CREATE INDEX idx_quotation_approvals_approver_id ON quotation_approvals(approver_id);
CREATE INDEX idx_quotation_approvals_status ON quotation_approvals(status);
