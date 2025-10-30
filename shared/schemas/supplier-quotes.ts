import { pgTable, uuid, varchar, integer, timestamp, text, decimal, boolean, sql, createInsertSchema, z } from "./common";
import { quotationStatusEnum, customerTypeEnum } from "./enums";
import { suppliers, users } from "./users-customers";
import { enquiries } from "./enquiries";

// Supplier Quotes
export const supplierQuotes = pgTable("supplier_quotes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteNumber: varchar("quote_number", { length: 50 }).unique().notNull(),
  revision: integer("revision").default(1),
  // Revision tracking for audit purposes
  parentQuoteId: uuid("parent_quote_id"),
  revisionReason: text("revision_reason"),
  supersededAt: timestamp("superseded_at"),
  supersededBy: uuid("superseded_by").references(() => users.id),
  isSuperseded: boolean("is_superseded").default(false),
  enquiryId: uuid("enquiry_id").references(() => enquiries.id),
  supplierId: uuid("supplier_id").references(() => suppliers.id).notNull(),
  status: quotationStatusEnum("status").default("Draft"),
  priority: varchar("priority", { length: 20 }).default("Medium"), // "Low", "Medium", "High", "Urgent"
  quoteDate: timestamp("quote_date").defaultNow(),
  validUntil: timestamp("valid_until"),
  responseDate: timestamp("response_date"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 3 }).default("BHD"), // "BHD", "AED", "USD", "EUR", "GBP"
  terms: text("terms"),
  notes: text("notes"),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  rfqNumber: varchar("rfq_number", { length: 100 }),
  evaluationScore: decimal("evaluation_score", { precision: 3, scale: 1 }), // 0-10
  competitiveRank: integer("competitive_rank"),
  approvalStatus: varchar("approval_status", { length: 50 }).default("Pending"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  supplierQuotationDocument: text("supplier_quotation_document"), // File path or URL to supplier's quotation document
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Supplier Quote Items
export const supplierQuoteItems = pgTable("supplier_quote_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierQuoteId: uuid("supplier_quote_id").references(() => supplierQuotes.id).notNull(),
  lineNumber: integer("line_number").notNull(),
  itemDescription: text("item_description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitOfMeasure: varchar("unit_of_measure", { length: 50 }),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
  specification: text("specification"),
  brand: varchar("brand", { length: 100 }),
  model: varchar("model", { length: 100 }),
  warranty: varchar("warranty", { length: 100 }),
  leadTime: varchar("lead_time", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertSupplierQuoteSchema = createInsertSchema(supplierQuotes).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertSupplierQuoteItemSchema = createInsertSchema(supplierQuoteItems).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// Validation schemas
export const supplierQuoteCreateSchema = z.object({
  supplierId: z.string().uuid(),
  enquiryId: z.string().uuid().optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).default("Medium"),
  validUntil: z.string(),
  paymentTerms: z.string(),
  deliveryTerms: z.string(),
  notes: z.string().optional(),
  rfqNumber: z.string().optional(),
  items: z.array(z.object({
    itemDescription: z.string(),
    quantity: z.number().positive(),
    unitOfMeasure: z.string(),
    unitPrice: z.number().positive(),
    specification: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    warranty: z.string().optional(),
    leadTime: z.string().optional(),
  }))
});

export const supplierQuoteUpdateSchema = z.object({
  supplierId: z.string().uuid().optional(),
  status: z.enum(["Draft", "Sent", "Accepted", "Rejected", "Expired"]).optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
  validUntil: z.string().optional(),
  responseDate: z.string().optional(),
  totalAmount: z.string().optional(),
  currency: z.enum(["BHD", "AED", "USD", "EUR", "GBP"]).optional(),
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  notes: z.string().optional(),
  rfqNumber: z.string().optional(),
  evaluationScore: z.number().min(0).max(10).optional(),
  competitiveRank: z.number().positive().optional(),
});

export const supplierQuoteSearchSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  supplier: z.string().optional(),
  currency: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
