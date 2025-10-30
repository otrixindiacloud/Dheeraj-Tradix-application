import { pgTable, uuid, varchar, timestamp, text, integer, jsonb, createInsertSchema, z, sql, decimal } from "./common";
import { enquiryStatusEnum, enquirySourceEnum } from "./enums";
import { customers, users } from "./users-customers";
import { items } from "./items";

// Customer Enquiries
export const enquiries = pgTable("enquiries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  enquiryNumber: varchar("enquiry_number", { length: 50 }).unique().notNull(),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  enquiryDate: timestamp("enquiry_date").defaultNow(),
  status: enquiryStatusEnum("status").default("New"),
  source: enquirySourceEnum("source").notNull(),
  targetDeliveryDate: timestamp("target_delivery_date"),
  notes: text("notes"),
  attachments: jsonb("attachments"), // File paths/URLs
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enquiry Items
export const enquiryItems = pgTable("enquiry_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  enquiryId: uuid("enquiry_id").references(() => enquiries.id).notNull(),
  itemId: uuid("item_id").references(() => items.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  // Optional discount fields for enquiry item line
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  // Optional VAT fields for enquiry item line
  vatPercent: decimal("vat_percent", { precision: 5, scale: 2 }),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }),
  notes: text("notes"),
});

// Insert schemas
export const insertEnquirySchema = createInsertSchema(enquiries, {
  targetDeliveryDate: z.string().optional(),
}).omit({ id: true, enquiryNumber: true, createdAt: true, updatedAt: true }).extend({
  createdBy: z.string().optional(),
});

export const insertEnquiryItemSchema = createInsertSchema(enquiryItems).omit({ id: true }).extend({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null) return undefined;
    return typeof val === 'string' ? val : val.toString();
  }),
  discountPercent: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    return typeof val === 'string' ? val : val.toString();
  }),
  discountAmount: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    return typeof val === 'string' ? val : val.toString();
  }),
  vatPercent: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    return typeof val === 'string' ? val : val.toString();
  }),
  vatAmount: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    return typeof val === 'string' ? val : val.toString();
  }),
  itemId: z.string().optional().transform((val) => {
    if (val === "" || val === undefined || val === null) return undefined;
    return val;
  }),
});

// Types
export type Enquiry = typeof enquiries.$inferSelect;
export type EnquiryItem = typeof enquiryItems.$inferSelect;
export type InsertEnquiry = z.infer<typeof insertEnquirySchema>;
export type InsertEnquiryItem = z.infer<typeof insertEnquiryItemSchema>;
