-- Create carriers table
CREATE TABLE IF NOT EXISTS carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  carrier_code VARCHAR(100) UNIQUE,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  contact_person VARCHAR(255),
  service_type VARCHAR(100),
  tracking_url VARCHAR(500),
  api_key VARCHAR(255),
  account_number VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_carriers_carrier_code ON carriers(carrier_code);
CREATE INDEX IF NOT EXISTS idx_carriers_is_active ON carriers(is_active);

-- Update shipments table to reference carriers instead of suppliers for carrier_id
-- Note: If shipments table exists with carrier_id referencing suppliers, we need to:
-- 1. Drop the old foreign key constraint
-- 2. Add new foreign key constraint to carriers table
-- 3. Migrate any existing carrier data if needed

-- Drop the old foreign key if it exists (adjust constraint name as needed)
DO $$
BEGIN
  -- Drop old foreign key constraint if it references suppliers
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%carrier_id%' 
    AND table_name = 'shipments'
  ) THEN
    ALTER TABLE shipments 
    DROP CONSTRAINT IF EXISTS shipments_carrier_id_suppliers_id_fk;
  END IF;
END $$;

-- Set any orphaned carrier_id references to NULL before adding foreign key
-- (shipments that reference carriers that don't exist)
-- Only run this if shipments table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipments') THEN
    UPDATE shipments 
    SET carrier_id = NULL 
    WHERE carrier_id IS NOT NULL 
    AND carrier_id NOT IN (SELECT id FROM carriers);
  END IF;
END $$;

-- Add new foreign key constraint to carriers table (only if it doesn't exist and shipments table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipments') THEN
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.table_constraints 
      WHERE constraint_name = 'shipments_carrier_id_carriers_id_fk'
      AND table_name = 'shipments'
    ) THEN
      ALTER TABLE shipments 
      ADD CONSTRAINT shipments_carrier_id_carriers_id_fk 
      FOREIGN KEY (carrier_id) REFERENCES carriers(id) 
      ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

