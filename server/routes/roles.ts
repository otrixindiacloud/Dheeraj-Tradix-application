import { Router } from "express";
import { db } from "../db";
import { users } from "../../shared/schemas/users-customers";
import { roles, userRoles } from "../../shared/schemas/roles-permissions";
import { eq, desc, and, sql, count } from "drizzle-orm";

const router = Router();

// Get all roles
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    
    let whereConditions = [];
    
    if (search) {
      const searchTerm = `%${search}%`;
      whereConditions.push(
        sql`(${roles.name} ILIKE ${searchTerm} OR ${roles.description} ILIKE ${searchTerm})`
      );
    }

    const rolesList = await db
      .select()
      .from(roles)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(roles.createdAt));

    // Get user counts for each role
    const rolesWithCounts = await Promise.all(
      rolesList.map(async (role) => {
        const userCountResult = await db
          .select({ count: count() })
          .from(userRoles)
          .where(eq(userRoles.roleId, role.id));

        return {
          ...role,
          userCount: userCountResult[0]?.count || 0
        };
      })
    );

    res.json(rolesWithCounts);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

// Get role by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const role = await db
      .select()
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1);

    if (role.length === 0) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Get user count for this role
    const userCountResult = await db
      .select({ count: count() })
      .from(userRoles)
      .where(eq(userRoles.roleId, id));

    res.json({
      ...role[0],
      userCount: userCountResult[0]?.count || 0
    });
  } catch (error) {
    console.error("Error fetching role:", error);
    res.status(500).json({ error: "Failed to fetch role" });
  }
});

// Create new role
router.post("/", async (req, res) => {
  try {
    const { name, description, permissions, color } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: "Name and description are required" });
    }

    // Check if role already exists
    const existingRole = await db
      .select()
      .from(roles)
      .where(eq(roles.name, name))
      .limit(1);

    if (existingRole.length > 0) {
      return res.status(400).json({ error: "Role with this name already exists" });
    }

    const newRole = await db
      .insert(roles)
      .values({
        name,
        description,
        permissions: permissions || [],
        color: color || "blue",
        isSystem: false
      })
      .returning();

    res.status(201).json({
      ...newRole[0],
      userCount: 0
    });
  } catch (error) {
    console.error("Error creating role:", error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: "Role with this name already exists" });
    } else {
      res.status(500).json({ error: "Failed to create role" });
    }
  }
});

// Update role
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions, color } = req.body;

    // Check if role exists
    const existingRole = await db
      .select()
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1);

    if (existingRole.length === 0) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Check if it's a system role
    if (existingRole[0].isSystem) {
      return res.status(400).json({ error: "Cannot modify system roles" });
    }

    // Check if name already exists (excluding current role)
    if (name && name !== existingRole[0].name) {
      const nameCheck = await db
        .select()
        .from(roles)
        .where(eq(roles.name, name))
        .limit(1);

      if (nameCheck.length > 0) {
        return res.status(400).json({ error: "Role with this name already exists" });
      }
    }

    const updatedRole = await db
      .update(roles)
      .set({
        name: name || existingRole[0].name,
        description: description || existingRole[0].description,
        permissions: permissions || existingRole[0].permissions,
        color: color || existingRole[0].color,
        updatedAt: new Date()
      })
      .where(eq(roles.id, id))
      .returning();

    // Get user count
    const userCountResult = await db
      .select({ count: count() })
      .from(userRoles)
      .where(eq(userRoles.roleId, id));

    res.json({
      ...updatedRole[0],
      userCount: userCountResult[0]?.count || 0
    });
  } catch (error) {
    console.error("Error updating role:", error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: "Role with this name already exists" });
    } else {
      res.status(500).json({ error: "Failed to update role" });
    }
  }
});

// Delete role
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if role exists
    const existingRole = await db
      .select()
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1);

    if (existingRole.length === 0) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Check if it's a system role
    if (existingRole[0].isSystem) {
      return res.status(400).json({ error: "Cannot delete system roles" });
    }

    // Check if role is in use
    const usersWithRole = await db
      .select({ count: count() })
      .from(userRoles)
      .where(eq(userRoles.roleId, id));

    if (usersWithRole[0]?.count > 0) {
      return res.status(400).json({ error: "Cannot delete role that is assigned to users" });
    }

    await db
      .delete(roles)
      .where(eq(roles.id, id));

    res.json({ message: "Role deleted successfully" });
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({ error: "Failed to delete role" });
  }
});

export default router;
