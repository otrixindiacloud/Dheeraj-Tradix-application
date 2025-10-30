-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    color VARCHAR(20) DEFAULT 'blue',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(user_id, role_id)
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_is_active ON permissions(is_active);

-- Insert default system roles
INSERT INTO roles (name, description, permissions, color, is_system) VALUES
('Administrator', 'Full system access with all permissions', '["*"]'::jsonb, 'red', true),
('Manager', 'Management level access to most modules', '["sales.read", "sales.write", "purchase.read", "purchase.write", "inventory.read", "reports.read"]'::jsonb, 'blue', false),
('Sales Representative', 'Access to sales operations and customer management', '["sales.read", "sales.write", "customers.read", "customers.write"]'::jsonb, 'green', false),
('Warehouse Staff', 'Inventory and warehouse management access', '["inventory.read", "inventory.write", "warehouse.read", "warehouse.write"]'::jsonb, 'purple', false),
('Finance', 'Financial operations and reporting access', '["finance.read", "finance.write", "reports.read", "invoicing.read", "invoicing.write"]'::jsonb, 'yellow', false)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (id, name, description, category, resource, action, is_active) VALUES
-- Sales permissions
('sales.read', 'View Sales', 'View sales orders and quotations', 'sales', 'sales_orders', 'read', true),
('sales.write', 'Manage Sales', 'Create and edit sales orders', 'sales', 'sales_orders', 'write', true),
('sales.delete', 'Delete Sales', 'Delete sales orders', 'sales', 'sales_orders', 'delete', true),
('customers.read', 'View Customers', 'View customer information', 'sales', 'customers', 'read', true),
('customers.write', 'Manage Customers', 'Create and edit customers', 'sales', 'customers', 'write', true),

-- Purchase permissions
('purchase.read', 'View Purchases', 'View purchase orders and supplier quotes', 'purchase', 'purchase_orders', 'read', true),
('purchase.write', 'Manage Purchases', 'Create and edit purchase orders', 'purchase', 'purchase_orders', 'write', true),
('suppliers.read', 'View Suppliers', 'View supplier information', 'purchase', 'suppliers', 'read', true),
('suppliers.write', 'Manage Suppliers', 'Create and edit suppliers', 'purchase', 'suppliers', 'write', true),

-- Inventory permissions
('inventory.read', 'View Inventory', 'View inventory levels and stock', 'inventory', 'inventory', 'read', true),
('inventory.write', 'Manage Inventory', 'Update inventory levels', 'inventory', 'inventory', 'write', true),
('warehouse.read', 'View Warehouse', 'View warehouse operations', 'inventory', 'warehouse', 'read', true),
('warehouse.write', 'Manage Warehouse', 'Manage warehouse operations', 'inventory', 'warehouse', 'write', true),

-- Finance permissions
('finance.read', 'View Finance', 'View financial data', 'finance', 'finance', 'read', true),
('finance.write', 'Manage Finance', 'Manage financial operations', 'finance', 'finance', 'write', true),
('invoicing.read', 'View Invoices', 'View invoices and billing', 'finance', 'invoices', 'read', true),
('invoicing.write', 'Manage Invoices', 'Create and manage invoices', 'finance', 'invoices', 'write', true),

-- Reports permissions
('reports.read', 'View Reports', 'Access reports and analytics', 'reports', 'reports', 'read', true),
('reports.export', 'Export Reports', 'Export reports to various formats', 'reports', 'reports', 'export', true),

-- Admin permissions
('users.read', 'View Users', 'View user accounts', 'admin', 'users', 'read', true),
('users.write', 'Manage Users', 'Create and edit users', 'admin', 'users', 'write', true),
('roles.read', 'View Roles', 'View roles and permissions', 'admin', 'roles', 'read', true),
('roles.write', 'Manage Roles', 'Create and edit roles', 'admin', 'roles', 'write', true),

-- System permissions
('system.read', 'View System', 'View system settings', 'system', 'system', 'read', true),
('system.write', 'Manage System', 'Manage system settings', 'system', 'system', 'write', true)
ON CONFLICT (id) DO NOTHING;
