-- Migration: Add requisition_id column to supplier_quotes table
-- This allows tracking which requisition a supplier quote is related to

-- Check if column exists and add it if not
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'supplier_quotes' 
        AND column_name = 'requisition_id'
    ) THEN
        ALTER TABLE supplier_quotes 
        ADD COLUMN requisition_id UUID REFERENCES requisitions(id);
        
        -- Add index for better performance
        CREATE INDEX IF NOT EXISTS idx_supplier_quotes_requisition_id 
        ON supplier_quotes(requisition_id);
        
        RAISE NOTICE 'Column requisition_id added to supplier_quotes table';
    ELSE
        RAISE NOTICE 'Column requisition_id already exists in supplier_quotes table';
    END IF;
END $$;
