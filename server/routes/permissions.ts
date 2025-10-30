import { Router } from "express";
import { db } from "../db";
import { permissions, rolePermissions } from "../../shared/schemas/roles-permissions";
import { eq, desc, and, sql, count, like } from "drizzle-orm";

const router = Router();

const PERMISSION_CATEGORIES = [
  { 
    id: "sales", 
    name: "Sales Management", 
    description: "Sales orders, quotations, and customer management",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: "🛒",
    permissionCount: 0
  },
  { 
    id: "purchase", 
    name: "Purchase Management", 
    description: "Purchase orders, supplier quotes, and procurement",
    color: "bg-green-50 text-green-700 border-green-200",
    icon: "📦",
    permissionCount: 0
  },
  { 
    id: "inventory", 
    name: "Inventory Management", 
    description: "Stock levels, warehouse operations, and inventory tracking",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    icon: "📊",
    permissionCount: 0
  },
  { 
    id: "finance", 
    name: "Finance & Accounting", 
    description: "Financial operations, invoicing, and accounting",
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
    icon: "💰",
    permissionCount: 0
  },
  { 
    id: "admin", 
    name: "Administration", 
    description: "User management, roles, and system administration",
    color: "bg-red-50 text-red-700 border-red-200",
    icon: "⚙️",
    permissionCount: 0
  },
  { 
    id: "reports", 
    name: "Reports & Analytics", 
    description: "Reports, analytics, and data export",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: "📈",
    permissionCount: 0
  },
  { 
    id: "system", 
    name: "System Settings", 
    description: "System configuration and settings",
    color: "bg-gray-50 text-gray-700 border-gray-200",
    icon: "🔧",
    permissionCount: 0
  }
];


// Get all permissions
router.get("/", async (req, res) => {
  try {
    const { 
      search, 
      category, 
      action, 
      status 
    } = req.query;
    
    let whereConditions = [];
    
    if (search) {
      const searchTerm = `%${search}%`;
      whereConditions.push(
        sql`(${permissions.name} ILIKE ${searchTerm} OR ${permissions.description} ILIKE ${searchTerm} OR ${permissions.category} ILIKE ${searchTerm})`
      );
    }
    
    if (category && category !== "all") {
      whereConditions.push(eq(permissions.category, category as string));
    }
    
    if (action && action !== "all") {
      whereConditions.push(eq(permissions.action, action as string));
    }
    
    if (status && status !== "all") {
      const isActive = status === "active";
      whereConditions.push(eq(permissions.isActive, isActive));
    }

    const permissionsList = await db
      .select()
      .from(permissions)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(permissions.createdAt));

    // Get usage counts for each permission
    const permissionsWithCounts = await Promise.all(
      permissionsList.map(async (permission) => {
        const usageCountResult = await db
          .select({ count: count() })
          .from(rolePermissions)
          .where(eq(rolePermissions.permissionId, permission.id));

        return {
          ...permission,
          usageCount: usageCountResult[0]?.count || 0,
          roles: [] // TODO: Get actual roles using this permission
        };
      })
    );

    res.json(permissionsWithCounts);
  } catch (error) {
    console.error("Error fetching permissions:", error);
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});

// Get permission categories
router.get("/categories", async (req, res) => {
  try {
    // Get permission counts per category from database
    const categoryCounts = await db
      .select({
        category: permissions.category,
        count: count()
      })
      .from(permissions)
      .groupBy(permissions.category);

    // Update category counts
    const categoriesWithCounts = PERMISSION_CATEGORIES.map(category => {
      const count = categoryCounts.find(c => c.category === category.id);
      return {
        ...category,
        permissionCount: count?.count || 0
      };
    });

    res.json(categoriesWithCounts);
  } catch (error) {
    console.error("Error fetching permission categories:", error);
    res.status(500).json({ error: "Failed to fetch permission categories" });
  }
});

// Get permission by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const permission = await db
      .select()
      .from(permissions)
      .where(eq(permissions.id, id))
      .limit(1);

    if (permission.length === 0) {
      return res.status(404).json({ error: "Permission not found" });
    }

    // Get usage count
    const usageCountResult = await db
      .select({ count: count() })
      .from(rolePermissions)
      .where(eq(rolePermissions.permissionId, id));

    res.json({
      ...permission[0],
      usageCount: usageCountResult[0]?.count || 0,
      roles: []
    });
  } catch (error) {
    console.error("Error fetching permission:", error);
    res.status(500).json({ error: "Failed to fetch permission" });
  }
});

// Create new permission
router.post("/", async (req, res) => {
  try {
    const { name, description, category, resource, action, isActive = true } = req.body;

    if (!name || !description || !category || !resource || !action) {
      return res.status(400).json({ error: "Name, description, category, resource, and action are required" });
    }

    // Check if permission already exists
    const existingPermission = await db
      .select()
      .from(permissions)
      .where(eq(permissions.id, `${category}.${action}`))
      .limit(1);

    if (existingPermission.length > 0) {
      return res.status(400).json({ error: "Permission with this ID already exists" });
    }

    const newPermission = await db
      .insert(permissions)
      .values({
        id: `${category}.${action}`,
        name,
        description,
        category,
        resource,
        action,
        isActive
      })
      .returning();

    res.status(201).json({
      ...newPermission[0],
      usageCount: 0,
      roles: []
    });
  } catch (error) {
    console.error("Error creating permission:", error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: "Permission with this ID already exists" });
    } else {
      res.status(500).json({ error: "Failed to create permission" });
    }
  }
});

// Update permission
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, resource, action, isActive } = req.body;

    // Check if permission exists
    const existingPermission = await db
      .select()
      .from(permissions)
      .where(eq(permissions.id, id))
      .limit(1);

    if (existingPermission.length === 0) {
      return res.status(404).json({ error: "Permission not found" });
    }

    // Check if name already exists (excluding current permission)
    if (name && name !== existingPermission[0].name) {
      const nameCheck = await db
        .select()
        .from(permissions)
        .where(eq(permissions.name, name))
        .limit(1);

      if (nameCheck.length > 0) {
        return res.status(400).json({ error: "Permission with this name already exists" });
      }
    }

    // Check if category or action changed, which would require a new ID
    const newCategory = category || existingPermission[0].category;
    const newAction = action || existingPermission[0].action;
    const newId = `${newCategory}.${newAction}`;
    
    // If ID would change, check if new ID already exists
    if (newId !== id) {
      const idCheck = await db
        .select()
        .from(permissions)
        .where(eq(permissions.id, newId))
        .limit(1);

      if (idCheck.length > 0) {
        return res.status(400).json({ error: "Permission with this category and action combination already exists" });
      }
    }

    let updatedPermission;
    
    if (newId !== id) {
      // If ID changed, we need to delete the old record and create a new one
      // First, delete the old record
      await db
        .delete(permissions)
        .where(eq(permissions.id, id));
      
      // Create new record with new ID
      updatedPermission = await db
        .insert(permissions)
        .values({
          id: newId,
          name: name || existingPermission[0].name,
          description: description || existingPermission[0].description,
          category: newCategory,
          resource: resource || existingPermission[0].resource,
          action: newAction,
          isActive: isActive !== undefined ? isActive : existingPermission[0].isActive,
          createdAt: existingPermission[0].createdAt,
          updatedAt: new Date()
        })
        .returning();
    } else {
      // If ID didn't change, just update the existing record
      updatedPermission = await db
        .update(permissions)
        .set({
          name: name || existingPermission[0].name,
          description: description || existingPermission[0].description,
          category: newCategory,
          resource: resource || existingPermission[0].resource,
          action: newAction,
          isActive: isActive !== undefined ? isActive : existingPermission[0].isActive,
          updatedAt: new Date()
        })
        .where(eq(permissions.id, id))
        .returning();
    }

    res.json(updatedPermission[0]);
  } catch (error) {
    console.error("Error updating permission:", error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: "Permission with this name already exists" });
    } else {
      res.status(500).json({ error: "Failed to update permission" });
    }
  }
});

// Delete permission
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if permission exists
    const existingPermission = await db
      .select()
      .from(permissions)
      .where(eq(permissions.id, id))
      .limit(1);

    if (existingPermission.length === 0) {
      return res.status(404).json({ error: "Permission not found" });
    }

    // Check if permission is in use
    const usageCountResult = await db
      .select({ count: count() })
      .from(rolePermissions)
      .where(eq(rolePermissions.permissionId, id));

    if (usageCountResult[0]?.count > 0) {
      return res.status(400).json({ error: "Cannot delete permission that is assigned to roles" });
    }

    await db
      .delete(permissions)
      .where(eq(permissions.id, id));

    res.json({ message: "Permission deleted successfully" });
  } catch (error) {
    console.error("Error deleting permission:", error);
    res.status(500).json({ error: "Failed to delete permission" });
  }
});

// Toggle permission status
router.patch("/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if permission exists
    const existingPermission = await db
      .select()
      .from(permissions)
      .where(eq(permissions.id, id))
      .limit(1);

    if (existingPermission.length === 0) {
      return res.status(404).json({ error: "Permission not found" });
    }

    const updatedPermission = await db
      .update(permissions)
      .set({
        isActive: !existingPermission[0].isActive,
        updatedAt: new Date()
      })
      .where(eq(permissions.id, id))
      .returning();

    res.json(updatedPermission[0]);
  } catch (error) {
    console.error("Error toggling permission status:", error);
    res.status(500).json({ error: "Failed to toggle permission status" });
  }
});

export default router;
