import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp, sql, createInsertSchema } from "./common";

// Roles table
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  permissions: jsonb("permissions").$type<string[]>().default([]),
  color: varchar("color", { length: 20 }).default("blue"),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Permissions table
export const permissions = pgTable("permissions", {
  id: varchar("id", { length: 100 }).primaryKey(), // e.g., "sales.read"
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(),
  resource: varchar("resource", { length: 100 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Roles junction table (many-to-many)
export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(),
  roleId: uuid("role_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: uuid("assigned_by"),
});

// Role Permissions junction table (many-to-many)
export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: uuid("role_id").notNull(),
  permissionId: varchar("permission_id", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPermissionSchema = createInsertSchema(permissions).omit({ createdAt: true, updatedAt: true });
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({ id: true, assignedAt: true });
export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({ id: true, createdAt: true });

// Types
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRole = typeof insertRoleSchema;
export type InsertPermission = typeof insertPermissionSchema;
export type InsertUserRole = typeof insertUserRoleSchema;
export type InsertRolePermission = typeof insertRolePermissionSchema;
