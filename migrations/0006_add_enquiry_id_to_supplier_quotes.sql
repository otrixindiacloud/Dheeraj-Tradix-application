-- Migration: Add enquiry_id column to supplier_quotes table if it doesn't exist
-- This allows tracking which enquiry a supplier quote is related to

-- Check if column exists and add it if not
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'supplier_quotes' 
        AND column_name = 'enquiry_id'
    ) THEN
        ALTER TABLE supplier_quotes 
        ADD COLUMN enquiry_id UUID REFERENCES enquiries(id);
        
        -- Add index for better performance
        CREATE INDEX IF NOT EXISTS idx_supplier_quotes_enquiry_id 
        ON supplier_quotes(enquiry_id);
        
        RAISE NOTICE 'Column enquiry_id added to supplier_quotes table';
    ELSE
        RAISE NOTICE 'Column enquiry_id already exists in supplier_quotes table';
    END IF;
END $$;
