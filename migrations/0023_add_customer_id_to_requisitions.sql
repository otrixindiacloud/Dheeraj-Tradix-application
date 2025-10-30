-- Migration: Add customer_id column to requisitions table
-- This allows tracking which customer a requisition is related to

-- Check if column exists and add it if not
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'requisitions' 
        AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE requisitions 
        ADD COLUMN customer_id UUID REFERENCES customers(id);
        
        -- Add index for better performance
        CREATE INDEX IF NOT EXISTS idx_requisitions_customer_id 
        ON requisitions(customer_id);
        
        RAISE NOTICE 'Column customer_id added to requisitions table';
    ELSE
        RAISE NOTICE 'Column customer_id already exists in requisitions table';
    END IF;
END $$;
