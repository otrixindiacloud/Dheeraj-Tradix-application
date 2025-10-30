-- Create markup_configuration table for pricing management
CREATE TABLE IF NOT EXISTS markup_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level pricing_markup_level NOT NULL,
    entity_id UUID, -- null for system-wide, category_id for category, item_id for item
    retail_markup_percentage DECIMAL(5,2) NOT NULL,
    wholesale_markup_percentage DECIMAL(5,2) NOT NULL,
    effective_from TIMESTAMP DEFAULT NOW(),
    effective_to TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create enum for pricing markup level if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pricing_markup_level') THEN
        CREATE TYPE pricing_markup_level AS ENUM ('system', 'category', 'item');
    END IF;
END $$;

-- Insert default system-wide markup configuration
INSERT INTO markup_configuration (
    level,
    entity_id,
    retail_markup_percentage,
    wholesale_markup_percentage,
    is_active
) VALUES (
    'system',
    NULL,
    70.00, -- 70% retail markup
    40.00, -- 40% wholesale markup
    true
) ON CONFLICT DO NOTHING;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_markup_configuration_level ON markup_configuration(level);
CREATE INDEX IF NOT EXISTS idx_markup_configuration_entity_id ON markup_configuration(entity_id);
CREATE INDEX IF NOT EXISTS idx_markup_configuration_active ON markup_configuration(is_active);
CREATE INDEX IF NOT EXISTS idx_markup_configuration_effective ON markup_configuration(effective_from, effective_to);
